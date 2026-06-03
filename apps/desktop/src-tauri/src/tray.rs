use tauri::{
    AppHandle, Runtime,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
    Manager,
};

pub fn build_tray<R: Runtime>(app: &tauri::App<R>) -> Result<tauri::tray::TrayIcon<R>, tauri::Error> {
    let open = MenuItem::with_id(app, "open", "Open Clinic Portal", true, None::<&str>)?;
    let backup = MenuItem::with_id(app, "backup", "Backup Now", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit ConciergeOS", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&open, &backup, &settings, &separator, &quit])?;

    let tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("ConciergeOS — Clinic Server")
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "open" => {
                if let Err(e) = open::that("http://localhost:5173") {
                    eprintln!("Failed to open: {}", e);
                }
            }
            "backup" => {
                println!("Backup triggered");
            }
            "settings" => {
                if let Some(window) = app.get_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(tray)
}
