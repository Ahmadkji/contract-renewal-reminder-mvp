import { createHmac, timingSafeEqual } from 'node:crypto'

export interface SignatureVerificationResult {
  valid: boolean
  reason?: string
}

interface ParsedSignatureHeader {
  timestamp?: number
  signatures: string[]
}

function parseSignatureHeader(signatureHeader: string): ParsedSignatureHeader {
  const trimmed = signatureHeader.trim()
  if (!trimmed) {
    return { signatures: [] }
  }

  if (!trimmed.includes('=')) {
    return { signatures: [trimmed] }
  }

  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean)
  let timestamp: number | undefined
  const signatures: string[] = []

  for (const part of parts) {
    const [key, value] = part.split('=')
    if (!key || !value) continue

    if (key === 't') {
      const parsed = Number.parseInt(value, 10)
      if (Number.isFinite(parsed)) {
        timestamp = parsed
      }
      continue
    }

    if (key === 'v1' || key === 'sig' || key === 'signature') {
      signatures.push(value)
    }
  }

  return { timestamp, signatures }
}

function toComparableBuffer(value: string): Buffer {
  const normalized = value.trim()

  // Prefer hex when it looks like hex, otherwise fall back to utf-8 compare.
  if (/^[a-fA-F0-9]+$/.test(normalized) && normalized.length % 2 === 0) {
    return Buffer.from(normalized, 'hex')
  }

  return Buffer.from(normalized)
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = toComparableBuffer(left)
  const rightBuffer = toComparableBuffer(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function createDigest(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function verifyCreemWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
  maxAgeSeconds: number = 300
): SignatureVerificationResult {
  if (!secret) {
    return { valid: false, reason: 'Missing webhook secret' }
  }

  if (!signatureHeader) {
    return { valid: false, reason: 'Missing signature header' }
  }

  const parsed = parseSignatureHeader(signatureHeader)
  if (parsed.signatures.length === 0) {
    return { valid: false, reason: 'No signatures found in header' }
  }

  if (parsed.timestamp) {
    const currentSeconds = Math.floor(Date.now() / 1000)
    const ageSeconds = Math.abs(currentSeconds - parsed.timestamp)
    if (ageSeconds > maxAgeSeconds) {
      return { valid: false, reason: 'Signature timestamp is outside accepted window' }
    }
  }

  const candidatePayloads = parsed.timestamp
    ? [`${parsed.timestamp}.${rawBody}`, rawBody]
    : [rawBody]

  const expectedSignatures = candidatePayloads.map((payload) => createDigest(secret, payload))

  const matches = parsed.signatures.some((receivedSignature) =>
    expectedSignatures.some((expectedSignature) => safeCompare(receivedSignature, expectedSignature))
  )

  return matches
    ? { valid: true }
    : { valid: false, reason: 'Signature mismatch' }
}
