import { randomUUID } from 'node:crypto'

export function normalizeRequestId(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const trimmed = value.trim().slice(0, 128)
  return trimmed || null
}

export function getRequestIdFromHeaders(
  headers: Pick<Headers, 'get'>,
  {
    generate = false,
  }: {
    generate?: boolean
  } = {}
): string {
  const normalized = normalizeRequestId(headers.get('x-request-id'))
  if (normalized) {
    return normalized
  }
  if (generate) {
    return randomUUID()
  }
  return 'unknown'
}
