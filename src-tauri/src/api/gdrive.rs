use crate::api::rclone;
use rclone_sdk::ClientInfo;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::sleep;

const DEFAULT_RCLONE_CONFIG_NAME: &str = "gdrive_unofficial_neuro_kar";

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GdriveFile {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: i64,
    pub mime_type: String,
}

#[tauri::command]
pub async fn list_gdrive_files(
    source: String,
    remote_config: String,
) -> Result<Vec<GdriveFile>, String> {
    let client = rclone::get_sdk_client().await?;
    let root_id = parse_gdrive_id(&source);

    // Construct fs pointing to the root of the share/folder
    let fs_str = format!("{},root_folder_id={}:", remote_config, root_id);

    let opt_json = serde_json::json!({
        "recurse": true
    })
    .to_string();

    let result = client
        .operations_list(
            None,
            None,
            None,
            None,
            &fs_str, // fs
            None,
            None,
            None,
            None,
            Some(&opt_json), // opt
            None,            // recurse (does not show files, use opt)
            "",              // remote
            None,
            None,
            None,
        )
        .await
        .map_err(|e| format!("List failed: {}", e))?;

    // Extract list
    let list = result.into_inner().list;

    let mut files = Vec::new();

    if let Some(entries) = Some(list) {
        for item in entries {
            files.push(GdriveFile {
                path: item.path,
                name: item.name,
                is_dir: item.is_dir,
                size: item.size.map(|s| s as i64).unwrap_or(0),
                mime_type: item.mime_type.unwrap_or_default(),
            });
        }
    }

    // Synthesize missing parent directories
    let existing_paths: std::collections::HashSet<String> =
        files.iter().map(|f| f.path.clone()).collect();
    let mut added_paths = std::collections::HashSet::new();
    let mut new_dirs = Vec::new();

    for file in &files {
        let parts: Vec<&str> = file.path.split('/').collect();
        for i in 1..parts.len() {
            let parent_path = parts[..i].join("/");
            if !existing_paths.contains(&parent_path) && !added_paths.contains(&parent_path) {
                new_dirs.push(GdriveFile {
                    path: parent_path.clone(),
                    name: parts[i - 1].to_string(),
                    is_dir: true,
                    size: 0,
                    mime_type: "inode/directory".to_string(),
                });
                added_paths.insert(parent_path);
            }
        }
    }

    files.extend(new_dirs);

    // Sort: Folders first, then alphabetical
    files.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(files)
}

#[tauri::command]
pub async fn get_gdrive_remotes() -> Result<Vec<String>, String> {
    let client = rclone::get_sdk_client().await?;

    // config/dump
    let response = client
        .config_dump(None, None)
        .await
        .map_err(|e| format!("Failed to fetch remotes: {}", e))?;

    let val = serde_json::to_value(response.into_inner()).map_err(|e| e.to_string())?;

    let mut remotes = Vec::new();
    if let Some(obj) = val.as_object() {
        for (key, val) in obj {
            if let Some(type_str) = val.get("type").and_then(|v| v.as_str()) {
                if type_str == "drive" {
                    remotes.push(key.clone());
                }
            }
        }
    }
    // Sort for consistency
    remotes.sort();
    Ok(remotes)
}

