const EXTENSIONS = ['jpg', 'png', 'webp']
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export function encodeMeta(meta) {
  const bytes = new TextEncoder().encode(JSON.stringify(meta))
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function decodeMeta(object) {
  const raw = object.customMetadata?.['x-sdc-meta']
  if (!raw) return null
  try {
    const binary = atob(raw)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const meta = JSON.parse(new TextDecoder().decode(bytes))
    if (!meta || meta.consent !== 'yes' || typeof meta.dogName !== 'string' || typeof meta.id !== 'string') return null
    return meta
  } catch {
    return null
  }
}

export function photoKey(prefix, id, ext) {
  return `${prefix}/${id}.${ext}`
}

export async function findPhoto(bucket, prefix, id) {
  for (const ext of EXTENSIONS) {
    const key = photoKey(prefix, id, ext)
    const object = await bucket.get(key)
    if (object) return { key, ext, object, contentType: object.httpMetadata?.contentType || TYPES[ext] }
  }
  return null
}

async function writeCopy(bucket, key, bytes, contentType, metadata) {
  await bucket.put(key, bytes, {
    httpMetadata: { contentType, cacheControl: 'private, no-store' },
    customMetadata: { 'x-sdc-meta': metadata },
  })
  const head = await bucket.head(key)
  if (!head || head.size !== bytes.byteLength) {
    await bucket.delete(key)
    return false
  }
  return true
}

export async function movePhoto(bucket, id, fromPrefix, toPrefix, patch) {
  const found = await findPhoto(bucket, fromPrefix, id)
  if (!found) return { ok: false, status: 404, error: 'That photo could not be found.' }
  const meta = decodeMeta(found.object)
  if (!meta || meta.id !== id) return { ok: false, status: 422, error: 'The stored photo metadata could not be read. It was left private.' }
  const bytes = new Uint8Array(await found.object.arrayBuffer())
  const nextMeta = encodeMeta({ ...meta, ...patch })
  const destination = photoKey(toPrefix, id, found.ext)
  const stored = await writeCopy(bucket, destination, bytes, found.contentType, nextMeta)
  if (!stored) return { ok: false, status: 500, error: 'The photo could not be moved. It is still private.' }
  await bucket.delete(found.key)
  if (await bucket.head(found.key)) {
    await bucket.delete(destination)
    return { ok: false, status: 500, error: 'The move did not finish. The photo was kept private.' }
  }
  return { ok: true, id }
}

export async function listPrefix(bucket, prefix) {
  const photos = []
  let cursor
  do {
    const page = await bucket.list({ prefix: `${prefix}/`, cursor, include: ['customMetadata', 'httpMetadata'] })
    for (const object of page.objects) {
      const source = object.customMetadata?.['x-sdc-meta'] ? object : await bucket.get(object.key)
      const meta = source ? decodeMeta(source) : null
      if (!meta) continue
      photos.push(meta)
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor && photos.length < 1000)
  photos.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return photos
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function reserveUpload(bucket, env, ip) {
  const limit = Math.min(20, Math.max(1, Number(env.UPLOADS_PER_DAY || 3)))
  const day = new Date().toISOString().slice(0, 10)
  const hash = (await sha256Hex(`${ip}\n${env.MODERATION_TOKEN}`)).slice(0, 32)
  const key = `ratelimit/upload/${hash}/${day}`
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await bucket.get(key)
    const count = current ? Number(await current.text()) : 0
    if (!Number.isFinite(count) || count >= limit) return { ok: false, error: `You have reached today’s limit of ${limit} sleeping-dog submissions. Try again tomorrow.` }
    try {
      await bucket.put(key, String(count + 1), current?.etag
        ? { onlyIf: { etagMatches: current.etag } }
        : { onlyIf: { etagDoesNotMatch: '*' } })
      return { ok: true, key, previous: count }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/precondition|etag|412/i.test(message) && attempt === 4) throw error
    }
  }
  return { ok: false, error: 'The upload queue is busy. Nothing was stored. Please try again.' }
}

export async function releaseUpload(bucket, key, previous) {
  if (!key) return
  await bucket.put(key, String(previous))
}
