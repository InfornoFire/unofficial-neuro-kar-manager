use std::env;
use std::fs;
use std::io;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::time::Duration;

use rclone_sdk::Client;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tokio::sync::OnceCell;

const DOWNLOAD_RCLONE_VER: &str = "1.72.1";
const RC_PORT: u16 = 5572;
const RC_URL: &str = "http://localhost:5572";

static RCLONE_PATH: OnceCell<Option<PathBuf>> = OnceCell::const_new();

/// Helper to get the binary name based on OS
fn get_rclone_binary_name() -> &'static str {
    if cfg!(windows) {
        "rclone.exe"
    } else {
        "rclone"
    }
}

/// Resolves the path to the rclone binary.
async fn resolve_rclone_path() -> Option<PathBuf> {
    let binary_name = get_rclone_binary_name();

    // 1. Priority: Check where we expect to download it (adjacent to exe)
    if let Ok(current_exe) = env::current_exe() {
        if let Some(target_dir) = current_exe.parent() {
            let bin_path = target_dir.join("bin").join(binary_name);
            if bin_path.exists() {
                return Some(bin_path);
            }
        }
    }

    // 2. Secondary: System PATH
    let mut cmd = tokio::process::Command::new(binary_name);
    cmd.arg("--version");
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let result = cmd.output().await;

    match result {
        Ok(output) if output.status.success() => Some(PathBuf::from(binary_name)),
        _ => None,
    }
}

/// Checks if rclone is installed (cached).
pub async fn is_rclone_installed() -> Option<PathBuf> {
    let path = RCLONE_PATH.get_or_init(resolve_rclone_path).await;
    path.clone()
}

/// Helper to check if the RC server is listening
async fn is_server_running() -> bool {
    let client = Client::new(RC_URL);
    // core/pid is a lightweight check
    client.core_pid(None, None).await.is_ok()
}

/// Starts the rclone RC server in the background
async fn start_rc_server() -> Result<(), String> {
    let command_path = is_rclone_installed().await.ok_or("Rclone not installed")?;

    let mut cmd = tokio::process::Command::new(command_path);
    cmd.args(&[
        "rcd",
        "--rc-no-auth",
        &format!("--rc-addr=localhost:{}", RC_PORT),
    ]);

    // Don't inherit stdio, suppress output
    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::null());

    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    cmd.spawn()
        .map_err(|e| format!("Failed to spawn rclone rcd: {}", e))?;

    Ok(())
}

/// Waits for the RC server to become available
async fn wait_for_server() -> Result<(), String> {
    for _ in 0..20 {
        // 10 seconds total
        if is_server_running().await {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    Err("Timed out waiting for rclone rc server".to_string())
}

/// Returns an authenticated SDK Client, ensuring the server is running.
pub async fn get_sdk_client() -> Result<Client, String> {
    if !is_server_running().await {
        start_rc_server().await?;
        wait_for_server().await?;
    }
    Ok(Client::new(RC_URL))
}

#[tauri::command]
pub async fn get_stats() -> Result<rclone_sdk::types::CoreStatsResponse, String> {
    let client = get_sdk_client().await?;
    let response = client
        .core_stats(None, None, None, None)
        .await
        .map_err(|e| format!("Failed to fetch stats: {}", e))?;

    Ok(response.into_inner())
}

#[tauri::command]
pub async fn stop_rc_server() -> Result<(), String> {
    if is_server_running().await {
        let client = Client::new(RC_URL);
        client
            .core_quit(None, None, None)
            .await
            .map_err(|e| format!("Failed to stop rclone: {}", e))?;
    }
    Ok(())
}

/// Downloads rclone from the official website.
///
/// It determines the correct version for the current OS and architecture.
pub async fn download_rclone() -> Result<PathBuf, String> {
    let (os, arch) = match (env::consts::OS, env::consts::ARCH) {
        ("windows", "x86_64") => ("windows", "amd64"),
        ("windows", "x86") => ("windows", "386"),
        ("linux", "x86_64") => ("linux", "amd64"),
        ("linux", "aarch64") => ("linux", "arm64"),
        ("macos", "x86_64") => ("osx", "amd64"),
        ("macos", "aarch64") => ("osx", "arm64"),
        (o, a) => return Err(format!("Unsupported system: {} {}", o, a)),
    };

    let url = format!(
        "https://downloads.rclone.org/v{}/rclone-v{}-{}-{}.zip",
        DOWNLOAD_RCLONE_VER, DOWNLOAD_RCLONE_VER, os, arch
    );

    let binary_name = get_rclone_binary_name();
    let current_exe = env::current_exe().map_err(|e| e.to_string())?;

    let target_dir = current_exe.parent().ok_or("No parent dir")?.join("bin");
    tokio::fs::create_dir_all(&target_dir)
        .await
        .map_err(|e| e.to_string())?;

    let target_path = target_dir.join(binary_name);

    // Download to temp
    let temp_dir = env::temp_dir();
    let zip_path = temp_dir.join(format!("rclone_temp_{}.zip", DOWNLOAD_RCLONE_VER));

    {
        let response = reqwest::get(&url)
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Download failed: {}", response.status()));
        }

        let content = response.bytes().await.map_err(|e| e.to_string())?;
        let mut file = File::create(&zip_path).await.map_err(|e| e.to_string())?;
        file.write_all(&content).await.map_err(|e| e.to_string())?;
        file.flush().await.map_err(|e| e.to_string())?;
    }

    // Unzip
    let target_path_clone = target_path.clone();
    let zip_path_clone = zip_path.clone();

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let file = fs::File::open(&zip_path_clone).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            // rclone zips usually have structure: rclone-vX.X.X-os-arch/rclone
            // We match against the binary name
            if file.name().ends_with(binary_name) {
                let mut outfile =
                    fs::File::create(&target_path_clone).map_err(|e| e.to_string())?;
                io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;

                #[cfg(unix)]
                {
                    if let Ok(metadata) = outfile.metadata() {
                        let mut perms = metadata.permissions();
                        perms.set_mode(0o755);
                        let _ = outfile.set_permissions(perms);
                    }
                }
                return Ok(());
            }
        }
        Err("Binary not found in zip".to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    // Cleanup
    let _ = tokio::fs::remove_file(zip_path).await;

    Ok(target_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_download_rclone() {
        let result = download_rclone().await;
        match result {
            Ok(path) => println!("Rclone downloaded successfully to: {:?}", path),
            Err(e) => panic!("Failed to download rclone: {}", e),
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_is_rclone_installed() {
        match is_rclone_installed().await {
            Some(path) => println!("Rclone found at: {:?}", path),
            None => println!("Rclone not found."),
        }
    }
}
