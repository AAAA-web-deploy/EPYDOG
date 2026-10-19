/** Owner-only moderation. Reads GALLERY_API_URL and MODERATION_TOKEN from the environment. */
const api = (process.env.GALLERY_API_URL || '').replace(/\/$/, '')
const token = process.env.MODERATION_TOKEN || ''
const [command, id, outputPath] = process.argv.slice(2)

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!api || !token) fail('Set GALLERY_API_URL and MODERATION_TOKEN in your terminal. Do not put the token in the website or in this chat.')
if (token.length < 16) fail('MODERATION_TOKEN must be at least 16 characters.')

const photoId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
if (['file', 'approve', 'reject', 'remove'].includes(command) && !photoId.test(id || '')) {
  fail('That photo id is not a valid id. Copy it from the pending list.')
}

async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...(options.headers || {}) },
  })
  const type = response.headers.get('content-type') || ''
  const payload = type.includes('json') ? await response.json() : await response.arrayBuffer()
  if (!response.ok) fail(typeof payload === 'object' && payload && 'error' in payload ? payload.error : `Request failed (${response.status}).`)
  return payload
}

if (command === 'pending') {
  const payload = await request('/api/admin/pending')
  if (!payload.photos.length) console.log('No pending photos.')
  for (const photo of payload.photos) console.log(`${photo.id}\t${photo.createdAt}\t${photo.dogName}\t${photo.caption}`)
} else if (command === 'file' && id) {
  const bytes = Buffer.from(await request(`/api/admin/pending/${id}`))
  if (!outputPath) fail('Usage: moderate.mjs file <id> <output-file>')
  const { writeFile } = await import('node:fs/promises')
  await writeFile(outputPath, bytes)
  console.log(`Saved ${outputPath}`)
} else if (command === 'approve' && id) {
  console.log(JSON.stringify(await request(`/api/admin/photos/${id}/approve`, { method: 'POST' })))
} else if (command === 'reject' && id) {
  console.log(JSON.stringify(await request(`/api/admin/photos/${id}/reject`, { method: 'POST' })))
} else if (command === 'remove' && id) {
  console.log(JSON.stringify(await request(`/api/admin/photos/${id}/remove`, { method: 'POST' })))
} else if (command === 'reports') {
  const payload = await request('/api/admin/reports')
  if (!payload.reports.length) console.log('No reports.')
  for (const report of payload.reports) console.log(`${report.createdAt}\t${report.photoId}\t${report.reason}`)
} else {
  fail('Usage: node services/photo-worker/scripts/moderate.mjs <pending|file|approve|reject|remove|reports> [id] [output-file]')
}
