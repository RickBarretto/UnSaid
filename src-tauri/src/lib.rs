use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct Session {
    projects: Mutex<HashSet<PathBuf>>,
    media: Mutex<HashSet<PathBuf>>,
}

#[derive(Serialize)]
struct NativeMedia {
    path: String,
    name: String,
    size: u64,
}
#[derive(Serialize, Deserialize)]
struct ProjectText {
    path: Option<String>,
    text: String,
}

fn display(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}
fn canonical_target(path: &Path) -> Result<PathBuf, String> {
    if path.exists() {
        return fs::canonicalize(path).map_err(|e| e.to_string());
    }
    let parent = path.parent().ok_or("Path has no parent")?;
    let name = path.file_name().ok_or("Path has no filename")?;
    Ok(fs::canonicalize(parent)
        .map_err(|e| e.to_string())?
        .join(name))
}
fn media_info(app: &AppHandle, session: &Session, path: PathBuf) -> Result<NativeMedia, String> {
    let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err("Media must be a file".into());
    }
    app.asset_protocol_scope()
        .allow_file(&path)
        .map_err(|e| e.to_string())?;
    session
        .media
        .lock()
        .map_err(|e| e.to_string())?
        .insert(path.clone());
    Ok(NativeMedia {
        path: display(&path),
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        size: metadata.len(),
    })
}
fn selected_path(path: tauri_plugin_dialog::FilePath) -> Result<PathBuf, String> {
    path.into_path().map_err(|e| e.to_string())
}
#[tauri::command]
async fn pick_media(
    app: AppHandle,
    session: State<'_, Session>,
) -> Result<Option<NativeMedia>, String> {
    let selected = app
        .dialog()
        .file()
        .add_filter(
            "Media",
            &[
                "mp4", "mov", "m4v", "webm", "ogv", "ogg", "mp3", "wav", "m4a",
            ],
        )
        .blocking_pick_file();
    selected
        .map(|p| media_info(&app, &session, selected_path(p)?))
        .transpose()
}
#[tauri::command]
fn load_media(
    app: AppHandle,
    session: State<'_, Session>,
    path: String,
) -> Result<NativeMedia, String> {
    media_info(&app, &session, PathBuf::from(path))
}
// Analysis needs the complete file, independent of webview asset fetch behavior.
#[tauri::command]
async fn read_media(
    session: State<'_, Session>,
    path: String,
) -> Result<tauri::ipc::Response, String> {
    use std::io::Read;
    const LIMIT: u64 = 256 * 1024 * 1024;
    let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
    if !session
        .media
        .lock()
        .map_err(|e| e.to_string())?
        .contains(&path)
    {
        return Err("Choose the source media before analyzing it".into());
    }
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    if file.metadata().map_err(|e| e.to_string())?.len() > LIMIT {
        return Err(
            "Audio analysis supports files up to 256 MiB. Playback is still available.".into(),
        );
    }
    let mut bytes = Vec::new();
    file.take(LIMIT + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > LIMIT {
        return Err(
            "Audio analysis supports files up to 256 MiB. Playback is still available.".into(),
        );
    }
    Ok(tauri::ipc::Response::new(bytes))
}
#[tauri::command]
async fn pick_project(
    app: AppHandle,
    session: State<'_, Session>,
) -> Result<Option<ProjectText>, String> {
    let Some(selected) = app
        .dialog()
        .file()
        .add_filter("UnSaid project", &["json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let path = fs::canonicalize(selected_path(selected)?).map_err(|e| e.to_string())?;
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    session
        .projects
        .lock()
        .map_err(|e| e.to_string())?
        .insert(path.clone());
    Ok(Some(ProjectText {
        path: Some(display(&path)),
        text,
    }))
}
#[tauri::command]
async fn choose_project_path(
    app: AppHandle,
    session: State<'_, Session>,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file().add_filter("UnSaid project", &["json"]);
    if let Some(default) = default_path {
        let path = Path::new(&default);
        if let Some(parent) = path.parent() {
            dialog = dialog.set_directory(parent);
        }
        if let Some(name) = path.file_name() {
            dialog = dialog.set_file_name(name.to_string_lossy());
        }
    }
    let Some(selected) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = canonical_target(&selected_path(selected)?)?;
    session
        .projects
        .lock()
        .map_err(|e| e.to_string())?
        .insert(path.clone());
    Ok(Some(display(&path)))
}
fn atomic_write(path: &Path, text: &str) -> Result<(), String> {
    let parent = path.parent().ok_or("Path has no parent")?;
    let mut attempt = 0u32;
    loop {
        let temp = parent.join(format!(
            ".unsaid-{}-{}-{}.tmp",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| e.to_string())?
                .as_nanos(),
            attempt
        ));
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)
        {
            Ok(mut file) => {
                let result = (|| {
                    file.write_all(text.as_bytes())?;
                    file.sync_all()?;
                    drop(file);
                    fs::rename(&temp, path)
                })();
                if result.is_err() {
                    let _ = fs::remove_file(&temp);
                }
                return result.map_err(|e| e.to_string());
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists && attempt < 10 => attempt += 1,
            Err(e) => return Err(e.to_string()),
        }
    }
}
#[tauri::command]
fn write_project(session: State<'_, Session>, path: String, text: String) -> Result<(), String> {
    write_authorized(&session, Path::new(&path), &text)
}
fn write_authorized(session: &Session, path: &Path, text: &str) -> Result<(), String> {
    let path = canonical_target(path)?;
    if !session
        .projects
        .lock()
        .map_err(|e| e.to_string())?
        .contains(&path)
    {
        return Err("Project path has not been chosen in this session".into());
    }
    if session
        .media
        .lock()
        .map_err(|e| e.to_string())?
        .contains(&path)
    {
        return Err("Cannot overwrite source media".into());
    }
    atomic_write(&path, text)
}
fn recovery_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("recovery.json"))
}
#[tauri::command]
fn read_recovery(app: AppHandle) -> Result<Option<ProjectText>, String> {
    match fs::read(recovery_path(&app)?) {
        Ok(bytes) => {
            let recovery: ProjectText =
                serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
            Ok(available_recovery(recovery))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
// Only suppress recovery when both timestamps are valid and the saved project is
// at least as new. Missing, unreadable, or malformed files must remain recoverable.
fn updated_at(text: &str) -> Option<f64> {
    let value: serde_json::Value = serde_json::from_str(text).ok()?;
    value.get("updatedAt")?.as_f64().filter(|n| n.is_finite())
}
fn available_recovery(mut recovery: ProjectText) -> Option<ProjectText> {
    let saved_is_current = recovery
        .path
        .as_ref()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|saved| Some((updated_at(&saved)?, updated_at(&recovery.text)?)))
        .is_some_and(|(saved, recovered)| saved >= recovered);
    if saved_is_current {
        return None;
    }
    // A path from a previous session does not grant permission to overwrite it.
    recovery.path = None;
    Some(recovery)
}
#[tauri::command]
fn write_recovery(app: AppHandle, path: Option<String>, text: String) -> Result<(), String> {
    let data = serde_json::to_string(&ProjectText { path, text }).map_err(|e| e.to_string())?;
    atomic_write(&recovery_path(&app)?, &data)
}
#[tauri::command]
fn clear_recovery(app: AppHandle) -> Result<(), String> {
    match fs::remove_file(recovery_path(&app)?) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
#[tauri::command]
fn resolve_source(project_path: String, source_path: String) -> Result<String, String> {
    let source = Path::new(&source_path);
    let path = if source.is_absolute() {
        source.to_path_buf()
    } else {
        Path::new(&project_path)
            .parent()
            .ok_or("Project path has no parent")?
            .join(source)
    };
    Ok(display(&path))
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Session::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            pick_media,
            load_media,
            read_media,
            pick_project,
            choose_project_path,
            write_project,
            read_recovery,
            write_recovery,
            clear_recovery,
            resolve_source
        ])
        .run(tauri::generate_context!())
        .expect("error running UnSaid");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "unsaid-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&dir).unwrap();
        dir
    }

    #[test]
    fn atomic_write_replaces_complete_contents() {
        let dir = temp_dir();
        let path = dir.join("project.json");
        fs::write(&path, "old contents").unwrap();
        atomic_write(&path, "new").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "new");
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 1);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn project_write_requires_authorization_and_never_overwrites_media() {
        let dir = temp_dir();
        let path = dir.join("media.mp4");
        fs::write(&path, "original").unwrap();
        let path = fs::canonicalize(path).unwrap();
        let session = Session::default();
        assert!(write_authorized(&session, &path, "project").is_err());
        session.projects.lock().unwrap().insert(path.clone());
        session.media.lock().unwrap().insert(path.clone());
        assert!(write_authorized(&session, &path, "project").is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "original");
        session.media.lock().unwrap().clear();
        write_authorized(&session, &path, "project").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "project");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn recovery_suppresses_only_a_current_saved_project() {
        let dir = temp_dir();
        let path = dir.join("project.json");
        let recovery = || ProjectText {
            path: Some(display(&path)),
            text: r#"{"updatedAt":10}"#.into(),
        };
        fs::write(&path, r#"{"updatedAt":10}"#).unwrap();
        assert!(available_recovery(recovery()).is_none());
        fs::write(&path, r#"{"updatedAt":9}"#).unwrap();
        assert!(available_recovery(recovery()).unwrap().path.is_none());
        fs::write(&path, "invalid").unwrap();
        assert!(available_recovery(recovery()).is_some());
        fs::remove_file(&path).unwrap();
        assert!(available_recovery(recovery()).is_some());
        fs::remove_dir_all(dir).unwrap();
    }
}
