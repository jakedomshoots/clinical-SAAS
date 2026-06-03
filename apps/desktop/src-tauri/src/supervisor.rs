use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};
use tauri::{AppHandle, Emitter};

pub struct Supervisor {
    _handle: Arc<Mutex<()>>,
}

impl Supervisor {
    pub fn new() -> Self {
        Supervisor {
            _handle: Arc::new(Mutex::new(())),
        }
    }

    pub async fn run(&self, app_handle: AppHandle) {
        let mut check_interval = interval(Duration::from_secs(5));
        loop {
            check_interval.tick().await;
            let health_status = health::check_all().await;
            let _ = app_handle.emit("service-status", health_status.clone());
            let _ = app_handle.emit("tray-status", health_status);
        }
    }
}
