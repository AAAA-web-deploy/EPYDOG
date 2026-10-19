import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import worker from '../src/index.js'
import { crc32, sanitizeImage } from '../src/images.js'
import { DiskR2 } from './disk-r2.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const workerRoot = path.resolve(here, '..')
const repoRoot = path.resolve(workerRoot, '../..')
const ORIGIN = 'https://aaaa-web-deploy.github.io'
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'
const ADMIN = 'test-moderation-token'

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  return Buffer.concat([length, body, crc])
}

function pngWithSecret() {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0)
  ihdr.writeUInt32BE(1, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const text = Buffer.concat([Buffer.from('Comment\0'), Buffer.from('GPS_SECRET_TEXT')])
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('tEXt', text),
    chunk('IDAT', zlib.deflateSync(Buffer.from([0, 255, 0, 0]))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function injectExif(jpeg, secret) {
  const payload = Buffer.concat([Buffer.from('Exif\0\0'), Buffer.from(secret)])
  const marker = Buffer.alloc(4 + payload.length)
  marker[0] = 0xff
  marker[1] = 0xe1
  marker.writeUInt16BE(payload.length + 2, 2)
  payload.copy(marker, 4)
  return Buffer.concat([jpeg.subarray(0, 2), marker, jpeg.subarray(2)])
}

function start(persist) {
  const env = {
    PHOTOS: new DiskR2(persist),
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    TURNSTILE_TEST_MODE: '1',
    MODERATION_TOKEN: ADMIN,
    ALLOWED_ORIGINS: ORIGIN,
    UPLOADS_PER_DAY: '3',
  }
  return {
    async fetch(pathname, options = {}) {
      const headers = new Headers(options.headers || {})
      if (!headers.has('origin')) headers.set('origin', ORIGIN)
      if (!headers.has('cf-connecting-ip')) headers.set('cf-connecting-ip', '203.0.113.10')
      return worker.fetch(new Request(`http://gallery.test${pathname}`, { ...options, headers }), env)
    },
  }
}

function form(bytes, name, type, fields = {}) {
  const body = new FormData()
  body.set('file', new Blob([bytes], { type }), name)
  body.set('dogName', fields.dogName ?? 'Mochi')
  body.set('displayName', fields.displayName ?? 'Nap person')
  body.set('caption', fields.caption ?? 'asleep on the rug')
  body.set('consent', fields.consent ?? 'yes')
  body.set('turnstileToken', fields.turnstileToken ?? TOKEN)
  return body
}

async function call(mf, pathname, options = {}) {
  const response = await mf.fetch(pathname, options)
  const type = response.headers.get('content-type') || ''
  const payload = type.includes('json') ? await response.json() : new Uint8Array(await response.arrayBuffer())
  return { status: response.status, payload, headers: response.headers }
}

test('sanitizer rejects non-images and strips embedded location text', async () => {
  const original = await readFile(path.join(repoRoot, 'public/memes/01.jpg'))
  const poisoned = injectExif(original, 'GPS_SECRET_TEXT')
  const clean = sanitizeImage(poisoned)
  assert.equal(clean.ext, 'jpg')
  assert.equal(clean.body[0], 0xff)
  assert.equal(clean.body[1], 0xd8)
  assert.equal(Buffer.from(clean.body).includes(Buffer.from('GPS_SECRET_TEXT')), false)
  sanitizeImage(clean.body)
  const png = sanitizeImage(pngWithSecret())
  assert.equal(png.ext, 'png')
  assert.equal(Buffer.from(png.body).includes(Buffer.from('GPS_SECRET_TEXT')), false)
  assert.throws(() => sanitizeImage(Buffer.from('GIF89a-not-a-photo')), /JPG, PNG, or WebP/)
})

test('local R2 keeps pending photos private until the owner approves them', async () => {
  const persist = await mkdtemp(path.join(tmpdir(), 'sdc-r2-'))
  const mf = start(persist)
  try {
    const jpeg = injectExif(await readFile(path.join(repoRoot, 'public/memes/01.jpg')), 'GPS_SECRET_TEXT')
    const created = await call(mf, '/api/uploads', { method: 'POST', body: form(jpeg, 'nap.jpg', 'image/jpeg', { dogName: 'Mochi', caption: 'deep sleep' }) })
    assert.equal(created.status, 201)
    assert.equal(created.payload.stored, true)
    const id = created.payload.id

    const hidden = await call(mf, `/api/photos/${id}`)
    assert.equal(hidden.status, 404)
    const hiddenDownload = await call(mf, `/api/photos/${id}/download`)
    assert.equal(hiddenDownload.status, 404)
    const listed = await call(mf, '/api/photos')
    assert.equal(listed.payload.photos.some((photo) => photo.dogName === 'Mochi'), false)

    const blocked = await call(mf, `/api/admin/photos/${id}/approve`, { method: 'POST', headers: { authorization: 'Bearer nope-nope-nope' } })
    assert.equal(blocked.status, 401)
    const stillHidden = await call(mf, `/api/photos/${id}`)
    assert.equal(stillHidden.status, 404)

    const pending = await call(mf, `/api/admin/pending/${id}`, { headers: { authorization: `Bearer ${ADMIN}` } })
    assert.equal(pending.status, 200)
    assert.equal(pending.payload[0], 0xff)
    assert.equal(Buffer.from(pending.payload).includes(Buffer.from('GPS_SECRET_TEXT')), false)

    const approved = await call(mf, `/api/admin/photos/${id}/approve`, { method: 'POST', headers: { authorization: `Bearer ${ADMIN}` } })
    assert.equal(approved.status, 200)
    const page = await call(mf, '/api/photos')
    assert.equal(page.payload.photos[0].id, id)
    assert.equal(page.payload.photos[0].dogName, 'Mochi')
    assert.equal(page.payload.photos[0].caption, 'deep sleep')

    const download = await call(mf, `/api/photos/${id}/download`)
    assert.equal(download.status, 200)
    assert.match(download.headers.get('content-disposition'), new RegExp(`sleepy-dog-${id}\\.jpg`))
    assert.equal(download.payload[0], 0xff)
    assert.equal(download.payload[1], 0xd8)

    const report = await call(mf, '/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: id, reason: 'Please remove this photo', turnstileToken: TOKEN }),
    })
    assert.equal(report.status, 201)
    assert.equal(report.payload.stored, true)
    const reports = await call(mf, '/api/admin/reports', { headers: { authorization: `Bearer ${ADMIN}` } })
    assert.equal(reports.payload.reports[0].photoId, id)

    const pendingReport = await call(mf, '/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: crypto.randomUUID(), reason: 'Please remove this photo', turnstileToken: TOKEN }),
    })
    assert.equal(pendingReport.status, 404)
  } finally {
    await Promise.resolve()
    await rm(persist, { recursive: true, force: true })
  }
})

