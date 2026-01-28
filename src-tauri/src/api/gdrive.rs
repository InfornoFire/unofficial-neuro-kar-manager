use crate::api::rclone;
use rclone_sdk::ClientInfo;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::sleep;

const DEFAULT_RCLONE_CONFIG_NAME: &str = "gdrive_unofficial_neuro_kar";

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
pub async fn download_gdrive(
    source: String,
    destination: String,
    remote_config: Option<String>,
    create_subfolder: bool,
) -> Result<String, String> {
    let client = rclone::get_sdk_client().await?;

    // 1. Determine Source ID
    let root_id = parse_gdrive_id(&source);

    // 2. Determine Remote Configuration
    let remote_name = if let Some(conf) = remote_config {
        // Use provided existing remote
        conf
    } else {
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

        client
            .config_create(Some(true), None, DEFAULT_RCLONE_CONFIG_NAME, None, &params.to_string(), "drive")
            .await
            .map_err(|e| format!("Failed to create config context: {}", e))?;

        DEFAULT_RCLONE_CONFIG_NAME.to_string()
    };

    // 3. Construct Source and Dest Fs
    let src_fs = format!("{},root_folder_id={}:", remote_name, root_id);
    let mut dst_path = std::path::PathBuf::from(destination);
    if create_subfolder {
        dst_path.push("Unofficial-Neuro-Karaoke-Archive");
    }
    let dst_fs = dst_path.to_string_lossy().to_string();

    // 4. Copy
    let mw = client
        .sync_copy(Some(true), None, None, None, None, &dst_fs, &src_fs)
        .await
        .map_err(|e| format!("Sync start failed: {}", e))?;

    let inner = mw.into_inner();
    let jobid = inner.jobid.ok_or("No jobid returned")?;

    // Poll for completion
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
