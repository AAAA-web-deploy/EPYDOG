import { sanitizeImage } from './images.js'
import { decodeMeta, encodeMeta, findPhoto, listPrefix, movePhoto, photoKey, releaseUpload, reserveUpload } from './store.js'
import { verifyTurnstile } from './turnstile.js'

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const MAX_BYTES = 5 * 1024 * 1024
const DEFAULT_ORIGIN = 'https://aaaa-web-deploy.github.io'

function allowlist(env) {
  const configured = (env.ALLOWED_ORIGINS || DEFAULT_ORIGIN).split(',').map((item) => item.trim()).filter(Boolean)
  return configured.length ? configured : [DEFAULT_ORIGIN]
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || ''
  const headers = {
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'access-control-max-age': '86400',
    vary: 'Origin',
    'x-content-type-options': 'nosniff',
  }
  if (allowlist(env).includes(origin)) headers['access-control-allow-origin'] = origin
  return headers
}

function json(request, env, status, payload, extra = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders(request, env), ...extra },
  })
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown'
}

function originDenied(request, env) {
  const origin = request.headers.get('Origin')
  return Boolean(origin && !allowlist(env).includes(origin))
}

async function authorized(request, env) {
  const header = request.headers.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!env.MODERATION_TOKEN || token.length !== env.MODERATION_TOKEN.length) return false
  const encoder = new TextEncoder()
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(token)),
    crypto.subtle.digest('SHA-256', encoder.encode(env.MODERATION_TOKEN)),
  ])
  const a = new Uint8Array(left)
  const b = new Uint8Array(right)
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

