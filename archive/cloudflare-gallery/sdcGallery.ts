/** Browser client for the Cloudflare photo Worker. No storage keys and no admin token belong here. */

const apiUrl = (process.env.NEXT_PUBLIC_GALLERY_API_URL || '').replace(/\/$/, '')
export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''
export const galleryConfigured = Boolean(apiUrl)
export const uploadsReady = galleryConfigured && Boolean(turnstileSiteKey)

export type SdcPhoto = {
  id: string
  dogName: string
  displayName: string
  caption: string
  createdAt: string
  imageUrl: string
}

type PhotoResponse = {
  photos?: Array<Omit<SdcPhoto, 'imageUrl'>>
  nextCursor?: string | null
  error?: string
}

export type PhotoPage = {
  photos: SdcPhoto[]
  nextCursor: string | null
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function imageType(file: File): string {
  if (ALLOWED_TYPES.includes(file.type)) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  return ''
}

/** Canvas export strips camera EXIF/GPS before the upload leaves the browser. The Worker strips it again. */
export async function prepareDogPhoto(file: File): Promise<Blob> {
  if (!imageType(file)) throw new Error('Please choose a JPG, PNG, or WebP image.')
  if (file.size > 12 * 1024 * 1024) throw new Error('The original photo must be smaller than 12 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width < 150 || bitmap.height < 150) throw new Error('Please use a photo at least 150 × 150 pixels.')
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Your browser cannot process this image.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) throw new Error('Could not prepare the photo.')
    if (blob.size > 5 * 1024 * 1024) throw new Error('Photo is too large after processing. Try a smaller image.')
    return blob
  } finally {
    bitmap.close()
  }
}

export type UploadInput = {
  file: File
  dogName: string
  displayName: string
  caption: string
  turnstileToken: string
}

export async function listApprovedPhotos(cursor = ''): Promise<PhotoPage> {
  if (!apiUrl) return { photos: [], nextCursor: null }
  const query = new URLSearchParams({ limit: '24' })
  if (cursor) query.set('cursor', cursor)
  const response = await fetch(`${apiUrl}/api/photos?${query}`)
  const payload = await response.json().catch(() => null) as PhotoResponse | null
  if (!response.ok) throw new Error(payload?.error || 'Could not load community photos.')
  return {
    photos: (payload?.photos || []).map((photo) => ({
      ...photo,
      imageUrl: `${apiUrl}/api/photos/${encodeURIComponent(photo.id)}`,
    })),
    nextCursor: payload?.nextCursor || null,
  }
}

export function submitDogPhoto(input: UploadInput, onStage?: (stage: string) => void): Promise<void> {
  if (!apiUrl) return Promise.reject(new Error('Photo storage is not connected yet.'))
  if (!turnstileSiteKey) return Promise.reject(new Error('Uploads need a Cloudflare Turnstile site key before a photo can be sent.'))
  if (!input.turnstileToken) return Promise.reject(new Error('Please complete the human check and try again.'))
  const dogName = input.dogName.trim()
  const displayName = input.displayName.trim()
  const caption = input.caption.trim()
  if (!dogName || dogName.length > 48) return Promise.reject(new Error('Enter a dog name (1–48 characters).'))
  if (displayName.length > 40) return Promise.reject(new Error('Your display name must be 40 characters or fewer.'))
  if (caption.length > 220) return Promise.reject(new Error('Caption must be 220 characters or fewer.'))
  onStage?.('Checking the photo…')
  return prepareDogPhoto(input.file).then((photo) => new Promise<void>((resolve, reject) => {
    const body = new FormData()
    body.set('file', photo, 'sleeping-dog.jpg')
    body.set('dogName', dogName)
    body.set('displayName', displayName)
    body.set('caption', caption)
    body.set('consent', 'yes')
    body.set('turnstileToken', input.turnstileToken)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${apiUrl}/api/uploads`)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onStage?.(`Uploading… ${Math.round((event.loaded / event.total) * 100)}%`)
    }
    xhr.onerror = () => reject(new Error('Upload failed before it could be stored. Nothing was published.'))
    xhr.onload = () => {
      let payload: { ok?: boolean, stored?: boolean, error?: string } | null = null
      try { payload = JSON.parse(xhr.responseText) } catch { payload = null }
      if (xhr.status >= 200 && xhr.status < 300 && payload?.ok === true && payload.stored === true) {
        resolve()
        return
      }
      reject(new Error(payload?.error || 'Upload was not stored. Please try again.'))
    }
    onStage?.('Uploading to private storage…')
    xhr.send(body)
  }))
}

export async function reportApprovedPhoto(photoId: string, turnstileToken: string, reason: string): Promise<void> {
  if (!apiUrl) throw new Error('Reports are unavailable until photo storage is connected.')
  const response = await fetch(`${apiUrl}/api/reports`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ photoId, turnstileToken, reason }),
  })
  const payload = await response.json().catch(() => null) as { ok?: boolean, stored?: boolean, error?: string } | null
  if (!response.ok || payload?.stored !== true) throw new Error(payload?.error || 'Report failed. Nothing was stored.')
}

export function memberDownloadName(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80) || 'photo'
  return `sleepy-dog-${safe}.jpg`
}

export function downloadMayOpenInstead(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent)
}

export async function saveImageFile(data: Blob, filename: string): Promise<void> {
  const head = new Uint8Array(await data.slice(0, 12).arrayBuffer())
  const jpeg = head[0] === 0xff && head[1] === 0xd8
  const png = head[0] === 0x89 && head[1] === 0x50
  const webp = head[8] === 0x57 && head[9] === 0x45
  if (!data.type.startsWith('image/') && !jpeg && !png && !webp) throw new Error('The download was not an image file.')
  const objUrl = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = objUrl
  link.download = filename
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objUrl), 30000)
}

export async function downloadScrapbook(url: string, filename: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('That scrapbook photo could not be downloaded.')
  await saveImageFile(await response.blob(), filename)
}

export async function downloadApprovedPhoto(photo: SdcPhoto): Promise<void> {
  if (!apiUrl) throw new Error('Downloads are temporarily unavailable.')
  const response = await fetch(`${apiUrl}/api/photos/${encodeURIComponent(photo.id)}/download`)
  if (!response.ok) throw new Error('Download failed. Pending and rejected photos stay private.')
  const blob = await response.blob()
  const header = response.headers.get('content-disposition') || ''
  const named = header.match(/filename="([^"]+)"/)?.[1]
  await saveImageFile(blob, named || memberDownloadName(photo.id))
}

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string
      remove: (id: string) => void
    }
  }
}
