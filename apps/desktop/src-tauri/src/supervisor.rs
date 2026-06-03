use std::process::{Child, Command};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};
use tauri::{AppHandle, Emitter};

pub struct Supervisor {
    processes: Arc<Mutex<Vec<Child>>>,
}

impl Supervisor {
    pub fn new() -> Self {
        Supervisor {
            processes: Arc::new(Mutex::new(Vec::new())),
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

    fn cleanup_processes(&self) {
        tokio::task::block_in_place(|| {
            let mut processes = self.processes.blocking_lock();
            for child in processes.iter_mut() {
                let _ = child.kill();
                let _ = child.wait();
            }
            processes.clear();
        });
    }
}

impl Drop for Supervisor {
    fn drop(&mut self) {
        self.cleanup_processes();
    }
}