function cleanText(value, max, label, required) {
  const text = String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim()
  if (required && !text) throw new Error(`Enter ${label}.`)
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer.`)
  if (/[<>]/.test(text)) throw new Error(`${label} cannot include HTML.`)
  return text
}

function publicPhoto(meta) {
  return {
    id: meta.id,
    dogName: meta.dogName,
    displayName: meta.displayName,
    caption: meta.caption,
    createdAt: meta.createdAt,
  }
}

function downloadName(id, ext) {
  const safe = id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80) || 'photo'
  return `sleepy-dog-${safe}.${ext}`
}

async function readUpload(request) {
  const length = Number(request.headers.get('content-length') || 0)
  if (length > MAX_BYTES + 256 * 1024) throw Object.assign(new Error('The photo must be 5 MB or smaller.'), { status: 413 })
  const form = await request.formData()
  const file = form.get('file')
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') throw new Error('Choose a photo first.')
  if (file.size > MAX_BYTES) throw Object.assign(new Error('The photo must be 5 MB or smaller.'), { status: 413 })
  const dogName = cleanText(form.get('dogName'), 48, 'a dog name', true)
  const displayName = cleanText(form.get('displayName'), 40, 'The display name', false) || 'a sleepy dog parent'
  const caption = cleanText(form.get('caption'), 220, 'The caption', false)
  if (form.get('consent') !== 'yes') throw new Error('Confirm that you own this photo and allow public display and downloading.')
  const turnstileToken = String(form.get('turnstileToken') || '')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) throw Object.assign(new Error('The photo must be 5 MB or smaller.'), { status: 413 })
  const image = sanitizeImage(bytes)
  return { image, dogName, displayName, caption, turnstileToken }
}

async function createPending(request, env) {
  if (!env.MODERATION_TOKEN || env.MODERATION_TOKEN.length < 16) {
    return json(request, env, 503, { ok: false, stored: false, error: 'Photo storage is not fully configured. Nothing was stored.' })
  }
  let upload
  try {
    upload = await readUpload(request)
  } catch (error) {
    const status = error && error.status ? error.status : 400
    return json(request, env, status, { ok: false, stored: false, error: error instanceof Error ? error.message : 'Upload rejected.' })
  }
  const ip = clientIp(request)
  const human = await verifyTurnstile(env, upload.turnstileToken, ip)
  if (!human.ok) return json(request, env, 403, { ok: false, stored: false, error: human.error })
  const quota = await reserveUpload(env.PHOTOS, env, ip)
  if (!quota.ok) return json(request, env, 429, { ok: false, stored: false, error: quota.error })
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const meta = encodeMeta({
    id,
    dogName: upload.dogName,
    displayName: upload.displayName,
    caption: upload.caption,
    createdAt,
    consent: 'yes',
    downloadAllowed: true,
  })
  const key = photoKey('pending', id, upload.image.ext)
  try {
    await env.PHOTOS.put(key, upload.image.body, {
      httpMetadata: { contentType: upload.image.contentType, cacheControl: 'private, no-store' },
      customMetadata: { 'x-sdc-meta': meta },
    })
    const head = await env.PHOTOS.head(key)
    if (!head || head.size !== upload.image.body.byteLength) {
      await env.PHOTOS.delete(key)
      await releaseUpload(env.PHOTOS, quota.key, quota.previous)
      return json(request, env, 502, { ok: false, stored: false, error: 'Storage did not confirm the photo. Nothing was kept.' })
    }
  } catch (error) {
    await env.PHOTOS.delete(key)
    await releaseUpload(env.PHOTOS, quota.key, quota.previous)
    return json(request, env, 502, { ok: false, stored: false, error: error instanceof Error ? error.message : 'Upload failed before it was stored.' })
  }
  return json(request, env, 201, { ok: true, stored: true, id, status: 'pending' })
}

async function serveApproved(request, env, id, download) {
  const found = await findPhoto(env.PHOTOS, 'approved', id)
  if (!found || !decodeMeta(found.object)) return json(request, env, 404, { error: 'That photo is not published.' })
  const headers = {
    ...corsHeaders(request, env),
    'content-type': found.contentType,
    'cache-control': 'public, max-age=60',
    'x-content-type-options': 'nosniff',
  }
  if (download) headers['content-disposition'] = `attachment; filename="${downloadName(id, found.ext)}"`
  return new Response(found.object.body, { status: 200, headers })
}

async function createReport(request, env) {
  let payload
  try { payload = await request.json() } catch { payload = null }
  if (!payload || typeof payload !== 'object') return json(request, env, 400, { ok: false, error: 'Report could not be read.' })
  const photoId = String(payload.photoId || '')
  if (!ID_PATTERN.test(photoId)) return json(request, env, 400, { ok: false, error: 'Choose a published photo to report.' })
  let reason
  try { reason = cleanText(payload.reason || 'Please remove this photo', 140, 'The report', true) }
  catch (error) { return json(request, env, 400, { ok: false, error: error instanceof Error ? error.message : 'Report rejected.' }) }
  const human = await verifyTurnstile(env, String(payload.turnstileToken || ''), clientIp(request))
  if (!human.ok) return json(request, env, 403, { ok: false, error: human.error })
  const approved = await findPhoto(env.PHOTOS, 'approved', photoId)
  if (!approved) return json(request, env, 404, { ok: false, error: 'Only published photos can be reported.' })
  const id = crypto.randomUUID()
  const report = { id, photoId, reason, createdAt: new Date().toISOString() }
  const key = `reports/${id}.json`
  await env.PHOTOS.put(key, JSON.stringify(report), { httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' } })
  const head = await env.PHOTOS.head(key)
  if (!head) return json(request, env, 502, { ok: false, error: 'The report was not stored.' })
  return json(request, env, 201, { ok: true, stored: true, id })
}

async function requireAdmin(request, env) {
  if (await authorized(request, env)) return null
  return json(request, env, 401, { error: 'Owner access is required.' })
}

async function listReports(bucket) {
  const reports = []
  let cursor
  do {
    const page = await bucket.list({ prefix: 'reports/', cursor })
    for (const object of page.objects) {
      if (!object.key.endsWith('.json') || reports.length >= 100) continue
      const file = await bucket.get(object.key)
      if (!file) continue
      try { reports.push(JSON.parse(await file.text())) } catch { /* skip unreadable report objects */ }
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor && reports.length < 100)
  reports.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return reports
}

export default {
  async fetch(request, env) {
    if (!env.PHOTOS) return json(request, env, 503, { error: 'Photo storage is not connected.' })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) })
    if (originDenied(request, env)) return json(request, env, 403, { error: 'This website is not allowed to call the photo service.' })
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const photoMatch = path.match(/^\/api\/photos\/([0-9a-f-]{36})(\/download)?$/)
    const adminPhoto = path.match(/^\/api\/admin\/photos\/([0-9a-f-]{36})\/(approve|reject|remove)$/)
    const pendingFile = path.match(/^\/api\/admin\/pending\/([0-9a-f-]{36})$/)

    try {
      if (request.method === 'POST' && path === '/api/uploads') return await createPending(request, env)
      if (request.method === 'GET' && path === '/api/photos') {
        const photos = await listPrefix(env.PHOTOS, 'approved')
        const limit = Math.min(48, Math.max(1, Number(url.searchParams.get('limit') || 24)))
        const cursor = url.searchParams.get('cursor') || ''
        const cursorIndex = cursor ? photos.findIndex((photo) => photo.id === cursor) : -1
        const start = cursorIndex >= 0 ? cursorIndex + 1 : 0
        const page = photos.slice(start, start + limit).map(publicPhoto)
        const nextCursor = start + limit < photos.length ? page[page.length - 1]?.id || null : null
        return json(request, env, 200, { photos: page, nextCursor })
      }
      if (request.method === 'GET' && photoMatch && ID_PATTERN.test(photoMatch[1])) {
        return await serveApproved(request, env, photoMatch[1], Boolean(photoMatch[2]))
      }
      if (request.method === 'POST' && path === '/api/reports') return await createReport(request, env)

      if (path.startsWith('/api/admin')) {
        const denied = await requireAdmin(request, env)
        if (denied) return denied
        if (request.method === 'GET' && path === '/api/admin/pending') {
          const photos = (await listPrefix(env.PHOTOS, 'pending')).map(publicPhoto)
          return json(request, env, 200, { photos })
        }
        if (request.method === 'GET' && pendingFile && ID_PATTERN.test(pendingFile[1])) {
          const found = await findPhoto(env.PHOTOS, 'pending', pendingFile[1])
          if (!found || !decodeMeta(found.object)) return json(request, env, 404, { error: 'That pending photo was not found.' })
          return new Response(found.object.body, {
            headers: { 'content-type': found.contentType, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
          })
        }
        if (request.method === 'GET' && path === '/api/admin/reports') {
          return json(request, env, 200, { reports: await listReports(env.PHOTOS) })
        }
        if (request.method === 'POST' && adminPhoto && ID_PATTERN.test(adminPhoto[1])) {
          const id = adminPhoto[1]
          const action = adminPhoto[2]
          const moved = action === 'approve'
            ? await movePhoto(env.PHOTOS, id, 'pending', 'approved', { approvedAt: new Date().toISOString() })
            : action === 'reject'
              ? await movePhoto(env.PHOTOS, id, 'pending', 'rejected', { rejectedAt: new Date().toISOString() })
              : await movePhoto(env.PHOTOS, id, 'approved', 'rejected', { removedAt: new Date().toISOString() })
          if (!moved.ok) return json(request, env, moved.status, { ok: false, error: moved.error })
          return json(request, env, 200, { ok: true, id, status: action === 'approve' ? 'approved' : 'rejected' })
        }
      }
      return json(request, env, 404, { error: 'Not found.' })
    } catch (error) {
      return json(request, env, 500, { ok: false, stored: false, error: error instanceof Error ? error.message : 'Photo service failed.' })
    }
  },
}
