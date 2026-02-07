use std::env;
use std::fs;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

const RCLONE_VERSION: &str = "v1.73.0";
const RCLONE_BASE_URL: &str = "https://downloads.rclone.org";
const RCLONE_ANDROID_BASE_URL: &str = "https://beta.rclone.org/v1.73.0/testbuilds";

fn main() {
    setup_sidecar();
    tauri_build::build();
}

fn setup_sidecar() {
    let target_triple = env::var("TARGET").expect("TARGET env var not set");
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set");

    if target_triple.contains("android") {
        setup_android_sidecar(&target_triple, &manifest_dir);
    } else {
        setup_regular_sidecar(&target_triple, &manifest_dir);
    }
}

fn setup_regular_sidecar(target_triple: &str, manifest_dir: &str) {
    let binaries_dir = Path::new(manifest_dir).join("binaries");

    if !binaries_dir.exists() {
        fs::create_dir_all(&binaries_dir).expect("Failed to create binaries directory");
    }

    let ext = if target_triple.contains("windows") {
        ".exe"
    } else {
        ""
    };

    let sidecar_name = format!("rclone-{}{}", target_triple, ext);
    let sidecar_path = binaries_dir.join(&sidecar_name);

    if sidecar_path.exists() {
        println!("Sidecar already exists at {:?}", sidecar_path);
        return;
    }

    println!(
        "cargo:warning=Sidecar not found. Downloading rclone for target: {}",
        target_triple
    );

    let (os, arch) = map_target_to_rclone_platform(target_triple);
    let filename = format!("rclone-{}-{}-{}.zip", RCLONE_VERSION, os, arch);
    let url = format!("{}/{}/{}", RCLONE_BASE_URL, RCLONE_VERSION, filename);

    download_and_extract_zip(&url, &sidecar_path, ext);
    println!(
        "cargo:warning=Rclone sidecar setup successfully at {:?}",
        sidecar_path
    );
}

fn setup_android_sidecar(target_triple: &str, manifest_dir: &str) {
    // Create dummy binary to satisfy Tauri CLI's sidecar requirements
    // Tauri expects binaries/rclone-<target> to exist
    let binaries_dir = Path::new(manifest_dir).join("binaries");
    if !binaries_dir.exists() {
        fs::create_dir_all(&binaries_dir).expect("Failed to create binaries directory");
    }

    let dummy_name = format!("rclone-{}", target_triple);
    let dummy_path = binaries_dir.join(&dummy_name);

    if !dummy_path.exists() {
        println!(
            "cargo:warning=Creating dummy sidecar for Android build satisfaction at {:?}",
            dummy_path
        );
        fs::File::create(&dummy_path).expect("Failed to create dummy sidecar");
    }

    // For Android, the binary goes into jniLibs
    let jni_dir = Path::new(manifest_dir).join("gen/android/app/src/main/jniLibs/arm64-v8a");

    if !jni_dir.exists() {
        fs::create_dir_all(&jni_dir).expect("Failed to create jniLibs directory");
    }

    let lib_name = format!("librclone-{}.so", target_triple);
    let lib_path = jni_dir.join(&lib_name);

    if lib_path.exists() {
        println!("Android rclone library already exists at {:?}", lib_path);
        return;
    }

    println!(
        "cargo:warning=Android rclone library not found. Downloading for target: {}",
        target_triple
    );

    // Hardcoded for now - TODO: make this dynamic based on target_triple
    let filename = "rclone-android-21-x64.gz";
    let url = format!("{}/{}", RCLONE_ANDROID_BASE_URL, filename);

    download_and_extract_gz(&url, &lib_path);
    println!(
        "cargo:warning=Android rclone library setup successfully at {:?}",
        lib_path
    );
}

fn map_target_to_rclone_platform(target_triple: &str) -> (&str, &str) {
    if target_triple.contains("windows") {
        ("windows", "amd64")
    } else if target_triple.contains("darwin") {
        if target_triple.contains("aarch64") {
            ("osx", "arm64")
        } else {
            ("osx", "amd64")
        }
    } else if target_triple.contains("linux") {
        if target_triple.contains("aarch64") {
            ("linux", "arm64")
        } else if target_triple.contains("armv7") {
            ("linux", "arm-v7")
        } else {
            ("linux", "amd64")
        }
    } else {
        panic!(
            "Unsupported target triple for rclone setup: {}",
            target_triple
        );
    }
}

fn download_and_extract_zip(url: &str, destination: &PathBuf, ext: &str) {
    println!("cargo:warning=Downloading from {}", url);

    let client = reqwest::blocking::Client::builder()
        .build()
        .expect("Failed to create reqwest client");

    let response = client
        .get(url)
        .send()
        .expect("Failed to download rclone archive");

    if !response.status().is_success() {
        panic!("Failed to download rclone: Status {}", response.status());
    }

    let bytes = response.bytes().expect("Failed to get response bytes");
    let cursor = Cursor::new(bytes);

    let mut archive = zip::ZipArchive::new(cursor).expect("Failed to open zip archive");

    let binary_name = format!("rclone{}", ext);
    let mut extracted = false;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).expect("Failed to read zip entry");
        let name = file.name().to_string();

        if name.ends_with(&format!("/{}", binary_name)) || name == binary_name {
            println!("cargo:warning=Extracting {} to {:?}", name, destination);

            let mut dest_file =
                fs::File::create(destination).expect("Failed to create sidecar file");
            std::io::copy(&mut file, &mut dest_file).expect("Failed to write sidecar file");

            set_executable_permissions(destination);

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
}

fn download_and_extract_gz(url: &str, destination: &PathBuf) {
    println!("cargo:warning=Downloading from {}", url);

    let client = reqwest::blocking::Client::builder()
        .build()
        .expect("Failed to create reqwest client");

    let response = client
        .get(url)
        .send()
        .expect("Failed to download rclone archive");

    if !response.status().is_success() {
        panic!("Failed to download rclone: Status {}", response.status());
    }

    let bytes = response.bytes().expect("Failed to get response bytes");
    let cursor = Cursor::new(bytes.as_ref());

    let mut decoder = flate2::read::GzDecoder::new(cursor);
    let mut decompressed = Vec::new();
    decoder
        .read_to_end(&mut decompressed)
        .expect("Failed to decompress gz file");

    println!("cargo:warning=Extracting to {:?}", destination);
    fs::write(destination, decompressed).expect("Failed to write decompressed file");

    set_executable_permissions(destination);
}

fn set_executable_permissions(path: &PathBuf) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = fs::metadata(path).expect("Failed to get metadata");
        let mut perms = metadata.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(path, perms).expect("Failed to set permissions");
    }
}
