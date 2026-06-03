use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum ServiceStatus {
    #[serde(rename = "up")]
    Up,
    #[serde(rename = "down")]
    Down,
    #[serde(rename = "degraded")]
    Degraded,
    #[serde(rename = "checking")]
    Checking,
}

#[derive(Debug, Clone, Serialize)]
pub struct HealthState {
    pub postgres: ServiceStatus,
    pub redis: ServiceStatus,
    pub minio: ServiceStatus,
    pub api: ServiceStatus,
    pub sync: ServiceStatus,
}

pub async fn check_all() -> HealthState {
    let api_status = check_api().await;

    if api_status == ServiceStatus::Up {
        HealthState {
            postgres: ServiceStatus::Up,
            redis: ServiceStatus::Up,
            minio: ServiceStatus::Up,
            api: ServiceStatus::Up,
            sync: ServiceStatus::Up,
        }
    } else {
        HealthState {
            postgres: ServiceStatus::Checking,
            redis: ServiceStatus::Checking,
            minio: ServiceStatus::Checking,
            api: ServiceStatus::Down,
            sync: ServiceStatus::Degraded,
        }
    }
}

async fn check_api() -> ServiceStatus {
    let client = reqwest::Client::new();
    match client
        .get("http://localhost:8000/api/health")
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => ServiceStatus::Up,
        Ok(_) => ServiceStatus::Degraded,
        Err(_) => ServiceStatus::Down,
    }
}
