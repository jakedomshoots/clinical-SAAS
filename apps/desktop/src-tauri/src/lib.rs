pub mod tray;
pub mod supervisor;
pub mod health;

use tauri::{Manager, Emitter};
use tray::build_tray;
use supervisor::Supervisor;
use std::sync::Mutex;

struct AppState {
    supervisor: Mutex<Option<Supervisor>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            supervisor: Mutex::new(None),
        })
        .setup(|app| {
            let tray = build_tray(app)?;
            tray.set_show_menu_on_left_click(false)?;

            // Start the process supervisor
            let supervisor = Supervisor::new();
            let app_handle = app.handle().clone();
            tokio::spawn(async move {
                supervisor.run(app_handle).await;
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                window.hide().unwrap_or_default();
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_portal,
            restart_service,
            get_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ConciergeOS");
}

#[tauri::command]
fn open_portal() {
    if let Err(e) = open::that("http://localhost:5173") {
        eprintln!("Failed to open portal: {}", e);
    }
}

#[tauri::command]
fn restart_service(service: String) -> Result<String, String> {
    Ok(format!("Restarting {}...", service))
}

#[tauri::command]
fn get_status() -> serde_json::Value {
    serde_json::json!({
        "postgres": "checking",
        "redis": "checking",
        "minio": "checking",
        "api": "checking",
        "sync": "up"
    })
}
