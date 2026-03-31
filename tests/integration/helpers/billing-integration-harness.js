/* eslint-disable no-console */

const http = require('node:http')
const { spawn } = require('node:child_process')

const APP_HOST = 'localhost'
const READY_TIMEOUT_MS = 120_000

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientNetworkError(error) {
  const message = String(error instanceof Error ? error.message : error).toLowerCase()
  return (
    message.includes('fetch failed') ||
    message.includes('enotfound') ||
    message.includes('connect timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('eai_again') ||
    message.includes('und_err')
  )
}

async function withRetries(label, fn, { attempts = 4, delayMs = 500 } = {}) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isTransientNetworkError(error) || attempt === attempts) {
        throw error
      }
      console.warn(`[retry] ${label} attempt ${attempt}/${attempts}: ${error instanceof Error ? error.message : String(error)}`)
      await sleep(delayMs * attempt)
    }
  }

  throw lastError || new Error(`Unknown retry failure: ${label}`)
}

async function waitForAppReady(appUrl) {
  const startedAtMs = Date.now()
  let lastError = null
  const healthPaths = ['/api/health', '/api']

  while (Date.now() - startedAtMs < READY_TIMEOUT_MS) {
    for (const path of healthPaths) {
      try {
        const response = await fetch(`${appUrl}${path}`, { method: 'GET' })
        if (response.ok) {
          return
        }
        lastError = new Error(`health check status ${response.status} for ${path}`)
      } catch (error) {
        lastError = error
      }
    }

    await sleep(1000)
  }

  throw new Error(`Next app did not become ready in time: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

async function startMockBillingProvider({ port }) {
  const state = {
    checkouts: [],
    portals: [],
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing URL' }))
        return
      }

      const body = await readRequestBody(req)
      const payload = body ? JSON.parse(body) : {}

      if (req.method === 'POST' && req.url === '/v1/checkouts') {
        state.checkouts.push(payload)
        const id = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            id,
            checkout_url: `https://checkout.creem.io/session/${id}`,
            status: 'created',
          })
        )
        return
      }

      if (req.method === 'POST' && req.url === '/v1/customers/billing') {
        state.portals.push(payload)
        const id = `portal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            id,
            customer_portal_link: `https://billing.creem.io/portal/${id}`,
          })
        )
        return
      }

      if (req.method === 'GET' && req.url.startsWith('/v1/subscriptions/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            id: req.url.split('/').pop(),
            status: 'active',
          })
        )
        return
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'mock server error',
        })
      )
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, APP_HOST, () => resolve())
  })

  return {
    baseUrl: `http://${APP_HOST}:${port}`,
    state,
    stop: async () => {
      await new Promise((resolve) => server.close(() => resolve()))
    },
  }
}

async function readRequestBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function startNextApp({ appPort, creemApiBaseUrl }) {
  const appUrl = `http://${APP_HOST}:${appPort}`
  const env = {
    ...process.env,
    NEXT_PUBLIC_APP_URL: appUrl,
    CREEM_API_BASE_URL: creemApiBaseUrl,
    CREEM_API_KEY: process.env.CREEM_API_KEY || 'test-creem-key',
    FORCE_COLOR: '0',
  }

  const child = spawn('node', ['./node_modules/next/dist/bin/next', 'dev', '-p', String(appPort)], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[next] ${chunk}`)
  })
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[next:err] ${chunk}`)
  })

  await waitForAppReady(appUrl)

  return {
    appUrl,
    stop: async () => {
      await new Promise((resolve) => {
        let resolved = false
        const finish = () => {
          if (!resolved) {
            resolved = true
            resolve()
          }
        }

        child.once('exit', finish)
        child.kill('SIGINT')
        setTimeout(() => {
          try {
            child.kill('SIGKILL')
          } catch {}
          finish()
        }, 10_000)
      })
    },
  }
}

async function startBillingRuntime({
  appPort = Number(process.env.BILLING_TEST_APP_PORT || 3200),
  mockPort = Number(process.env.BILLING_TEST_CREEM_PORT || 4200),
} = {}) {
  const mock = await startMockBillingProvider({ port: mockPort })
  try {
    const nextApp = await startNextApp({
      appPort,
      creemApiBaseUrl: mock.baseUrl,
    })

    return {
      appUrl: nextApp.appUrl,
      mockState: mock.state,
      stop: async () => {
        await nextApp.stop()
        await mock.stop()
      },
    }
  } catch (error) {
    await mock.stop().catch(() => undefined)
    throw error
  }
}

function buildTestIp() {
  return `198.51.100.${Math.floor(Math.random() * 200) + 1}`
}

async function createTestUser({ email, password }) {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

  const response = await withRetries(
    `create test user ${email}`,
    () =>
      fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
        }),
      }),
    { attempts: 5, delayMs: 700 }
  )

  const bodyText = await response.text()
  if (!response.ok) {
    throw new Error(`Failed to create test user (${response.status}): ${bodyText}`)
  }

  const data = JSON.parse(bodyText)
  if (!data?.id) {
    throw new Error(`Failed to create test user: missing id in response (${bodyText})`)
  }

  return data.id
}

async function deleteTestUser(userId) {
  if (!userId) return

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return
  }

  await withRetries(
    `delete test user ${userId}`,
    () =>
      fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      }),
    { attempts: 4, delayMs: 500 }
  ).catch(() => undefined)
}

module.exports = {
  buildTestIp,
  createTestUser,
  deleteTestUser,
  requiredEnv,
  startBillingRuntime,
}
