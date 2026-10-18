import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type { AddressInfo } from 'node:net'
import { csvCell } from './csv.ts'
import { createApp, type AppOptions } from './createApp.ts'
import { maskIp, resolveVisitorIp } from './ip.ts'
import { fileInside, isDashboardPath, normalizeSitePath, withDashboardRobots } from './static.ts'
import { formatNy, startOfNyDay } from './time.ts'

const PASSWORD = 'FixturePass-1'
const BROWSER =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type Started = {
  base: string
  clock: { ms: number }
  request: (pathname: string, init?: RequestInit) => Promise<{ status: number; data: Record<string, unknown>; text: string; headers: Headers }>
  stop: () => Promise<void>
  dir: string
  app: ReturnType<typeof createApp>
}

async function start(options: Partial<AppOptions> & { password?: string } = {}): Promise<Started> {
  const dir = mkdtempSync(path.join(tmpdir(), 'byebuy-'))
  const clock = { ms: Date.parse('2026-10-12T15:00:00.000Z') }
  const { password = PASSWORD, ...rest } = options
  const app = createApp({
    dataDir: dir,
    bootstrapPassword: password,
    now: () => clock.ms,
    sleep: async () => {},
    nodeEnv: 'test',
    locate: async () => null,
    ...rest,
  })
  const server: Server = createServer((req, res) => {
    void app.handle(req, res)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address() as AddressInfo
  const cookies = new Map<string, string>()
  const base = `http://127.0.0.1:${address.port}`
  return {
    base,
    clock,
    dir,
    app,
    async request(pathname, init = {}) {
      const headers = new Headers(init.headers)
      if (!headers.has('cookie') && cookies.size) {
        headers.set('cookie', [...cookies].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('; '))
      }
      const response = await fetch(base + pathname, { ...init, headers })
      for (const line of response.headers.getSetCookie()) {
        const [pair] = line.split(';')
        const index = pair.indexOf('=')
        const name = pair.slice(0, index).trim()
        const value = decodeURIComponent(pair.slice(index + 1).trim())
        if (!value) cookies.delete(name)
        else cookies.set(name, value)
      }
      const text = await response.text()
      let data: Record<string, unknown> = {}
      if (text) {
        try {
          data = JSON.parse(text) as Record<string, unknown>
        } catch {
          data = { text }
        }
      }
      return { status: response.status, data, text, headers: response.headers }
    },
    async stop() {
      await new Promise((resolve) => server.close(resolve))
      app.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

async function csrf(session: Started): Promise<string> {
  const opened = await session.request('/api/dashboard/session')
  assert.equal(opened.status, 200)
  assert.equal(typeof opened.data.csrfToken, 'string')
  return opened.data.csrfToken as string
}

async function login(session: Started, password = PASSWORD): Promise<string> {
  const token = await csrf(session)
  const result = await session.request('/api/dashboard/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify({ password }),
  })
  assert.equal(result.status, 200, result.text)
  return result.data.csrfToken as string
}

function collect(session: Started, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return session.request('/api/analytics/collect', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': BROWSER, ...headers },
    body: JSON.stringify({ eventId: crypto.randomUUID(), path: '/', section: 'top', ...body }),
  })
}

test('New York display follows EDT and EST', () => {
  assert.match(formatNy(Date.parse('2026-10-12T15:00:00.000Z')), /EDT/)
  assert.match(formatNy(Date.parse('2026-12-12T15:00:00.000Z')), /EST/)
  assert.equal(startOfNyDay(Date.parse('2026-10-12T15:00:00.000Z')), Date.parse('2026-10-12T04:00:00.000Z'))
  assert.equal(startOfNyDay(Date.parse('2026-12-12T15:00:00.000Z')), Date.parse('2026-12-12T05:00:00.000Z'))
  assert.equal(startOfNyDay(Date.parse('2026-11-01T07:00:00.000Z')), Date.parse('2026-11-01T04:00:00.000Z'))
})

test('visitor IP ignores client JSON and untrusted forwarded headers', () => {
  assert.equal(
    resolveVisitorIp({
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.9', 'cf-connecting-ip': '203.0.113.8' },
      trustProxy: false,
      trustedProxies: [],
      trustedIpHeader: 'cf-connecting-ip',
    }),
    null,
  )
  assert.equal(
    resolveVisitorIp({
      remoteAddress: '203.0.113.8',
      headers: { 'x-forwarded-for': '198.51.100.4' },
      trustProxy: false,
      trustedProxies: [],
      trustedIpHeader: 'cf-connecting-ip',
    }),
    '203.0.113.8',
  )
  assert.equal(
    resolveVisitorIp({
      remoteAddress: '10.0.0.8',
      headers: { 'cf-connecting-ip': '203.0.113.9' },
      trustProxy: true,
      trustedProxies: ['10.0.0.8'],
      trustedIpHeader: 'cf-connecting-ip',
    }),
    '203.0.113.9',
  )
  assert.equal(
    resolveVisitorIp({
      remoteAddress: '10.0.0.8',
      headers: { 'x-forwarded-for': '203.0.113.9' },
      trustProxy: true,
      trustedProxies: ['10.0.0.8'],
      trustedIpHeader: 'cf-connecting-ip',
    }),
    null,
  )
  assert.equal(maskIp('203.0.113.9'), '203.0.***.***')
  assert.equal(maskIp(null), 'Unavailable')
})

test('csv cells neutralize formulas', () => {
  assert.equal(csvCell('=1+1'), "'=1+1")
  assert.equal(csvCell('+1'), "'+1")
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
})

test('dashboard paths stay inside the site root and are not indexed', () => {
  const root = path.resolve('dist')
  assert.equal(normalizeSitePath('/dashboard'), '/dashboard')
  assert.equal(isDashboardPath('/dashboard'), true)
  assert.equal(withDashboardRobots('<meta name="robots" content="index, follow" />'), '<meta name="robots" content="noindex, nofollow" />')
  assert.equal(fileInside(root, '/../../server/secrets.json'), null)
  const inside = fileInside(root, '/assets/app.js')
  assert.ok(inside?.startsWith(root))
})

test('password login is case-sensitive and analytics require a session', async () => {
  const session = await start()
  try {
    const token = await csrf(session)
    const wrong = await session.request('/api/dashboard/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': token },
      body: JSON.stringify({ password: PASSWORD.toLowerCase() }),
    })
    assert.equal(wrong.status, 401)
    assert.equal(wrong.data.error, 'Incorrect password. Please try again.')
    assert.equal(wrong.text.includes(PASSWORD), false)
    assert.match(wrong.headers.get('cache-control') ?? '', /no-store/)
    const missing = await session.request('/api/dashboard/analytics/summary')
    assert.equal(missing.status, 401)
    assert.equal(missing.data.error, 'Unauthorized')
    assert.equal('visits' in missing.data, false)
    const loggedIn = await login(session)
    assert.equal(typeof loggedIn, 'string')
    const summary = await session.request('/api/dashboard/analytics/summary')
    assert.equal(summary.status, 200)
    assert.equal(summary.data.estimated, true)
  } finally {
    await session.stop()
  }
})

test('login requires CSRF, logout and expiry revoke access', async () => {
  const session = await start()
  try {
    await csrf(session)
    const forged = await session.request('/api/dashboard/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ password: PASSWORD }),
    })
    assert.equal(forged.status, 403)
    await csrf(session)
    const noHeader = await session.request('/api/dashboard/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    })
    assert.equal(noHeader.status, 403)
    const next = await login(session)
    const gone = await session.request('/api/dashboard/logout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': next },
      body: '{}',
    })
    assert.equal(gone.status, 200)
    const after = await session.request('/api/dashboard/analytics/summary')
    assert.equal(after.status, 401)
    await login(session)
    session.clock.ms += 8 * 60 * 60 * 1000 + 1
    const expired = await session.request('/api/dashboard/analytics/summary')
    assert.equal(expired.status, 401)
  } finally {
    await session.stop()
  }
})

