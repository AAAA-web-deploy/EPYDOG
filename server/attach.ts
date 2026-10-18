import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { createApp } from './createApp.ts'

type ConnectServer = {
  middlewares: {
    use: (fn: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void) => void
  }
  httpServer: { on: (event: 'close', listener: () => void) => void } | null
}

export async function attachApi(server: ConnectServer) {
  const app = createApp({
    dataDir: path.join(process.cwd(), 'data'),
    nodeEnv: process.env.NODE_ENV ?? 'development',
  })
  server.middlewares.use((req, res, next) => {
    const url = req.url ?? ''
    if (!url.startsWith('/api/')) {
      next()
      return
    }
    void app.handle(req, res).catch(() => {
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'private, no-store')
        res.end('{"ok":false}')
      }
    })
  })
  server.httpServer?.on('close', () => app.close())
}
