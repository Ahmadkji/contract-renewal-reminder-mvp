import { reportError } from '@/lib/error-tracking'
import { redactRecord, redactValue } from '@/lib/observability/redaction'

type LogLevel = 'info' | 'warn' | 'error'

type LogPayload = {
  timestamp: string
  level: LogLevel
  message: string
  context: string
  data?: unknown
}

type ConsoleLike = {
  info?: (...args: unknown[]) => void
  warn?: (...args: unknown[]) => void
  error?: (...args: unknown[]) => void
}

function toConsoleLike(): ConsoleLike | null {
  if (typeof window === 'undefined') {
    return null
  }
  return (globalThis as { console?: ConsoleLike }).console || null
}

function emitServerLog(payload: LogPayload): void {
  const serialized = JSON.stringify(payload)
  if (payload.level === 'error' || payload.level === 'warn') {
    process.stderr.write(`${serialized}\n`)
    return
  }
  process.stdout.write(`${serialized}\n`)
}

function emitBrowserLog(payload: LogPayload): void {
  const browserConsole = toConsoleLike()
  if (!browserConsole) {
    return
  }

  const serialized = JSON.stringify(payload)
  if (payload.level === 'error' && typeof browserConsole.error === 'function') {
    browserConsole.error(serialized)
    return
  }
  if (payload.level === 'warn' && typeof browserConsole.warn === 'function') {
    browserConsole.warn(serialized)
    return
  }
  if (typeof browserConsole.info === 'function') {
    browserConsole.info(serialized)
  }
}

function normalizeLogArgs(args: unknown[]): { context: string; data?: unknown } {
  const first = args[0]
  if (first && typeof first === 'object' && !Array.isArray(first)) {
    const candidate = first as Record<string, unknown>
    const contextValue = candidate.context
    const context =
      typeof contextValue === 'string' && contextValue.trim().length > 0
        ? contextValue
        : 'App'
    return {
      context,
      data: redactValue(candidate),
    }
  }

  return {
    context: 'App',
    data: args.length > 0 ? redactValue(args) : undefined,
  }
}

function writeLog(level: LogLevel, message: string, context: string, data?: unknown): void {
  const payload: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    data,
  }

  if (typeof window === 'undefined') {
    emitServerLog(payload)
    return
  }

  emitBrowserLog(payload)
}

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === 'production') {
      return
    }
    const normalized = normalizeLogArgs(args)
    writeLog('info', message, normalized.context, normalized.data)
  },

  warn: (message: string, ...args: unknown[]) => {
    const normalized = normalizeLogArgs(args)
    writeLog('warn', message, normalized.context, normalized.data)
  },

  error: (message: string, error: unknown, context?: string) => {
    const normalizedContext = context?.trim() || 'App'
    const errorPayload = redactValue(error)
    writeLog('error', message, normalizedContext, errorPayload)

    reportError(message, error, normalizedContext)
  },
}

export function redactLogContext(value: Record<string, unknown>): Record<string, unknown> {
  return redactRecord(value) || {}
}
