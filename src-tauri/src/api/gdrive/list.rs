use super::types::GdriveFile;
use super::utils::parse_gdrive_id;
use crate::api::rclone;

#[tauri::command]
pub async fn list_gdrive_files(
    app: tauri::AppHandle,
    source: String,
    remote_config: String,
) -> Result<Vec<GdriveFile>, String> {
    let client = rclone::get_sdk_client(&app).await?;
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