#[tauri::command]
pub async fn create_gdrive_remote() -> Result<String, String> {
    // Authorize with CLI (interactive)
    let rclone_path = rclone::is_rclone_installed()
        .await
        .ok_or("Rclone not found")?;

    let mut cmd = Command::new(rclone_path);
    cmd.args(&["authorize", "drive"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to run authorize: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Authorization failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let auth_output = String::from_utf8_lossy(&output.stdout);
    let token = extract_json(&auth_output).ok_or("Failed to extract token from auth output")?;

    let params = serde_json::json!({
        "token": token
    });

    let client = rclone::get_sdk_client().await?;
    client
        .config_create(
            Some(true),
            None,
            DEFAULT_RCLONE_CONFIG_NAME,
            None,
            &params.to_string(),
            "drive",
        )
        .await
        .map_err(|e| format!("Failed to create config context: {}", e))?;

    Ok(DEFAULT_RCLONE_CONFIG_NAME.to_string())
}

#[tauri::command]
pub async fn download_gdrive(
    source: String,
    destination: String,
    remote_config: Option<String>,
    create_subfolder: bool,
    selected_files: Option<Vec<String>>,
) -> Result<String, String> {
    let client = rclone::get_sdk_client().await?;

    // 1. Determine Source ID
    let root_id = parse_gdrive_id(&source);

    // 2. Determine Remote Configuration
    let remote_name = if let Some(conf) = remote_config {
        // Use provided existing remote
        conf
    } else {
        return Err("Remote configuration is required. Please authorize first.".to_string());
    };

    // 3. Construct Source and Dest Fs
    let src_fs = format!("{},root_folder_id={}:", remote_name, root_id);
    let mut dst_path = std::path::PathBuf::from(destination);
    if create_subfolder {
        // Check if the path already ends with the subfolder name to avoid duplication
        let already_has_subfolder = dst_path
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name == "Unofficial-Neuro-Karaoke-Archive")
            .unwrap_or(false);

        if !already_has_subfolder {
            dst_path.push("Unofficial-Neuro-Karaoke-Archive");
        }
    }
    let dst_fs = dst_path.to_string_lossy().to_string();

    // 4. Construct request body with filter if selection exists
    let mut body = serde_json::json!({
        "_async": true,
        "srcFs": src_fs,
        "dstFs": dst_fs
    });

    if let Some(files) = selected_files {
        if files.is_empty() {
            // If array is empty but passed we treat it as selecting nothing.
            body["_filter"] = serde_json::json!({
                "IncludeRule": ["non_existent_file_marker"]
            });
        } else {
            let mut final_includes = Vec::new();
            for f in files {
                // Remove leading slash if present because rclone paths are relative
                let clean_f = f.trim_start_matches('/');
                final_includes.push(format!("/{}", clean_f));
                final_includes.push(format!("/{}/**", clean_f));
            }

            body["_filter"] = serde_json::json!({
                "IncludeRule": final_includes
            });
        }
    }

    // 5. Copy
    let response = client
        .client()
        .post(format!("{}/sync/copy", client.baseurl()))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Sync start failed: {}", e))?;

    if !response.status().is_success() {
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("Sync start failed: {}", err_text));
    }

    let result: rclone_sdk::types::SyncCopyResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse sync response: {}", e))?;

    // SDK currently uses the header which does not have enough space
    // // 4. Construct Filter if selection exists
    // let filter_arg = if let Some(files) = selected_files {
    //     if files.is_empty() {
    //          // If array is empty but passed we treat it as selecting nothing.
    //          let filter_obj = serde_json::json!({
    //             "IncludeRule": ["non_existent_file_marker"]
    //          });
    //          Some(filter_obj.to_string())
    //     } else {
    //         let mut final_includes = Vec::new();
    //         for f in files {
    //             // Remove leading slash if present because rclone paths are relative
    //             let clean_f = f.trim_start_matches('/');
    //             final_includes.push(format!("/{}", clean_f));
    //             final_includes.push(format!("/{}/**", clean_f));
    //         }

    //         let filter_obj = serde_json::json!({
    //             "IncludeRule": final_includes
    //             // "Exclude": ["/**"] // Rclone implies exclude * if include is present
    //         });

    //         Some(filter_obj.to_string())
    //     }
    // } else {
    //     None
    // };

    // // 5. Copy
    // let mw = client
    //     .sync_copy(Some(true), None, filter_arg.as_deref(), None, None, &dst_fs, &src_fs)
    //     .await
    //     .map_err(|e| format!("Sync start failed: {}", e))?;

    // let inner = mw.into_inner();
    // let jobid = inner.jobid.ok_or("No jobid returned")?;

    let jobid = result.jobid.ok_or("No jobid returned")?;

    // 6. Poll for completion
    loop {
        let response_result = client
            .client()
            .post(format!("{}/job/status", client.baseurl()))
            .json(&serde_json::json!({
                "jobid": jobid
            }))
            .send()
            .await;

        let response = match response_result {
            Ok(res) => res,
            Err(e) => {
                let err_str = e.to_string();
                if err_str.contains("error sending request")
                    || err_str.contains("connection refused")
                {
                    return Ok("Download cancelled (server stopped)".to_string());
                }
                return Err(format!("Failed to check job status: {}", e));
            }
        };

        if !response.status().is_success() {
            let err_text = response.text().await.unwrap_or_default();
            if err_text.contains("job not found") {
                return Ok("Download cancelled".to_string());
            }
            return Err(format!("Job status check failed: {}", err_text));
        }

        let status: rclone_sdk::types::JobStatusResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse job status: {}", e))?;

        if status.finished {
            if !status.error.is_empty() {
                return Err(format!("Job failed: {}", status.error));
            }
            break;
        }

        sleep(Duration::from_secs(1)).await;
    }

    // job_status sends as f64, but RCD expects i64
    // loop {
    //     let status = client
    //         .job_status(None, jobid as f64)
    //         .await
    //         .map_err(|e| format!("Failed to check job status: {}", e))?
    //         .into_inner();

    //     if status.finished {
    //         if !status.error.is_empty() {
    //             return Err(format!("Job failed: {}", status.error));
    //         }
    //         break;
    //     }

    //     sleep(Duration::from_secs(1)).await;
    // }

    Ok("Download completed successfully".to_string())
}

fn parse_gdrive_id(source: &str) -> String {
    // Handle full URLs like https://drive.google.com/drive/folders/12345...
    if let Some(start) = source.find("/folders/") {
        let rest = &source[start + 9..];
        // Stop at next slash or query param
        if let Some(end) = rest.find(|c: char| c == '/' || c == '?') {
            return rest[..end].to_string();
        }
        return rest.to_string();
    }

    // Handle id= style
    if let Some(start) = source.find("id=") {
        let rest = &source[start + 3..];
        if let Some(end) = rest.find('&') {
            return rest[..end].to_string();
        }
        return rest.to_string();
    }

    // Assume it's an ID if no known prefix found
    source.to_string()
}

fn extract_json(text: &str) -> Option<String> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    if start <= end {
        Some(text[start..=end].to_string())
    } else {
        None
    }
}
