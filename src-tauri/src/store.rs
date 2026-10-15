//! App-owned persistence: recent documents, crash-recovery autosaves and
//! revision snapshots. Everything lives under the app data directory, which in
//! portable mode sits next to the executable instead of in %APPDATA%.

use crate::files::{atomic_write, err, modified_ms, CmdResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

const MAX_RECENT: usize = 40;

pub struct Store {
    pub data_dir: PathBuf,
    /// Serializes read-modify-write cycles on the JSON index files.
    lock: Mutex<()>,
}

impl Store {
    pub fn new(data_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&data_dir);
        Self { data_dir, lock: Mutex::new(()) }
    }

    fn recent_path(&self) -> PathBuf {
        self.data_dir.join("recent.json")
    }

    fn recovery_dir(&self) -> PathBuf {
        self.data_dir.join("recovery")
    }

    fn revisions_dir(&self, doc_id: &str) -> CmdResult<PathBuf> {
        Ok(self.data_dir.join("revisions").join(check_id(doc_id)?))
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Document and revision ids become file names, so they must not be able to
/// escape their directory.
fn check_id(id: &str) -> CmdResult<&str> {
    let ok = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if ok {
        Ok(id)
    } else {
        Err(format!("Invalid id: {id}"))
    }
}

fn read_json<T: for<'de> Deserialize<'de> + Default>(path: &Path) -> T {
    fs::read(path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> CmdResult<()> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|e| err("Serialize", e))?;
    atomic_write(path, &bytes).map_err(|e| err("Could not write app data", e))
}

// ------------------------------------------------------------------ recent

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecentDoc {
    path: String,
    name: String,
    opened_ms: u64,
    #[serde(default)]
    pinned: bool,
    /// Filled in on listing; not persisted meaningfully.
    #[serde(default)]
    exists: bool,
}

fn same_path(a: &str, b: &str) -> bool {
    // Windows paths are case-insensitive.
    a.eq_ignore_ascii_case(b)
}

#[tauri::command]
pub fn recent_list(store: State<'_, Store>) -> Vec<RecentDoc> {
    let _g = store.lock.lock().unwrap();
    let mut list: Vec<RecentDoc> = read_json(&store.recent_path());
    for doc in &mut list {
        doc.exists = Path::new(&doc.path).is_file();
    }
    list
}

#[tauri::command]
pub fn recent_add(store: State<'_, Store>, path: String) -> CmdResult<()> {
    let _g = store.lock.lock().unwrap();
    let mut list: Vec<RecentDoc> = read_json(&store.recent_path());
    let pinned = list.iter().any(|d| same_path(&d.path, &path) && d.pinned);
    list.retain(|d| !same_path(&d.path, &path));
    let name = Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.clone());
    list.insert(0, RecentDoc { path, name, opened_ms: now_ms(), pinned, exists: true });
    // Trim the oldest unpinned entries.
    while list.len() > MAX_RECENT {
        match list.iter().rposition(|d| !d.pinned) {
            Some(i) => {
                list.remove(i);
            }
            None => break,
        }
    }
    write_json(&store.recent_path(), &list)
}

#[tauri::command]
pub fn recent_remove(store: State<'_, Store>, path: String) -> CmdResult<()> {
    let _g = store.lock.lock().unwrap();
    let mut list: Vec<RecentDoc> = read_json(&store.recent_path());
    list.retain(|d| !same_path(&d.path, &path));
    write_json(&store.recent_path(), &list)
}

#[tauri::command]
pub fn recent_pin(store: State<'_, Store>, path: String, pinned: bool) -> CmdResult<()> {
    let _g = store.lock.lock().unwrap();
    let mut list: Vec<RecentDoc> = read_json(&store.recent_path());
    for d in list.iter_mut().filter(|d| same_path(&d.path, &path)) {
        d.pinned = pinned;
    }
    write_json(&store.recent_path(), &list)
}

#[tauri::command]
pub fn recent_clear(store: State<'_, Store>) -> CmdResult<()> {
    let _g = store.lock.lock().unwrap();
    let mut list: Vec<RecentDoc> = read_json(&store.recent_path());
    list.retain(|d| d.pinned);
    write_json(&store.recent_path(), &list)
}

// ------------------------------------------------------------------ crash recovery

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryEntry {
    doc_id: String,
    modified_ms: u64,
    /// The frontend-defined autosave payload (a serialized .pluto document).
    payload: String,
}

/// Background autosave of the working copy. Written frequently, removed once the
/// document is saved or deliberately discarded; anything left on startup was
/// interrupted by a crash or forced shutdown.
#[tauri::command]
pub fn recovery_write(store: State<'_, Store>, doc_id: String, payload: String) -> CmdResult<()> {
    let path = store.recovery_dir().join(format!("{}.pluto", check_id(&doc_id)?));
    atomic_write(&path, payload.as_bytes()).map_err(|e| err("Autosave failed", e))
}

#[tauri::command]
pub fn recovery_list(store: State<'_, Store>) -> Vec<RecoveryEntry> {
    let Ok(entries) = fs::read_dir(store.recovery_dir()) else {
        return Vec::new();
    };
    let mut out: Vec<RecoveryEntry> = entries
        .flatten()
        .filter_map(|e| {
            let path = e.path();
            if path.extension()? != "pluto" {
                return None;
            }
            let doc_id = path.file_stem()?.to_string_lossy().into_owned();
            let meta = e.metadata().ok()?;
            let payload = fs::read_to_string(&path).ok()?;
            Some(RecoveryEntry { doc_id, modified_ms: modified_ms(&meta), payload })
        })
        .collect();
    out.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    out
}

#[tauri::command]
pub fn recovery_clear(store: State<'_, Store>, doc_id: String) -> CmdResult<()> {
    let path = store.recovery_dir().join(format!("{}.pluto", check_id(&doc_id)?));
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(err("Could not clear autosave", e)),
    }
}

