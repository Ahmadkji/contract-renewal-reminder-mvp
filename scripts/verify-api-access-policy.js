#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = process.cwd()
const apiRoot = path.join(repoRoot, 'src', 'app', 'api')
const proxyPath = path.join(repoRoot, 'proxy.ts')

function walkRouteFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const routeFiles = []

  for (const entry of entries) {
    const absolute = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      routeFiles.push(...walkRouteFiles(absolute))
      continue
    }

    if (entry.isFile() && entry.name === 'route.ts') {
      routeFiles.push(absolute)
    }
  }

  return routeFiles
}

function toApiPath(routeFilePath) {
  const routeDir = path.dirname(routeFilePath)
  const relative = path.relative(apiRoot, routeDir)
  if (!relative || relative === '.') {
    return '/api'
  }

  return `/api/${relative.split(path.sep).join('/')}`
}

function parseSetLiteral(source, constName) {
  const pattern = new RegExp(
    `const\\s+${constName}\\s*=\\s*new\\s+Set\\s*\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`,
    'm'
  )
  const match = source.match(pattern)
  if (!match) {
    throw new Error(`Could not parse ${constName} from proxy.ts`)
  }

  const values = []
  const literalPattern = /'([^']+)'/g
  let literal = literalPattern.exec(match[1])
  while (literal) {
    values.push(literal[1])
    literal = literalPattern.exec(match[1])
  }

  return new Set(values)
}

function hasRouteAuthGuard(content) {
  return /(validateSession\(|auth\.getUser\(|getServerSession\(|isAuthorized\()/m.test(content)
}

function hasSessionExemptGuard(content) {
  return /(isAuthorized\(|authorization|timingSafeEqual)/m.test(content)
}

function main() {
  if (!fs.existsSync(apiRoot)) {
    throw new Error(`API directory missing: ${apiRoot}`)
  }

  if (!fs.existsSync(proxyPath)) {
    throw new Error(`proxy.ts missing: ${proxyPath}`)
  }

  const routeFiles = walkRouteFiles(apiRoot)
  const routeEntries = routeFiles.map((filePath) => ({
    filePath,
    apiPath: toApiPath(filePath),
    content: fs.readFileSync(filePath, 'utf8'),
  }))

  const routeMap = new Map(routeEntries.map((entry) => [entry.apiPath, entry]))
  const proxySource = fs.readFileSync(proxyPath, 'utf8')
  const publicApis = parseSetLiteral(proxySource, 'PUBLIC_API_EXACT_ROUTES')
  const sessionExemptApis = parseSetLiteral(proxySource, 'SESSION_EXEMPT_API_EXACT_ROUTES')

  const errors = []

  if (routeMap.has('/api')) {
    errors.push(
      'Legacy /api root route detected (src/app/api/route.ts). Use explicit /api/health route instead.'
    )
  }

  for (const apiPath of [...publicApis, ...sessionExemptApis]) {
    if (!routeMap.has(apiPath)) {
      errors.push(`Allowlisted API path has no matching route file: ${apiPath}`)
    }
  }

  for (const entry of routeEntries) {
    const { apiPath, content, filePath } = entry

    if (publicApis.has(apiPath)) {
      continue
    }

    if (sessionExemptApis.has(apiPath)) {
      if (!hasSessionExemptGuard(content)) {
        errors.push(
          `Session-exempt route must include explicit bearer/token guard: ${apiPath} (${filePath})`
        )
      }
      continue
    }

    if (apiPath.startsWith('/api/webhooks/')) {
      errors.push(
        `Webhook route must be explicitly allowlisted in PUBLIC_API_EXACT_ROUTES: ${apiPath} (${filePath})`
      )
      continue
    }

    if (apiPath.startsWith('/api/internal/')) {
      errors.push(
        `Internal route must be explicitly allowlisted in SESSION_EXEMPT_API_EXACT_ROUTES: ${apiPath} (${filePath})`
      )
      continue
    }

    if (!hasRouteAuthGuard(content)) {
      errors.push(
        `Protected API route appears to be missing auth guard (validateSession/getUser/etc): ${apiPath} (${filePath})`
      )
    }
  }

  if (errors.length > 0) {
    console.error('API access policy check failed:')
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log(
    `API access policy check passed: ${routeEntries.length} route files validated against proxy allowlists.`
  )
}

main()
