use std::env;
use std::path::PathBuf;

/// Extract JSON content from text, finding the first '{' and last '}'
pub fn extract_json(text: &str) -> Option<String> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    if start <= end {
        Some(text[start..=end].to_string())
    } else {
        None
    }
}

/// Get the application data directory.
/// Uses OS-specific locations to ensure write access.
pub fn get_app_data_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "linux")]
    {
        // Linux: Always use XDG data directory (handles AppImage and regular installations)
        let data_dir = if let Ok(xdg_data) = env::var("XDG_DATA_HOME") {
            PathBuf::from(xdg_data)
        } else if let Ok(home) = env::var("HOME") {
            PathBuf::from(home).join(".local").join("share")
        } else {
            return Err("Cannot determine user data directory".to_string());
        };
        Ok(data_dir.join("unofficial-neuro-kar-manager"))
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: Use AppData\Local
        if let Ok(appdata) = env::var("LOCALAPPDATA") {
            Ok(PathBuf::from(appdata).join("unofficial-neuro-kar-manager"))
        } else if let Ok(userprofile) = env::var("USERPROFILE") {
            Ok(PathBuf::from(userprofile)
                .join("AppData")
                .join("Local")
                .join("unofficial-neuro-kar-manager"))
        } else {
            Err("Cannot determine AppData directory".to_string())
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: Use Application Support
        if let Ok(home) = env::var("HOME") {
            Ok(PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("unofficial-neuro-kar-manager"))
        } else {
            Err("Cannot determine home directory".to_string())
        }
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        // Default: Try to use directory adjacent to executable
        if let Ok(current_exe) = env::current_exe() {
            if let Some(parent) = current_exe.parent() {
                Ok(parent.to_path_buf())
            } else {
                Err("Cannot determine executable parent directory".to_string())
            }
        } else {
            Err("Cannot determine executable path".to_string())
        }
    }
}
