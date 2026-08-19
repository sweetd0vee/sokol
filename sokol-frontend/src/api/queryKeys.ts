export const queryKeys = {
  checks: ['checks'] as const,
  check: (id: string | number | undefined) => ['check', id] as const,
  checkBySerial: (serial: string) => ['check', 'by-serial', serial] as const,
  recommendations: ['recommendations'] as const,
  recommendation: (id: string | number | undefined) => ['recommendation', id] as const,
  capabilities: ['capabilities'] as const,
  users: ['users'] as const,
  settings: {
    auditors: ['settings', 'auditors'] as const,
    departments: ['settings', 'departments'] as const,
    auditTypes: ['settings', 'audit-types'] as const,
    checkKinds: ['settings', 'check-kinds'] as const,
    effectivenessRatings: ['settings', 'effectiveness-ratings'] as const,
  },
  analytics: {
    checksBootstrap: ['analytics', 'checks', 'bootstrap'] as const,
    recommendationsBootstrap: ['analytics', 'recommendations', 'bootstrap'] as const,
    monitoringBootstrap: ['analytics', 'monitoring', 'bootstrap'] as const,
    dvaBootstrap: ['analytics', 'dva', 'bootstrap'] as const,
    planningBootstrap: ['analytics', 'planning', 'bootstrap'] as const,
  },
};
