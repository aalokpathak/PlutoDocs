mod files;
mod pdf;
mod store;

use files::CmdResult;
use serde::Serialize;
use std::path::PathBuf;
use store::Store;
use tauri::window::{Effect, EffectsBuilder};
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    version: String,
    /// Running as a portable build: all data is kept next to the executable.
    portable: bool,
    data_dir: String,
    /// True when the window was created with the Windows 11 Mica backdrop.
    mica: bool,
    /// Document passed on the command line (e.g. double-clicking a .pluto file).
    launch_file: Option<String>,
    /// Debug builds only: folder for the frontend's native smoke test.
    selftest_dir: Option<String>,
}

/// A build is portable when the executable's name contains "portable" (as the
/// release script names it) or a `portable` marker file sits next to it.
fn portable_data_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let stem = exe.file_stem()?.to_string_lossy().to_lowercase();
    let marked = dir.join("portable").exists() || dir.join("portable.txt").exists();
    (stem.contains("portable") || marked).then(|| dir.join("PlutoDocs Data"))
}

/// Windows 11 starts at build 22000; earlier builds have no Mica, and a
/// transparent window without a backdrop would be see-through.
fn supports_mica() -> bool {
    #[cfg(windows)]
    {
        windows_version::OsVersion::current().build >= 22000
    }
    #[cfg(not(windows))]
    {
        false
    }
}

fn launch_file() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| !a.starts_with('-') && std::path::Path::new(a).is_file())
}

#[tauri::command]
fn get_app_info(info: State<'_, AppInfo>) -> AppInfo {
    info.inner().clone()
}

#[tauri::command]
fn open_data_folder(app: AppHandle, store: State<'_, Store>) -> CmdResult<()> {
    app.opener()
        .open_path(store.data_dir.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn reveal_in_explorer(app: AppHandle, path: String) -> CmdResult<()> {
    app.opener().reveal_item_in_dir(path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let portable_dir = portable_data_dir();
            let data_dir = match &portable_dir {
                Some(dir) => dir.clone(),
                None => app.path().app_data_dir()?,
            };
            let mica = cfg!(windows) && supports_mica();

            app.manage(Store::new(data_dir.clone()));
            app.manage(AppInfo {
                version: app.package_info().version.to_string(),
                portable: portable_dir.is_some(),
                data_dir: data_dir.to_string_lossy().into_owned(),
                mica,
                launch_file: launch_file(),
                selftest_dir: if cfg!(debug_assertions) { std::env::var("PLUTODOCS_SELFTEST_DIR").ok() } else { None },
            });

            let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("PlutoDocs")
                .inner_size(1360.0, 880.0)
                .min_inner_size(900.0, 600.0)
                .center()
                .decorations(false)
                .shadow(true)
                .resizable(true)
                // Tauri's native file-drop handler disables HTML5 drag and drop on Windows,
                // which the editor needs for moving text, pictures and dropped files.
                .disable_drag_drop_handler();
            if let Some(dir) = &portable_dir {
                // Keep WebView2's profile (local storage, caches) with the portable app too.
                builder = builder.data_directory(dir.join("WebView"));
            }
            if mica {
                builder = builder
                    .transparent(true)
                    .effects(EffectsBuilder::new().effect(Effect::Mica).build());
            }
            // On small screens the default size would run under the taskbar.
            let small_screen = app
                .primary_monitor()
                .ok()
                .flatten()
                .map(|m| {
                    let size = m.size().to_logical::<f64>(m.scale_factor());
                    size.width < 1360.0 + 40.0 || size.height < 880.0 + 80.0
                })
                .unwrap_or(false);
            builder.maximized(small_screen).build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            open_data_folder,
            reveal_in_explorer,
            files::read_text_file,
            files::read_binary_file,
            files::write_text_file,
            files::write_binary_file,
            files::file_info,
            files::path_exists,
            store::recent_list,
            store::recent_add,
            store::recent_remove,
            store::recent_pin,
            store::recent_clear,
            store::recovery_write,
            store::recovery_list,
            store::recovery_clear,
            store::revision_create,
            store::revision_list,
            store::revision_read,
            store::revision_delete,
            store::revisions_migrate,
            pdf::export_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PlutoDocs");
}
