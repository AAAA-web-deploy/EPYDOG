import { createServer } from 'node:http'
import path from 'node:path'
import { createApp } from './createApp.ts'
import { resolveDashboardPassword } from './passwordPolicy.ts'
import { serveStatic } from './static.ts'

const dataDir = process.env.EEPY_DATA_DIR ?? path.join(process.cwd(), 'data')
const dist = path.resolve(process.env.EEPY_DIST ?? 'out')
const port = Number(process.env.PORT ?? 4173)
const host = process.env.HOST ?? '127.0.0.1'
const trustProxy = process.env.TRUST_PROXY === '1'
const trustedProxies = (process.env.TRUSTED_PROXIES ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'https://aaaa-web-deploy.github.io')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

let bootstrapPassword: string
try {
  bootstrapPassword = resolveDashboardPassword(process.env.DASHBOARD_PASSWORD, trustProxy)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

const app = createApp({
  dataDir,
  bootstrapPassword,
  nodeEnv: process.env.NODE_ENV ?? 'production',
  trustProxy,
  trustedProxies,
  trustedIpHeader: process.env.TRUSTED_IP_HEADER ?? 'cf-connecting-ip',
  allowedOrigins,
})

const server = createServer((req, res) => {
  const url = req.url ?? '/'
  if (url.startsWith('/api/')) {
    void app.handle(req, res)
    return
  }
  serveStatic(req, res, dist)
})

server.on('error', (error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : error)
  console.error('The Eepy Dog server could not listen. Choose another PORT if this one is already in use.')
  app.close()
  process.exit(1)
})

server.listen(port, host, () => {
  console.log(`Eepy Dog server listening on http://${host}:${port}/`)
  console.log(`Dashboard: http://${host}:${port}/dashboard/`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close()
    app.close()
  })
}