// ------------------------------------------------------------------ revisions

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RevisionInfo {
    id: String,
    created_ms: u64,
    label: String,
    words: u32,
    size: u64,
}

fn revision_index(dir: &Path) -> PathBuf {
    dir.join("index.json")
}

/// Stores a revision snapshot and prunes the oldest ones beyond `max_keep`.
#[tauri::command]
pub fn revision_create(
    store: State<'_, Store>,
    doc_id: String,
    label: String,
    words: u32,
    payload: String,
    max_keep: Option<usize>,
) -> CmdResult<RevisionInfo> {
    let _g = store.lock.lock().unwrap();
    let dir = store.revisions_dir(&doc_id)?;
    let created_ms = now_ms();
    let id = format!("r{created_ms}");
    atomic_write(&dir.join(format!("{id}.pluto")), payload.as_bytes())
        .map_err(|e| err("Could not save revision", e))?;

    let info = RevisionInfo { id, created_ms, label, words, size: payload.len() as u64 };
    let mut index: Vec<RevisionInfo> = read_json(&revision_index(&dir));
    index.insert(0, info.clone());
    let keep = max_keep.unwrap_or(50).max(1);
    for old in index.drain(keep.min(index.len())..) {
        let _ = fs::remove_file(dir.join(format!("{}.pluto", old.id)));
    }
    write_json(&revision_index(&dir), &index)?;
    Ok(info)
}

#[tauri::command]
pub fn revision_list(store: State<'_, Store>, doc_id: String) -> CmdResult<Vec<RevisionInfo>> {
    let _g = store.lock.lock().unwrap();
    Ok(read_json(&revision_index(&store.revisions_dir(&doc_id)?)))
}

#[tauri::command]
pub fn revision_read(store: State<'_, Store>, doc_id: String, revision_id: String) -> CmdResult<String> {
    let path = store
        .revisions_dir(&doc_id)?
        .join(format!("{}.pluto", check_id(&revision_id)?));
    fs::read_to_string(path).map_err(|e| err("Could not read revision", e))
}

#[tauri::command]
pub fn revision_delete(store: State<'_, Store>, doc_id: String, revision_id: String) -> CmdResult<()> {
    let _g = store.lock.lock().unwrap();
    let dir = store.revisions_dir(&doc_id)?;
    let _ = fs::remove_file(dir.join(format!("{}.pluto", check_id(&revision_id)?)));
    let mut index: Vec<RevisionInfo> = read_json(&revision_index(&dir));
    index.retain(|r| r.id != revision_id);
    write_json(&revision_index(&dir), &index)
}

/// Moves revision history when an untitled document is saved for the first time
/// (its id changes from a session id to one derived from the file path).
#[tauri::command]
pub fn revisions_migrate(store: State<'_, Store>, from: String, to: String) -> CmdResult<()> {
    let _g = store.lock.lock().unwrap();
    let src = store.revisions_dir(&from)?;
    let dst = store.revisions_dir(&to)?;
    if !src.is_dir() || src == dst {
        return Ok(());
    }
    if !dst.exists() {
        return fs::rename(&src, &dst).map_err(|e| err("Could not move history", e));
    }
    // Merge into the existing history of the target file.
    let mut merged: Vec<RevisionInfo> = read_json(&revision_index(&dst));
    let moved: Vec<RevisionInfo> = read_json(&revision_index(&src));
    for r in moved {
        let name = format!("{}.pluto", r.id);
        if fs::rename(src.join(&name), dst.join(&name)).is_ok() {
            merged.push(r);
        }
    }
    merged.sort_by(|a, b| b.created_ms.cmp(&a.created_ms));
    write_json(&revision_index(&dst), &merged)?;
    let _ = fs::remove_dir_all(&src);
    Ok(())
}
