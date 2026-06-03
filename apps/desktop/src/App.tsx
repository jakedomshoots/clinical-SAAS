import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Database, HardDrive, Server, Globe,
  CheckCircle, XCircle, AlertTriangle, Loader2,
  ExternalLink, RotateCw,
} from 'lucide-react';

type ServiceStatus = 'up' | 'down' | 'degraded' | 'checking';

interface ServiceState {
  postgres: ServiceStatus;
  redis: ServiceStatus;
  minio: ServiceStatus;
  api: ServiceStatus;
  sync: ServiceStatus;
}

const CHECK_INTERVAL = 5000;

export function App() {
  const [services, setServices] = useState<ServiceState>({
    postgres: 'checking',
    redis: 'checking',
    minio: 'checking',
    api: 'checking',
    sync: 'up',
  });

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        setServices((s) => ({ ...s, api: 'up', postgres: 'up', redis: 'up', minio: 'up' }));
      } else {
        setServices((s) => ({ ...s, api: 'degraded' }));
      }
      setServices((s) => ({ ...s, sync: 'up' }));
    } catch {
      setServices((s) => ({ ...s, api: 'down', sync: 'degraded' }));
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const overallStatus: ServiceStatus =
    Object.values(services).every((s) => s === 'up') ? 'up'
      : Object.values(services).some((s) => s === 'down') ? 'down'
      : 'degraded';

  const StatusIcon = ({ status }: { status: ServiceStatus }) => {
    if (status === 'up') return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    if (status === 'down') return <XCircle className="h-4 w-4 text-red-500" />;
    if (status === 'degraded') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <Loader2 className="h-4 w-4 animate-spin text-clinic-400" />;
  };

  const services_list: { key: keyof ServiceState; label: string; icon: typeof Activity }[] = [
    { key: 'postgres', label: 'Database', icon: Database },
    { key: 'redis', label: 'Cache', icon: Server },
    { key: 'minio', label: 'Storage', icon: HardDrive },
    { key: 'api', label: 'API Server', icon: Globe },
    { key: 'sync', label: 'Cloud Sync', icon: RotateCw },
  ];

  return (
    <div style={{ maxWidth: '360px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <Activity className="h-6 w-6 text-accent-600" />
        <div>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>ConciergeOS</h1>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
            System {overallStatus}
          </p>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {services_list.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon className="h-4 w-4 text-clinic-400" />
              <span style={{ fontSize: '13px', color: '#334155' }}>{label}</span>
            </div>
            <StatusIcon status={services[key]} />
          </div>
        ))}
      </div>

      <button
        onClick={() => window.open('http://localhost:5173', '_blank')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          width: '100%', marginTop: '12px', padding: '10px',
          background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px',
          fontSize: '14px', fontWeight: 500, cursor: 'pointer',
        }}
      >
        <ExternalLink className="h-4 w-4" />
        Open Clinic Portal
      </button>

      <div style={{ marginTop: '12px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
        v0.0.1 • Local-First Healthcare OS
      </div>
    </div>
  );
}
