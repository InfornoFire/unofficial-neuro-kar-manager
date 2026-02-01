use std::env;
use std::fs;
use std::io::Cursor;
use std::path::Path;

const RCLONE_VERSION: &str = "v1.73.0";

fn main() {
    setup_sidecar();
    tauri_build::build();
}

fn setup_sidecar() {
    // Get the target triple for the build
    let target_triple = env::var("TARGET").expect("TARGET env var not set");
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set");
    let binaries_dir = Path::new(&manifest_dir).join("binaries");

    if !binaries_dir.exists() {
        fs::create_dir_all(&binaries_dir).expect("Failed to create binaries directory");
    }

    // Determine extension
    let ext = if target_triple.contains("windows") {
        ".exe"
    } else {
        ""
    };

    // Tauri sidecar naming convention: command-target-triple
    let sidecar_name = format!("rclone-{}{}", target_triple, ext);
    let sidecar_path = binaries_dir.join(&sidecar_name);

    if sidecar_path.exists() {
        return;
    }

    println!(
        "cargo:warning=Sidecar not found. Downloading rclone for target: {}",
        target_triple
    );

    // Map Rust target triple to Rclone platform/arch
    let (os, arch) = if target_triple.contains("windows") {
        ("windows", "amd64")
    } else if target_triple.contains("darwin") {
        if target_triple.contains("aarch64") {
            ("osx", "arm64")
        } else {
            ("osx", "amd64")
        }
    } else if target_triple.contains("linux") {
        ("linux", "amd64")
    } else {
        panic!(
            "Unsupported target triple for rclone setup: {}",
            target_triple
        );
    };

    let filename = format!("rclone-{}-{}-{}.zip", RCLONE_VERSION, os, arch);
    let url = format!(
        "https://downloads.rclone.org/{}/{}",
        RCLONE_VERSION, filename
    );

    println!("cargo:warning=Downloading from {}", url);

    let client = reqwest::blocking::Client::builder()
        .build()
        .expect("Failed to create reqwest client");

    let response = client
        .get(&url)
        .send()
        .expect("Failed to download rclone archive");

    if !response.status().is_success() {
        panic!("Failed to download rclone: Status {}", response.status());
    }

    let bytes = response.bytes().expect("Failed to get response bytes");
    let cursor = Cursor::new(bytes);

    let mut archive = zip::ZipArchive::new(cursor).expect("Failed to open zip archive");

    // Extract the binary
    let binary_name = format!("rclone{}", ext);
    let mut extracted = false;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).expect("Failed to read zip entry");
        let name = file.name().to_string();

        // Check if file is the binary we want. It should be inside a folder.
        if name.ends_with(&format!("/{}", binary_name)) || name == binary_name {
            println!("cargo:warning=Extracting {} to {:?}", name, sidecar_path);

            let mut dest_file =
                fs::File::create(&sidecar_path).expect("Failed to create sidecar file");
            std::io::copy(&mut file, &mut dest_file).expect("Failed to write sidecar file");

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = dest_file
                    .metadata()
                    .expect("Failed to get metadata")
                    .permissions();
                perms.set_mode(0o755);
                dest_file
                    .set_permissions(perms)
                    .expect("Failed to set permissions");
            }

            extracted = true;
            break;
        }
    }

    if !extracted {
        panic!(
            "Could not find {} in the downloaded zip archive",
            binary_name
        );
    }

    println!("cargo:warning=Rclone sidecar setup successfully!");
}
