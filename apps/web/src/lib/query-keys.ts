export const API_PREFIX = '/api';

export const ROUTES = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    ME: '/api/auth/me',
  },
  PATIENTS: '/api/patients',
  PATIENT: (id: string) => `/api/patients/${id}`,
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

export const QUERY_KEYS = {
  PATIENTS: ['patients'] as const,
  PATIENT: (id: string) => ['patients', id] as const,
  PATIENT_CHART_SUMMARY: (id: string) => ['patients', id, 'chart-summary'] as const,
  PATIENT_DOCUMENTS: (id: string) => ['patients', id, 'documents'] as const,
  PATIENT_MEDICATIONS: (id: string) => ['patients', id, 'medications'] as const,
  PATIENT_CARE_PLAN: (id: string) => ['patients', id, 'care-plan'] as const,
  PATIENT_LABS: (id: string) => ['patients', id, 'labs'] as const,
  TASKS: ['tasks'] as const,
  TASK: (id: string) => ['tasks', id] as const,
  APPOINTMENTS: ['appointments'] as const,
  TODAY_QUEUE: ['today-queue'] as const,
  FAXES: ['faxes'] as const,
  FAX: (id: string) => ['faxes', id] as const,
  MESSAGES: ['messages'] as const,
  THREAD: (id: string) => ['messages', 'threads', id] as const,
  AUDIT: ['audit'] as const,
  READINESS: ['readiness'] as const,
  INTEGRATION_EVENTS: ['integration-events'] as const,
  USER: ['user'] as const,
} as const;