test('rejects bad files, missing consent, bad human checks, foreign origins, and quota overflows', async () => {
  const persist = await mkdtemp(path.join(tmpdir(), 'sdc-r2-'))
  const mf = start(persist)
  try {
    const gif = await call(mf, '/api/uploads', { method: 'POST', body: form(Buffer.from('GIF89a not a dog'), 'dog.jpg', 'image/jpeg') })
    assert.equal(gif.status, 400)
    const html = await call(mf, '/api/uploads', { method: 'POST', body: form(await readFile(path.join(repoRoot, 'public/memes/02.jpg')), 'dog.jpg', 'image/jpeg', { dogName: '<img src=x>' }) })
    assert.equal(html.status, 400)
    const consent = await call(mf, '/api/uploads', { method: 'POST', body: form(await readFile(path.join(repoRoot, 'public/memes/02.jpg')), 'dog.jpg', 'image/jpeg', { consent: 'no' }) })
    assert.equal(consent.status, 400)
    const human = await call(mf, '/api/uploads', { method: 'POST', body: form(await readFile(path.join(repoRoot, 'public/memes/02.jpg')), 'dog.jpg', 'image/jpeg', { turnstileToken: 'not-a-token' }) })
    assert.equal(human.status, 403)
    const foreign = await call(mf, '/api/uploads', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
      body: form(await readFile(path.join(repoRoot, 'public/memes/02.jpg')), 'dog.jpg', 'image/jpeg'),
    })
    assert.equal(foreign.status, 403)
    const huge = Buffer.alloc(5 * 1024 * 1024 + 1, 0xff)
    const oversized = await call(mf, '/api/uploads', { method: 'POST', body: form(huge, 'big.jpg', 'image/jpeg') })
    assert.equal(oversized.status, 413)

    for (let index = 0; index < 3; index++) {
      const ok = await call(mf, '/api/uploads', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.20' },
        body: form(await readFile(path.join(repoRoot, 'public/memes/03.jpg')), 'dog.jpg', 'image/jpeg', { dogName: `Quota${index}` }),
      })
      assert.equal(ok.status, 201, JSON.stringify(ok.payload))
    }
    const limited = await call(mf, '/api/uploads', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '203.0.113.20' },
      body: form(await readFile(path.join(repoRoot, 'public/memes/03.jpg')), 'dog.jpg', 'image/jpeg', { dogName: 'QuotaOver' }),
    })
    assert.equal(limited.status, 429)
    const otherVisitor = await call(mf, '/api/uploads', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '203.0.113.21' },
      body: form(await readFile(path.join(repoRoot, 'public/memes/04.jpg')), 'dog.jpg', 'image/jpeg', { dogName: 'Other' }),
    })
    assert.equal(otherVisitor.status, 201)
  } finally {
    await Promise.resolve()
    await rm(persist, { recursive: true, force: true })
  }
})