test('password changes persist across restarts and revoke sessions', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'byebuy-'))
  const clock = { ms: Date.parse('2026-10-12T15:00:00.000Z') }
  const first = createApp({ dataDir: dir, bootstrapPassword: PASSWORD, now: () => clock.ms, nodeEnv: 'test' })
  const server = createServer((req, res) => {
    void first.handle(req, res)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const cookies = new Map<string, string>()
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const request = async (pathname: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (cookies.size) headers.set('cookie', [...cookies].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('; '))
    const response = await fetch(base + pathname, { ...init, headers })
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';')
      const index = pair.indexOf('=')
      const name = pair.slice(0, index).trim()
      const value = decodeURIComponent(pair.slice(index + 1).trim())
      if (!value) cookies.delete(name)
      else cookies.set(name, value)
    }
    return { status: response.status, data: (await response.json()) as Record<string, unknown> }
  }
  try {
    const opened = await request('/api/dashboard/session')
    const logged = await request('/api/dashboard/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': String(opened.data.csrfToken) },
      body: JSON.stringify({ password: PASSWORD }),
    })
    const mismatch = await request('/api/dashboard/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': String(logged.data.csrfToken) },
      body: JSON.stringify({ currentPassword: PASSWORD, newPassword: 'Replacement-9', confirmPassword: 'other-pass' }),
    })
    assert.equal(mismatch.status, 400)
    const changed = await request('/api/dashboard/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': String(logged.data.csrfToken) },
      body: JSON.stringify({ currentPassword: PASSWORD, newPassword: 'Replacement-9', confirmPassword: 'Replacement-9' }),
    })
    assert.equal(changed.status, 200)
    assert.equal((await request('/api/dashboard/analytics/summary')).status, 401)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    first.close()
  }
  const second = createApp({ dataDir: dir, bootstrapPassword: PASSWORD, now: () => clock.ms, nodeEnv: 'test' })
  const server2 = createServer((req, res) => {
    void second.handle(req, res)
  })
  await new Promise<void>((resolve) => server2.listen(0, '127.0.0.1', () => resolve()))
  const base2 = `http://127.0.0.1:${(server2.address() as AddressInfo).port}`
  try {
    const opened = await fetch(`${base2}/api/dashboard/session`)
    const data = (await opened.json()) as { csrfToken: string }
    const cookie = opened.headers.getSetCookie()[0]?.split(';')[0] ?? ''
    const oldPassword = await fetch(`${base2}/api/dashboard/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': data.csrfToken, cookie },
      body: JSON.stringify({ password: PASSWORD }),
    })
    assert.equal(oldPassword.status, 401)
    const fresh = await fetch(`${base2}/api/dashboard/session`, { headers: { cookie } })
    const freshData = (await fresh.json()) as { csrfToken: string }
    const freshCookie = fresh.headers.getSetCookie()[0]?.split(';')[0] || cookie
    const next = await fetch(`${base2}/api/dashboard/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': freshData.csrfToken, cookie: freshCookie },
      body: JSON.stringify({ password: 'Replacement-9' }),
    })
    assert.equal(next.status, 200)
  } finally {
    await new Promise((resolve) => server2.close(resolve))
    second.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('failed logins slow down and then lock', async () => {
  const delays: number[] = []
  const session = await start({
    maxFailures: 3,
    delaySchedule: [0, 100, 200],
    sleep: async (ms) => {
      delays.push(ms)
    },
  })
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = await csrf(session)
      const result = await session.request('/api/dashboard/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({ password: 'wrong-pass' }),
      })
      assert.equal(result.status, 401)
    }
    const token = await csrf(session)
    const locked = await session.request('/api/dashboard/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': token },
      body: JSON.stringify({ password: PASSWORD }),
    })
    assert.equal(locked.status, 429)
    assert.equal(locked.data.error, 'Too many attempts. Please try again later.')
    assert.deepEqual(delays, [100, 200])
  } finally {
    await session.stop()
  }
})

