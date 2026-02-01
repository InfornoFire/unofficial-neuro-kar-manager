use super::utils::parse_gdrive_id;
use crate::api::rclone;
use rclone_sdk::ClientInfo;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use tokio::time::sleep;

/// Result from executing a sync job
struct SyncJobResult {
    deletes: i64,
    checks: i64,
    transfers: i64,
    errors: i64,
}

/// Result from a dry run check
#[derive(Debug, Serialize, Deserialize)]
pub struct DryRunResult {
    pub would_delete: bool,
    pub deleted_files: Vec<String>,
    pub stats: String,
}

/// Configuration for a Google Drive download operation
struct DownloadConfig {
    source: String,
    destination: String,
    remote_config: String,
    sync_mode: bool,
    create_subfolder: bool,
    selected_files: Option<Vec<String>>,
    create_backup: bool,
    delete_excluded: bool,
}

/// Paths for source and destination filesystems
struct FilesystemPaths {
    src_fs: String,
    dst_fs: String,
    backup_path: Option<String>,
}

impl DownloadConfig {
    fn new(
        source: String,
        destination: String,
        remote_config: Option<String>,
        sync_mode: bool,
        create_subfolder: bool,
        selected_files: Option<Vec<String>>,
        create_backup: bool,
        delete_excluded: bool,
    ) -> Result<Self, String> {
        let remote_config = remote_config
            .ok_or("Remote configuration is required. Please authorize first.".to_string())?;

        Ok(Self {
            source,
            destination,
            remote_config,
            sync_mode,
            create_subfolder,
            selected_files,
            create_backup,
            delete_excluded,
        })
    }

    /// Build filesystem paths for source and destination
    fn build_filesystem_paths(&self) -> Result<FilesystemPaths, String> {
        let root_id = parse_gdrive_id(&self.source);
        let src_fs = format!("{},root_folder_id={}:", self.remote_config, root_id);

        let dst_path = self.build_destination_path();
        let dst_fs = dst_path.to_string_lossy().to_string();

        let backup_path = if self.create_backup {
            Some(self.build_backup_path(&dst_path)?)
        } else {
            None
        };

        Ok(FilesystemPaths {
            src_fs,
            dst_fs,
            backup_path,
        })
    }

    /// Build the destination path, optionally adding a subfolder
    fn build_destination_path(&self) -> PathBuf {
        let mut dst_path = PathBuf::from(&self.destination);

        if self.create_subfolder {
            let already_has_subfolder = dst_path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name == "Unofficial-Neuro-Karaoke-Archive")
                .unwrap_or(false);

            if !already_has_subfolder {
                dst_path.push("Unofficial-Neuro-Karaoke-Archive");
            }
        }

        dst_path
    }

    /// Build backup path one level above the destination
    fn build_backup_path(&self, dst_path: &PathBuf) -> Result<String, String> {
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
        let backup_name = format!("Backup-KAR-{}", timestamp);

        let parent_path = dst_path
            .parent()
            .ok_or("Cannot get parent directory of destination")?;

        let backup_full_path = parent_path.join(backup_name);
        Ok(backup_full_path.to_string_lossy().to_string())
    }

    /// Build the request body for the sync operation
    fn build_request_body(&self, paths: &FilesystemPaths) -> serde_json::Value {
        let mut body = serde_json::json!({
            "_async": true,
            "srcFs": paths.src_fs,
            "dstFs": paths.dst_fs
        });

        // Build config object
        let mut config = serde_json::Map::new();

        if let Some(ref backup) = paths.backup_path {
            config.insert("BackupDir".to_string(), serde_json::json!(backup));
        }

        if !config.is_empty() {
            body["_config"] = serde_json::json!(config);
        }

        if let Some(ref files) = self.selected_files {
            let mut filter = build_file_filter(files);
            // Delete files not found in the filter
            if self.delete_excluded {
                if let Some(obj) = filter.as_object_mut() {
                    obj.insert("DeleteExcluded".to_string(), serde_json::json!(true));
                }
            }
            body["_filter"] = filter;
        }

        body
    }
}

/// Build filter rules for selected files
fn build_file_filter(files: &[String]) -> serde_json::Value {
    if files.is_empty() {
        return serde_json::json!({
            "IncludeRule": ["non_existent_file_marker"]
        });
    }

    let mut final_includes = Vec::new();
    for f in files {
        let clean_f = f.trim_start_matches('/');
        final_includes.push(format!("/{}", clean_f));
        final_includes.push(format!("/{}/**", clean_f));
    }

    serde_json::json!({
        "IncludeRule": final_includes
    })
}

