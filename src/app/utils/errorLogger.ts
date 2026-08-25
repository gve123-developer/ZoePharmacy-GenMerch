/**
 * errorLogger.ts
 * Installs global window error handlers that automatically send
 * unhandled JavaScript errors / promise rejections to the backend
 * error_logs table for easy debugging.
 *
 * Call installErrorLogger() once — in main.tsx or App.tsx.
 */

const API = '/api/error_logs.php';

interface ErrorPayload {
  level: string;
  message: string;
  file?: string;
  line?: number;
  stackTrace?: string;
  url?: string;
  userName?: string;
  extra?: Record<string, unknown>;
}

async function sendErrorToBackend(payload: ErrorPayload): Promise<void> {
  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        url: payload.url ?? window.location.href,
      }),
    });
  } catch {
    // Silently ignore — if the backend is down we don't want more errors
  }
}

export function logClientError(
  message: string,
  extra?: Record<string, unknown>,
  userName?: string
): void {
  const stack = new Error().stack ?? '';
  sendErrorToBackend({
    level: 'error',
    message,
    stackTrace: stack,
    url: window.location.href,
    userName,
    extra,
  });
  console.error('[logClientError]', message, extra);
}

export function installErrorLogger(getCurrentUser?: () => string | undefined): void {
  // ── 1. Uncaught synchronous JS errors ─────────────────────────────────────
  window.onerror = (
    message: string | Event,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
  ): boolean => {
    const msg = typeof message === 'string' ? message : String(message);
    sendErrorToBackend({
      level: 'error',
      message: msg,
      file: source,
      line: lineno,
      stackTrace: error?.stack,
      userName: getCurrentUser?.(),
      extra: { colno },
    });
    return false; // Let browser handle normally too
  };

  // ── 2. Unhandled Promise rejections ───────────────────────────────────────
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason);

    sendErrorToBackend({
      level: 'unhandled_rejection',
      message: `Unhandled Promise Rejection: ${message}`,
      stackTrace: reason instanceof Error ? reason.stack : undefined,
      userName: getCurrentUser?.(),
    });
  });

  // ── 3. React error boundary companion (call from componentDidCatch) ────────
  // See usage in ErrorBoundary component

  console.info('[errorLogger] Global error logger installed.');
}