test('collection dedupes retries, counts tabs once, and hides untrusted IPs', async () => {
  const session = await start({
    trustProxy: true,
    trustedProxies: ['127.0.0.1'],
    trustedIpHeader: 'cf-connecting-ip',
  })
  try {
    const eventId = crypto.randomUUID()
    const first = await collect(session, {
      eventId,
      type: 'pageview',
      referrer: 'https://Example.com/landing',
      utmSource: 'newsletter',
      utmMedium: 'email',
      utmCampaign: 'kickoff',
      ip: '198.51.100.20',
    }, { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '198.51.100.20' })
    assert.equal(first.text, '{"ok":true}')
    const retry = await collect(session, { eventId, type: 'pageview' })
    assert.equal(retry.text, '{"ok":true}')
    await collect(session, { type: 'pageview' })
    await collect(session, { type: 'heartbeat' }, {})
    await session.request('/api/analytics/heartbeat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': BROWSER },
      body: JSON.stringify({ type: 'heartbeat', eventId: crypto.randomUUID(), path: '/', section: 'edict' }),
    })
    await collect(session, { type: 'section', section: 'edict' })
    await collect(session, { type: 'click', click: 'buy' })
    const token = await login(session)
    const summary = await session.request('/api/dashboard/analytics/summary?range=today')
    assert.equal(summary.data.pageViews, 2)
    assert.equal(summary.data.browserVisitors, 1)
    assert.equal(summary.data.activeVisitors, 1)
    const trend = summary.data.trend as { label: string; visitors: number }[]
    assert.equal(trend.some((bucket) => bucket.label.includes(':')), false)
    assert.equal(
      trend.reduce((sum, bucket) => sum + bucket.visitors, 0),
      1,
    )
    assert.equal((summary.data.clicks as { buy: number }).buy, 1)
    const visits = await session.request('/api/dashboard/analytics/visits?range=today')
    const rows = visits.data.visits as { id: string; ip: string; referrer: string }[]
    assert.equal(rows[0]?.ip, '203.0.***.***')
    assert.equal(rows[0]?.referrer, 'example.com')
    assert.equal((rows[0] as { location?: string }).location, 'Unavailable')
    const revealed = await session.request(`/api/dashboard/analytics/visits/${rows[0].id}?reveal=1`)
    assert.equal(revealed.data.ip, '203.0.113.9')
    const csv = await session.request('/api/dashboard/analytics/export?range=today', {
      headers: { 'x-csrf-token': token },
    })
    assert.match(csv.headers.get('content-type') ?? '', /text\/csv/)
    assert.equal(csv.text.includes('203.0.113.9'), false)
    assert.match(csv.text, /203\.0\.\*\*\*\.\*\*\*/)
    const full = await session.request('/api/dashboard/analytics/export?range=today&reveal=1', {
      headers: { 'x-csrf-token': token },
    })
    assert.match(full.text, /203\.0\.113\.9/)
    session.clock.ms += 91_000
    const stale = await session.request('/api/dashboard/analytics/summary?range=today')
    assert.equal(stale.data.activeVisitors, 0)
    assert.equal(stale.data.pageViews, 2)
  } finally {
    await session.stop()
  }
})