test('an approved photo is still in R2 after the worker restarts', async () => {
  const persist = await mkdtemp(path.join(tmpdir(), 'sdc-r2-'))
  const first = start(persist)
  let id = ''
  try {
    const created = await call(first, '/api/uploads', { method: 'POST', body: form(await readFile(path.join(repoRoot, 'public/memes/05.jpg')), 'dog.jpg', 'image/jpeg', { dogName: 'Persistent' }) })
    assert.equal(created.status, 201)
    id = created.payload.id
    const approved = await call(first, `/api/admin/photos/${id}/approve`, { method: 'POST', headers: { authorization: `Bearer ${ADMIN}` } })
    assert.equal(approved.status, 200)
  } finally {
    await Promise.resolve()
  }
  const second = start(persist)
  try {
    const download = await call(second, `/api/photos/${id}/download`)
    assert.equal(download.status, 200)
    assert.equal(download.payload[0], 0xff)
    assert.equal(download.payload[1], 0xd8)
    const removed = await call(second, `/api/admin/photos/${id}/remove`, { method: 'POST', headers: { authorization: `Bearer ${ADMIN}` } })
    assert.equal(removed.status, 200)
    const gone = await call(second, `/api/photos/${id}`)
    assert.equal(gone.status, 404)
  } finally {
    await Promise.resolve()
    await rm(persist, { recursive: true, force: true })
  }
})

test('approved photos page newest first and keep pending photos out of the page', async () => {
  const persist = await mkdtemp(path.join(tmpdir(), 'sdc-r2-'))
  const mf = start(persist)
  try {
    const older = await call(mf, '/api/uploads', { method: 'POST', headers: { 'cf-connecting-ip': '198.51.100.8' }, body: form(await readFile(path.join(repoRoot, 'public/memes/06.jpg')), 'dog.jpg', 'image/jpeg', { dogName: 'Older' }) })
    const newer = await call(mf, '/api/uploads', { method: 'POST', headers: { 'cf-connecting-ip': '198.51.100.9' }, body: form(await readFile(path.join(repoRoot, 'public/memes/07.jpg')), 'dog.jpg', 'image/jpeg', { dogName: 'Newer' }) })
    const hidden = await call(mf, '/api/uploads', { method: 'POST', headers: { 'cf-connecting-ip': '198.51.100.10' }, body: form(await readFile(path.join(repoRoot, 'public/memes/01.jpg')), 'dog.jpg', 'image/jpeg', { dogName: 'StillPending' }) })
    assert.equal(older.status, 201)
    assert.equal(newer.status, 201)
    await call(mf, `/api/admin/photos/${older.payload.id}/approve`, { method: 'POST', headers: { authorization: `Bearer ${ADMIN}` } })
    await new Promise((resolve) => setTimeout(resolve, 5))
    await call(mf, `/api/admin/photos/${newer.payload.id}/approve`, { method: 'POST', headers: { authorization: `Bearer ${ADMIN}` } })
    const firstPage = await call(mf, '/api/photos?limit=1')
    assert.equal(firstPage.payload.photos.length, 1)
    assert.equal(firstPage.payload.photos[0].dogName, 'Newer')
    assert.equal(firstPage.payload.nextCursor, newer.payload.id)
    const secondPage = await call(mf, `/api/photos?limit=1&cursor=${firstPage.payload.nextCursor}`)
    assert.equal(secondPage.payload.photos[0].dogName, 'Older')
    assert.equal(secondPage.payload.photos.some((photo) => photo.dogName === 'StillPending'), false)
    assert.equal(hidden.status, 201)
    const pendingView = await call(mf, `/api/photos/${hidden.payload.id}`)
    assert.equal(pendingView.status, 404)
  } finally {
    await rm(persist, { recursive: true, force: true })
  }
})
