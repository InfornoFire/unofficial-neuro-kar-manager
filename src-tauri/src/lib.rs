pub mod api;

#[tauri::command]
async fn download_rclone() -> Result<String, String> {
    api::rclone::download_rclone()
        .await
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn check_rclone() -> bool {
    api::rclone::is_rclone_installed().await.is_some()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            download_rclone,
            check_rclone,
            api::gdrive::get_gdrive_remotes,
            api::gdrive::create_gdrive_remote,
            api::gdrive::list_gdrive_files,
            api::gdrive::download_gdrive,
            api::rclone::get_stats,
            api::rclone::stop_rc_server
        ])
        .build(tauri::generate_context!())
        .expect("error building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                let _ = tauri::async_runtime::block_on(async {
                    let _ = api::rclone::stop_rc_server().await;
                });
            }
        });
}
