export type ClientErrorSource = 'boundary' | 'window' | 'unhandledrejection';

export type ClientErrorReport = {
  source: ClientErrorSource;
  message: string;
  stack?: string;
  requestId?: string;
};

export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function reportClientError(report: ClientErrorReport): void {
  const payload = {
    ...report,
    ts: new Date().toISOString(),
    href: typeof window === 'undefined' ? '' : window.location.href,
  };
  console.error('[sokol]', payload);
  const sink = import.meta.env.VITE_ERROR_REPORT_URL;
  if (!sink || typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return;
  }
  try {
    navigator.sendBeacon(sink, JSON.stringify(payload));
  } catch {
    // Reporting must never break the UI.
  }
}

export function installClientErrorHandlers(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.addEventListener('error', (event) => {
    reportClientError({
      source: 'window',
      message: event.message || 'window.error',
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportClientError({
      source: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason ?? 'unhandledrejection'),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