test('filters, pagination, deletion, retention, bots, and refusals', async () => {
  const session = await start()
  try {
    await collect(session, { type: 'pageview', utmCampaign: 'kickoff' })
    session.clock.ms -= 23 * 60 * 60 * 1000
    await collect(session, { type: 'pageview' })
    session.clock.ms += 23 * 60 * 60 * 1000
    await collect(session, { type: 'pageview' }, { 'user-agent': 'curl/8.0.0', cookie: 'eepy_vid=botvisitoridvalue01' })
    await collect(session, { type: 'pageview' }, { dnt: '1' })
    const token = await login(session)
    const today = await session.request('/api/dashboard/analytics/summary?range=today')
    assert.equal(today.data.visits, 1)
    const day = await session.request('/api/dashboard/analytics/summary?range=24h')
    assert.equal(day.data.visits, 2)
    const campaign = await session.request('/api/dashboard/analytics/summary?range=24h&campaign=kickoff')
    assert.equal(campaign.data.visits, 1)
    const bots = await session.request('/api/dashboard/analytics/summary?range=24h&bots=1')
    assert.equal(bots.data.visits, 3)
    const refused = await session.request('/api/dashboard/analytics/summary?range=24h&bots=1&tests=1')
    assert.equal(refused.data.visits, 3)
    await session.request('/api/dashboard/logout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': token },
      body: '{}',
    })
    for (let index = 0; index < 2; index += 1) {
      session.clock.ms += 31 * 60 * 1000
      await collect(session, { type: 'pageview' })
    }
    const nextToken = await login(session)
    const paged = await session.request('/api/dashboard/analytics/visits?range=7d&pageSize=2&page=2')
    assert.equal(paged.data.total, 4)
    assert.equal((paged.data.visits as unknown[]).length, 2)
    const ids = (await session.request('/api/dashboard/analytics/visits?range=7d&pageSize=10')).data.visits as { id: string }[]
    const deleted = await session.request('/api/dashboard/analytics/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': nextToken },
      body: JSON.stringify({ ids: ids.slice(0, 1).map((row) => row.id) }),
    })
    assert.equal(deleted.data.deleted, 1)
    session.clock.ms += 31 * 24 * 60 * 60 * 1000
    session.app.purge()
    await login(session)
    const kept = await session.request('/api/dashboard/analytics/summary?range=custom&from=2026-10-01&to=2026-10-20')
    assert.equal(kept.data.visits, 0)
  } finally {
    await session.stop()
  }
})

