/** Container checks and metadata stripping. No database and no image codec. */

const JPEG = 'image/jpeg'
const PNG = 'image/png'
const WEBP = 'image/webp'
const PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'bKGD', 'pHYs', 'sBIT'])

function concat(parts) {
  let size = 0
  for (const part of parts) size += part.length
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function ascii(bytes, start, length) {
  let text = ''
  for (let i = 0; i < length; i++) text += String.fromCharCode(bytes[start + i])
  return text
}

export function crc32(bytes) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (~crc) >>> 0
}

function u32(value) {
  return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255])
}

function sanitizeJpeg(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Malformed JPEG.')
  const parts = [bytes.subarray(0, 2)]
  let i = 2
  let sawSof = false
  let sawSos = false
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error('Malformed JPEG.')
    while (i < bytes.length && bytes[i] === 0xff) i += 1
    if (i >= bytes.length) throw new Error('Malformed JPEG.')
    const marker = bytes[i++]
    if (marker === 0xd9) {
      if (!sawSof || !sawSos) throw new Error('Malformed JPEG.')
      parts.push(Uint8Array.of(0xff, 0xd9))
      return concat(parts)
    }
    if (marker === 0x00 || marker === 0xd8) throw new Error('Malformed JPEG.')
    if (marker >= 0xd0 && marker <= 0xd7) {
      parts.push(Uint8Array.of(0xff, marker))
      continue
    }
    if (i + 1 >= bytes.length) throw new Error('Malformed JPEG.')
    const length = (bytes[i] << 8) | bytes[i + 1]
    if (length < 2 || i + length > bytes.length) throw new Error('Malformed JPEG.')
    const isMetadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe
    if (marker === 0xda) {
      sawSos = true
      parts.push(Uint8Array.of(0xff, marker), bytes.subarray(i, i + length))
      i += length
      const scanStart = i
      while (i + 1 < bytes.length) {
        if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
          if (!sawSof) throw new Error('Malformed JPEG.')
          parts.push(bytes.subarray(scanStart, i), Uint8Array.of(0xff, 0xd9))
          return concat(parts)
        }
        i += 1
      }
      throw new Error('Malformed JPEG.')
    }
    const sof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)
    if (sof) sawSof = true
    if (!isMetadata) parts.push(Uint8Array.of(0xff, marker), bytes.subarray(i, i + length))
    i += length
  }
  throw new Error('Malformed JPEG.')
}

function sanitizePng(bytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length < 8 || signature.some((value, index) => bytes[index] !== value)) throw new Error('Malformed PNG.')
  const parts = [bytes.subarray(0, 8)]
  let i = 8
  let sawIhdr = false
  let sawIdat = false
  let ended = false
  while (i + 12 <= bytes.length) {
    const length = (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]
    if (length < 0 || i + 12 + length > bytes.length) throw new Error('Malformed PNG.')
    const type = ascii(bytes, i + 4, 4)
    const chunk = bytes.subarray(i + 4, i + 8 + length)
    const expected = crc32(chunk)
    const actual = ((bytes[i + 8 + length] << 24) | (bytes[i + 9 + length] << 16) | (bytes[i + 10 + length] << 8) | bytes[i + 11 + length]) >>> 0
    if (expected !== actual) throw new Error('Malformed PNG.')
    if (ended) throw new Error('Malformed PNG.')
    if (!sawIhdr && type !== 'IHDR') throw new Error('Malformed PNG.')
    if (type === 'IHDR') {
      if (length !== 13) throw new Error('Malformed PNG.')
      sawIhdr = true
    }
    if (type === 'IDAT') sawIdat = true
    if (type === 'IEND') ended = true
    if (PNG_KEEP.has(type)) parts.push(bytes.subarray(i, i + 12 + length))
    i += 12 + length
  }
  if (!sawIhdr || !sawIdat || !ended || i !== bytes.length) throw new Error('Malformed PNG.')
  return concat(parts)
}

function readU32le(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

function sanitizeWebp(bytes) {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') throw new Error('Malformed WebP.')
  const chunks = []
  let i = 12
  let sawImage = false
  while (i + 8 <= bytes.length) {
    const fourcc = ascii(bytes, i, 4)
    const size = readU32le(bytes, i + 4)
    const dataStart = i + 8
    const dataEnd = dataStart + size
    if (dataEnd > bytes.length) throw new Error('Malformed WebP.')
    let data = bytes.subarray(dataStart, dataEnd)
    if (fourcc === 'VP8X' && data.length >= 1) {
      const flags = new Uint8Array(data)
      flags[0] &= ~0b00011010
      data = flags
    }
    if (fourcc === 'VP8 ' || fourcc === 'VP8L' || fourcc === 'VP8X') sawImage = true
    if (fourcc === 'VP8 ' || fourcc === 'VP8L' || fourcc === 'VP8X' || fourcc === 'ALPH' || fourcc === 'ANIM' || fourcc === 'ANMF') {
      const header = new Uint8Array(8)
      header.set(new TextEncoder().encode(fourcc), 0)
      header[4] = size & 255
      header[5] = (size >>> 8) & 255
      header[6] = (size >>> 16) & 255
      header[7] = (size >>> 24) & 255
      chunks.push(header, data)
      if (size % 2 === 1) chunks.push(Uint8Array.of(0))
    }
    i = dataEnd + (size % 2)
  }
  if (!sawImage || i !== bytes.length) throw new Error('Malformed WebP.')
  const body = concat(chunks)
  const header = new Uint8Array(12)
  header.set(new TextEncoder().encode('RIFF'), 0)
  const fileSize = body.length + 4
  header[4] = fileSize & 255
  header[5] = (fileSize >>> 8) & 255
  header[6] = (fileSize >>> 16) & 255
  header[7] = (fileSize >>> 24) & 255
  header.set(new TextEncoder().encode('WEBP'), 8)
  return concat([header, body])
}

export function sanitizeImage(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (bytes.length < 12) throw new Error('Please upload a JPG, PNG, or WebP image.')
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { body: sanitizeJpeg(bytes), contentType: JPEG, ext: 'jpg' }
  if (bytes[0] === 137 && ascii(bytes, 1, 3) === 'PNG') return { body: sanitizePng(bytes), contentType: PNG, ext: 'png' }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return { body: sanitizeWebp(bytes), contentType: WEBP, ext: 'webp' }
  throw new Error('Please upload a JPG, PNG, or WebP image.')
}

export function u32be(value) {
  return u32(value)
}
