/** Browser-only helpers for the temporary nap gallery. Nothing here sends a photo anywhere. */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function imageType(file: File): string {
  if (ALLOWED_TYPES.includes(file.type)) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  return ''
}

/** Canvas JPEG export drops camera EXIF and GPS. The result stays in this browser. */
export async function prepareDogPhoto(file: File): Promise<Blob> {
  if (!imageType(file)) throw new Error('Please choose a JPG, PNG, or WebP image.')
  if (file.size > 8 * 1024 * 1024) throw new Error('Please choose a photo smaller than 8 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width < 150 || bitmap.height < 150) throw new Error('Please use a photo at least 150 × 150 pixels.')
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Your browser cannot process this image.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob) throw new Error('Could not prepare the photo.')
    if (blob.size > 2 * 1024 * 1024) throw new Error('That photo is still too large after resizing. Try a smaller one.')
    return blob
  } finally {
    bitmap.close()
  }
}

export function trialDownloadName(dogName: string, id: string): string {
  const slug = dogName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'dog'
  const short = id.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'photo'
  return `sleepy-dog-${slug}-${short}.jpg`
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
