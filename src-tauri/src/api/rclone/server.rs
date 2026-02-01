use super::LogManager;
use crate::utils::get_app_data_dir;
use rclone_sdk::Client;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;

pub const RC_PORT: u16 = 5572;
pub const RC_URL: &str = "http://localhost:5572";

/// Helper to check if the RC server is listening
pub async fn is_server_running() -> bool {
    let client = Client::new(RC_URL);
    // core/pid is a lightweight check
    client.core_pid(None, None).await.is_ok()
}

/// Starts the rclone RC server in the background
pub async fn start_rc_server(app: &AppHandle) -> Result<(), String> {
    // Clear log file on startup
    LogManager::clear().await?;
    let log_file = LogManager::get_log_path()?;

    let sidecar_command = app.shell().sidecar("rclone").map_err(|e| e.to_string())?;

    let (mut _rx, child) = sidecar_command
        .args(&[
            "rcd",
            "--rc-no-auth",
            &format!("--rc-addr=localhost:{}", RC_PORT),
            "--log-file",
            &log_file.to_string_lossy().to_string(),
            "--log-level",
            "INFO",
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn rclone rcd: {}", e))?;

    let manager = app.state::<crate::SidecarManager>();
    manager.add(child);

    Ok(())
}

/// Waits for the RC server to become available
pub async fn wait_for_server() -> Result<(), String> {
    for _ in 0..20 {
        // 10 seconds total
        if is_server_running().await {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    Err("Timed out waiting for rclone rc server".to_string())
}

/// Waits for the RC server to stop
pub async fn wait_for_server_shutdown() -> Result<(), String> {
    for _ in 0..20 {
        // 10 seconds total
        if !is_server_running().await {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    Err("Timed out waiting for rclone rc server to stop".to_string())
}

/// Returns an authenticated SDK Client, ensuring the server is running.
pub async fn get_sdk_client(app: &AppHandle) -> Result<Client, String> {
    if !is_server_running().await {
        // Ensure app data directory exists
        let app_data_dir = get_app_data_dir()?;
        tokio::fs::create_dir_all(&app_data_dir)
            .await
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;

        start_rc_server(app).await?;
        wait_for_server().await?;
    }
    Ok(Client::new(RC_URL))
}

#[tauri::command]
pub async fn stop_rc_server() -> Result<(), String> {
    if is_server_running().await {
        let client = Client::new(RC_URL);
        client
            .core_quit(None, None, None)
            .await
            .map_err(|e| format!("Failed to stop rclone: {}", e))?;

        wait_for_server_shutdown().await?;
    }
    Ok(())
}
