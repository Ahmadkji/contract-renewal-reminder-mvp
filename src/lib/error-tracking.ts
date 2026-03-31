import { redactRecord, redactValue } from '@/lib/observability/redaction'

type ErrorTrackingPayload = {
  level: 'error'
  message: string
  context: string
  timestamp: string
  environment: string
  runtime: 'server' | 'browser'
  error: {
    name: string
    message: string
    stack?: string
  }
}

declare global {
  interface Window {
    Sentry?: {
      captureException?: (error: unknown, context?: Record<string, unknown>) => void
    }
  }
}

function toErrorLike(value: unknown): { name: string; message: string; stack?: string } {
  if (value instanceof Error) {
    return {
      name: value.name || 'Error',
      message: String(redactValue(value.message || 'Unknown error')),
      stack:
        typeof value.stack === 'string'
          ? String(redactValue(value.stack.slice(0, 4000)))
          : undefined,
    }
  }

  if (typeof value === 'string') {
    return {
      name: 'Error',
      message: String(redactValue(value)),
    }
  }

  return {
    name: 'UnknownError',
    message: (() => {
      try {
        return String(redactValue(JSON.stringify(value)))
      } catch {
        return String(redactValue(String(value)))
      }
    })(),
  }
}

function getErrorWebhookUrl(): string | null {
  if (typeof window !== 'undefined') {
    return null
  }

  return process.env.ERROR_TRACKING_WEBHOOK_URL || null
}

function getAlertWebhookUrl(): string | null {
  if (typeof window !== 'undefined') {
    return null
  }

  return process.env.ALERTING_WEBHOOK_URL || null
}

async function postToWebhook(url: string | null, payload: unknown): Promise<void> {
  const webhookUrl = url
  if (!webhookUrl) {
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(redactValue(payload)),
      signal: controller.signal,
      // keepalive helps browser flush telemetry during page lifecycle transitions.
      keepalive: true,
    })
  } catch {
    // Error reporting must never throw into request/UX flow.
  } finally {
    clearTimeout(timeout)
  }
}

export function reportError(message: string, error: unknown, context: string): void {
  if (typeof window !== 'undefined') {
    if (window.Sentry?.captureException) {
      try {
        window.Sentry.captureException(error, {
          tags: {
            context,
          },
          extra: {
            message: redactValue(message),
          },
        })
      } catch {
        // Browser telemetry should never interrupt the user flow.
      }
    }

    return
  }

  const payload: ErrorTrackingPayload = {
    level: 'error',
    message: String(redactValue(message)),
    context: String(redactValue(context)),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    runtime: typeof window === 'undefined' ? 'server' : 'browser',
    error: toErrorLike(error),
  }

  void postToWebhook(getErrorWebhookUrl(), payload)

  if ((process.env.NODE_ENV || 'development') === 'production') {
    const alertPayload = redactRecord({
      severity: 'critical',
      source: context,
      message,
      timestamp: payload.timestamp,
      runtime: payload.runtime,
    })
    void postToWebhook(getAlertWebhookUrl(), alertPayload)
  }
}