test('the public site origin can call the API with a partitioned cookie', async () => {
  const session = await start({ allowedOrigins: ['https://byebuy.online'] })
  try {
    const first = await session.request('/api/dashboard/session', { headers: { origin: 'https://byebuy.online' } })
    assert.equal(first.status, 200)
    assert.equal(first.headers.get('access-control-allow-origin'), 'https://byebuy.online')
    assert.equal(first.headers.get('access-control-allow-credentials'), 'true')
    const setCookie = first.headers.get('set-cookie') ?? ''
    assert.match(setCookie, /SameSite=None/)
    assert.match(setCookie, /Partitioned/)
    assert.match(setCookie, /Secure/)
    const token = String(first.data.csrfToken)
    const loggedIn = await session.request('/api/dashboard/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://byebuy.online', 'x-csrf-token': token },
      body: JSON.stringify({ password: PASSWORD }),
    })
    assert.equal(loggedIn.status, 200)
    const preflight = await session.request('/api/dashboard/login', {
      method: 'OPTIONS',
      headers: { origin: 'https://byebuy.online', 'access-control-request-method': 'POST' },
    })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://byebuy.online')
  } finally {
    await session.stop()
  }
})

test('unique visitors collapse browsers that share an IP address', async () => {
  const session = await start({
    trustProxy: true,
    trustedProxies: ['127.0.0.1'],
    trustedIpHeader: 'cf-connecting-ip',
  })
  try {
    const shared = { 'cf-connecting-ip': '203.0.113.50' }
    const beat = (headers: Record<string, string>) =>
      session.request('/api/analytics/heartbeat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': BROWSER, ...headers },
        body: JSON.stringify({ type: 'heartbeat', eventId: crypto.randomUUID(), path: '/', section: 'top' }),
      })
    await collect(session, { type: 'pageview' }, shared)
    await beat(shared)
    await collect(session, { type: 'pageview' }, { ...shared, cookie: 'eepy_vid=secondvisitorcookie01' })
    await beat({ ...shared, cookie: 'eepy_vid=secondvisitorcookie01' })
    await collect(session, { type: 'pageview' }, { 'cf-connecting-ip': '203.0.113.77', cookie: 'eepy_vid=thirdvisitorcookie001' })
    await login(session)
    const summary = await session.request('/api/dashboard/analytics/summary?range=today')
    assert.equal(summary.data.visits, 3)
    assert.equal(summary.data.browserVisitors, 2)
    assert.equal(summary.data.activeVisitors, 1)
    const trend = summary.data.trend as { visitors: number }[]
    assert.equal(
      trend.reduce((sum, bucket) => sum + bucket.visitors, 0),
      2,
    )
  } finally {
    await session.stop()
  }
})

test('a repeat visit stays one person and shows a coarse location', async () => {
  const session = await start({
    trustProxy: true,
    trustedProxies: ['127.0.0.1'],
    trustedIpHeader: 'cf-connecting-ip',
    locate: async () => ({ country: 'Portugal', region: 'Lisbon', city: 'Lisbon' }),
  })
  try {
    await collect(session, { type: 'pageview' }, { 'cf-connecting-ip': '203.0.113.44' })
    session.clock.ms += 31 * 60 * 1000
    await collect(session, { type: 'pageview' }, { 'cf-connecting-ip': '203.0.113.44' })
    await login(session)
    const summary = await session.request('/api/dashboard/analytics/summary?range=today')
    assert.equal(summary.data.browserVisitors, 1)
    assert.equal(summary.data.visits, 2)
    const visits = await session.request('/api/dashboard/analytics/visits?range=today')
    const rows = visits.data.visits as { location: string }[]
    assert.equal(rows.length, 2)
    assert.equal(rows[0]?.location, 'Lisbon, Portugal')
    assert.equal(rows[1]?.location, 'Lisbon, Portugal')
  } finally {
    await session.stop()
  }
})

test('localhost production traffic is development and excluded by default', async () => {
  const session = await start({ nodeEnv: 'production' })
  try {
    await collect(session, { type: 'pageview' })
    await login(session)
    const hidden = await session.request('/api/dashboard/analytics/summary?range=today')
    assert.equal(hidden.data.visits, 0)
    const shown = await session.request('/api/dashboard/analytics/summary?range=today&tests=1')
    assert.equal(shown.data.visits, 1)
    const rows = await session.request('/api/dashboard/analytics/visits?range=today&tests=1')
    assert.equal((rows.data.visits as { classification: string }[])[0]?.classification, 'development')
  } finally {
    await session.stop()
  }
})