/// Start the sync/copy operation, wait for completion, and return the results
async fn start_sync_job(
    client: &rclone_sdk::Client,
    body: &serde_json::Value,
    endpoint: &str,
) -> Result<SyncJobResult, String> {
    let response = client
        .client()
        .post(format!("{}{}", client.baseurl(), endpoint))
        .json(body)
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

    let jobid = result.jobid.ok_or("No jobid returned".to_string())?;

    // Poll for job completion
    poll_job_completion(client, jobid).await?;

    // Get final stats
    get_job_stats(client, jobid).await
}

/// Poll for job completion
async fn poll_job_completion(client: &rclone_sdk::Client, jobid: i64) -> Result<(), String> {
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
                    return Err("Download cancelled (server stopped)".to_string());
                }
                return Err(format!("Failed to check job status: {}", e));
            }
        };

        if !response.status().is_success() {
            let err_text = response.text().await.unwrap_or_default();
            if err_text.contains("job not found") {
                return Err("Download cancelled".to_string());
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
            return Ok(());
        }

        sleep(Duration::from_secs(1)).await;
    }
}

/// Get job statistics from rclone
async fn get_job_stats(client: &rclone_sdk::Client, jobid: i64) -> Result<SyncJobResult, String> {
    let stats_response = client
        .client()
        .post(format!("{}/core/stats", client.baseurl()))
        .json(&serde_json::json!({
            "group": format!("job/{}", jobid)
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to get stats: {}", e))?;

    let stats: serde_json::Value = stats_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse stats: {}", e))?;

    Ok(SyncJobResult {
        deletes: stats["deletes"].as_i64().unwrap_or(0),
        checks: stats["checks"].as_i64().unwrap_or(0),
        transfers: stats["transfers"].as_i64().unwrap_or(0),
        errors: stats["errors"].as_i64().unwrap_or(0),
    })
}

#[tauri::command]
pub async fn download_gdrive(
    app: tauri::AppHandle,
    source: String,
    destination: String,
    remote_config: Option<String>,
    sync_mode: bool,
    create_subfolder: bool,
    selected_files: Option<Vec<String>>,
    create_backup: bool,
    delete_excluded: bool,
) -> Result<String, String> {
    let config = DownloadConfig::new(
        source,
        destination,
        remote_config,
        sync_mode,
        create_subfolder,
        selected_files,
        create_backup,
        delete_excluded,
    )?;

    let client = rclone::get_sdk_client(&app).await?;
    let paths = config.build_filesystem_paths()?;
    let body = config.build_request_body(&paths);

    let endpoint = if config.sync_mode { "/sync/sync" } else { "/sync/copy" };
    let _result = start_sync_job(&client, &body, endpoint).await?;

    Ok("Download completed successfully".to_string())
}

/// Perform a dry run sync to detect what files would be deleted
#[tauri::command]
pub async fn check_dry_run(
    app: tauri::AppHandle,
    source: String,
    destination: String,
    remote_config: Option<String>,
    create_subfolder: bool,
    selected_files: Option<Vec<String>>,
    delete_excluded: bool,
) -> Result<DryRunResult, String> {
    let config = DownloadConfig::new(
        source,
        destination,
        remote_config,
        true, // Dry run is only for sync mode
        create_subfolder,
        selected_files,
        false, // No backup for dry run check
        delete_excluded,
    )?;

    let client = rclone::get_sdk_client(&app).await?;
    let paths = config.build_filesystem_paths()?;

    // Build the sync request with dry-run flag
    let mut body = config.build_request_body(&paths);

    // Add dry-run config
    if let Some(config_obj) = body.get_mut("_config") {
        if let Some(config_map) = config_obj.as_object_mut() {
            config_map.insert("DryRun".to_string(), serde_json::json!(true));
        }
    } else {
        body["_config"] = serde_json::json!({
            "DryRun": true
        });
    }

    // Capture the current log offset to ignore previous logs
    let start_offset = rclone::LogManager::get_current_offset().await;

    let result = start_sync_job(&client, &body, "/sync/sync").await?;

    // Parse logs from the offset
    let deleted_files = rclone::LogManager::parse_deleted_files(start_offset).await?;

    let would_delete = result.deletes > 0 || !deleted_files.is_empty();
    let stats_summary = format!(
        "Checks: {}, Transfers: {}, Deletes: {}, Errors: {}",
        result.checks, result.transfers, result.deletes, result.errors
    );

    Ok(DryRunResult {
        would_delete,
        deleted_files,
        stats: stats_summary,
    })
}
