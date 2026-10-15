//! Document file I/O. Paths always come from native open/save dialogs or the
//! recent-documents list, so commands accept absolute paths as-is.

use base64::Engine;
use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::ipc::Response;

pub type CmdResult<T> = Result<T, String>;

pub fn err(context: &str, e: impl std::fmt::Display) -> String {
    format!("{context}: {e}")
}

/// Writes through a sibling temp file and renames it over the target, so a crash
/// or full disk mid-write never leaves a half-written document behind.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "document".into());
    let tmp: PathBuf = path.with_file_name(format!(".{file_name}.plutotmp"));
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    fs::rename(&tmp, path).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    path: String,
    name: String,
    size: u64,
    modified_ms: u64,
    readonly: bool,
}

pub fn modified_ms(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Reads a text document. Strips a UTF-8 BOM and falls back to lossy decoding for
/// legacy encodings rather than refusing to open the file.
#[tauri::command]
pub fn read_text_file(path: String) -> CmdResult<String> {
    let bytes = fs::read(&path).map_err(|e| err("Could not read file", e))?;
    let body = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(&bytes);
    Ok(match std::str::from_utf8(body) {
        Ok(s) => s.to_owned(),
        Err(_) => String::from_utf8_lossy(body).into_owned(),
    })
}

/// Reads a binary document (.docx). Returned as a raw IPC payload, which the
/// frontend receives as an ArrayBuffer without JSON encoding overhead.
#[tauri::command]
pub fn read_binary_file(path: String) -> CmdResult<Response> {
    fs::read(&path)
        .map(Response::new)
        .map_err(|e| err("Could not read file", e))
}

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> CmdResult<()> {
    atomic_write(Path::new(&path), contents.as_bytes()).map_err(|e| err("Could not save file", e))
}

#[tauri::command]
pub fn write_binary_file(path: String, base64: String) -> CmdResult<()> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64.as_bytes())
        .map_err(|e| err("Invalid file data", e))?;
    atomic_write(Path::new(&path), &bytes).map_err(|e| err("Could not save file", e))
}

#[tauri::command]
pub fn file_info(path: String) -> CmdResult<FileInfo> {
    let meta = fs::metadata(&path).map_err(|e| err("File not found", e))?;
    let name = Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    Ok(FileInfo {
        size: meta.len(),
        modified_ms: modified_ms(&meta),
        readonly: meta.permissions().readonly(),
        path,
        name,
    })
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).is_file()
}
