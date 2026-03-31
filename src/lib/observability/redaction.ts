const REDACTED_VALUE = '[REDACTED]'
const SENSITIVE_KEY_PATTERN =
  /(password|passcode|secret|token|authorization|cookie|api[_-]?key|session|credential)/i

function redactString(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi, 'Bearer [REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function redactValue(value: unknown, depth: number = 0): unknown {
  if (depth > 6) {
    return '[TRUNCATED]'
  }

  if (typeof value === 'string') {
    return redactString(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1))
  }

  if (isPlainObject(value)) {
    const redactedEntries = Object.entries(value).map(([key, innerValue]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, REDACTED_VALUE] as const
      }
      return [key, redactValue(innerValue, depth + 1)] as const
    })
    return Object.fromEntries(redactedEntries)
  }

  return value
}

export function redactRecord(
  value: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined
  }

  return redactValue(value) as Record<string, unknown>
}
