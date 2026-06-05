export const API_PREFIX = '/api';

export const ROUTES = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    ME: '/api/auth/me',
  },
  PATIENTS: '/api/patients',
  PATIENT: (id: string) => `/api/patients/${id}`,
  PATIENT_CHART_SUMMARY: (id: string) => `/api/patients/${id}/chart-summary`,
  PATIENT_DOCUMENTS: (id: string) => `/api/patients/${id}/documents`,
  TASKS: '/api/tasks',
  TASK: (id: string) => `/api/tasks/${id}`,
  SCHEDULE: '/api/schedule',
  APPOINTMENT: (id: string) => `/api/schedule/${id}`,
  FAXES: '/api/faxes',
  FAX: (id: string) => `/api/faxes/${id}`,
  MESSAGES: '/api/messages',
  MESSAGE: (id: string) => `/api/messages/${id}`,
  THREAD: (id: string) => `/api/messages/threads/${id}`,
  WS: '/api/ws',
  HEALTH: '/api/health',
} as const;

export const WS_CHANNELS = {
  AUDIT: 'events:audit',
  TASK: 'events:task',
  FAX: 'events:fax',
  MESSAGE: 'events:message',
  SCHEDULE: 'events:schedule',
  SYSTEM: 'events:system',
} as const;
