use crate::api::rclone;
use crate::utils::extract_json;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use tokio::sync::{Mutex, oneshot};

const DEFAULT_RCLONE_CONFIG_NAME: &str = "gdrive_unofficial_neuro_kar";

pub struct GdriveAuthState {
    pub auth_cancel_tx: Mutex<Option<oneshot::Sender<()>>>,
}

impl Default for GdriveAuthState {
    fn default() -> Self {
        Self {
            auth_cancel_tx: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub async fn get_gdrive_remotes(app: AppHandle) -> Result<Vec<String>, String> {
    let client = rclone::get_sdk_client(&app).await?;

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
pub async fn create_gdrive_remote(
    app: AppHandle,
    state: State<'_, GdriveAuthState>,
) -> Result<String, String> {
    // Authorize with CLI (interactive)
    let sidecar_command = app.shell().sidecar("rclone").map_err(|e| e.to_string())?;

    let (mut command_rx, child) = sidecar_command
        .args(&["authorize", "drive", "--auth-no-open-browser"])
        .spawn()
        .map_err(|e| format!("Failed to spawn rclone sidecar: {}", e))?;

    let manager = app.state::<crate::SidecarManager>();
    let child = manager.add(child);

    // Create cancel channel
    let (tx, rx) = oneshot::channel();
    {
        let mut lock = state.auth_cancel_tx.lock().await;
        *lock = Some(tx);
    }

    let mut auth_output = String::new();
    let app_handle = app.clone();
    // Pin rx to use in loop select
    let mut rx = std::pin::pin!(rx);

    // Process events loop
    let result = loop {
        tokio::select! {
            _ = &mut rx => {
                let _ = child.kill();
                break Err("Cancelled by user".to_string());
            }
            maybe_event = command_rx.recv() => {
                match maybe_event {
                    Some(CommandEvent::Stdout(bytes)) => {
                        let s = String::from_utf8_lossy(&bytes);
                        auth_output.push_str(&s);
                    }
                    Some(CommandEvent::Stderr(bytes)) => {
                         let s = String::from_utf8_lossy(&bytes);
                         if let Some(idx) = s.find("Please go to the following link: ") {
                            let url = s[idx + "Please go to the following link: ".len()..].trim();
                            let _ = app_handle.emit("gdrive-auth-url", url);
                        }
                    }
                    Some(CommandEvent::Error(err)) => {
                        break Err(format!("Process error: {}", err));
                    }
                    Some(CommandEvent::Terminated(term)) => {
                        if term.code.unwrap_or(0) != 0 {
                             break Err(format!("Rclone authorize failed with code {:?}", term.code));
                        }
                        break Ok(auth_output.clone());
                    }
                    None => break Ok(auth_output.clone()),
                    _ => {}
                }
            }
        }
    };

    // Clear the cancellation token
    {
        let mut lock = state.auth_cancel_tx.lock().await;
        *lock = None;
    }

    match result {
        Ok(output) => {
            let token = extract_json(&output).ok_or("Failed to extract token from auth output")?;

            let params = serde_json::json!({
                "token": token
            });

            let client = rclone::get_sdk_client(&app).await?;
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
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub async fn cancel_gdrive_auth(state: State<'_, GdriveAuthState>) -> Result<(), String> {
    let mut lock = state.auth_cancel_tx.lock().await;
    if let Some(tx) = lock.take() {
        let _ = tx.send(());
    }
    Ok(())
}
