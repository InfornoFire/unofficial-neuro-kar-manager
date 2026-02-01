pub mod api;
pub mod utils;

use std::sync::{Arc, Mutex};
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;

#[derive(Clone)]
pub struct SharedChild(pub Arc<Mutex<Option<CommandChild>>>);

impl SharedChild {
    pub fn kill(&self) {
        if let Ok(mut lock) = self.0.lock() {
            if let Some(child) = lock.take() {
                let _ = child.kill();
            }
        }
    }
}

pub struct SidecarManager {
    pub processes: Mutex<Vec<SharedChild>>,
}

impl Default for SidecarManager {
    fn default() -> Self {
        Self {
            processes: Mutex::new(Vec::new()),
        }
    }
}

impl SidecarManager {
    pub fn add(&self, child: CommandChild) -> SharedChild {
        let shared = SharedChild(Arc::new(Mutex::new(Some(child))));
        if let Ok(mut lock) = self.processes.lock() {
            lock.push(shared.clone());
        }
        shared
    }
}

#[tauri::command]
async fn check_rclone(app: tauri::AppHandle) -> bool {
    use tauri_plugin_shell::ShellExt;
    app.shell().sidecar("rclone").is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.get_webview_window("main")
                       .expect("no main window")
                       .set_focus();
        }));
    }
    builder
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SidecarManager::default())
        .manage(api::gdrive::GdriveAuthState::default())
        .invoke_handler(tauri::generate_handler![
            check_rclone,
            api::gdrive::get_gdrive_remotes,
            api::gdrive::create_gdrive_remote,
            api::gdrive::cancel_gdrive_auth,
            api::gdrive::list_gdrive_files,
            api::gdrive::download_gdrive,
            api::gdrive::check_dry_run,
            api::rclone::get_stats,
            api::rclone::stop_rc_server,
            api::local::scan_local_files
        ])
        .build(tauri::generate_context!())
        .expect("error building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Kill all sidecars
                let state = app_handle.state::<SidecarManager>();
                if let Ok(processes) = state.processes.lock() {
                    for child in processes.iter() {
                        child.kill();
                    }
                }
            }
        });
}
