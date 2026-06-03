use tauri::Manager;
use tray::build_tray;
use supervisor::Supervisor;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let tray = build_tray(app)?;
            tray.set_show_menu_on_left_click(false)?;

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
        .invoke_handler(tauri::generate_handler![open_portal])
        .run(tauri::generate_context!())
        .expect("error while running ConciergeOS");
}

#[tauri::command]
fn open_portal() {
    if let Err(e) = open::that("http://localhost:5173") {
        eprintln!("Failed to open portal: {}", e);
    }
}
