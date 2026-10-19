import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'

/** File-backed stand-in for an R2 binding. Objects survive a new DiskR2 pointed at the same directory. */
export class DiskR2 {
  constructor(directory) {
    this.directory = directory
  }

  fileFor(key) {
    return path.join(this.directory, createHash('sha256').update(key).digest('hex') + '.json')
  }

  async put(key, value, options = {}) {
    await mkdir(this.directory, { recursive: true })
    const bytes = await asBytes(value)
    const existing = await this.#read(key)
    const condition = options.onlyIf || {}
    if (condition.etagDoesNotMatch === '*' && existing) throw new Error('precondition failed: 412')
    if (condition.etagMatches && existing?.etag !== condition.etagMatches) throw new Error('precondition failed: 412')
    if (condition.etagMatches && !existing) throw new Error('precondition failed: 412')
    const etag = createHash('sha256').update(bytes).digest('hex')
    const record = {
      key,
      etag,
      size: bytes.byteLength,
      customMetadata: options.customMetadata || {},
      httpMetadata: options.httpMetadata || {},
      body: Buffer.from(bytes).toString('base64'),
    }
    await writeFile(this.fileFor(key), JSON.stringify(record))
    return { key, etag, size: bytes.byteLength }
  }

  async get(key) {
    const record = await this.#read(key)
    return record ? materialize(record) : null
  }

  async head(key) {
    const record = await this.#read(key)
    if (!record) return null
    return { key: record.key, etag: record.etag, size: record.size, customMetadata: record.customMetadata, httpMetadata: record.httpMetadata }
  }

  async delete(key) {
    await rm(this.fileFor(key), { force: true })
  }

  async list({ prefix = '', cursor, include } = {}) {
    await mkdir(this.directory, { recursive: true })
    const names = await readdir(this.directory)
    const objects = []
    for (const name of names) {
      const record = JSON.parse(await readFile(path.join(this.directory, name), 'utf8'))
      if (!record.key.startsWith(prefix)) continue
      objects.push(record)
    }
    objects.sort((a, b) => a.key.localeCompare(b.key))
    const start = cursor ? objects.findIndex((object) => object.key === cursor) + 1 : 0
    const page = objects.slice(Math.max(0, start), Math.max(0, start) + 1000)
    return {
      objects: page.map((record) => ({
        key: record.key,
        etag: record.etag,
        size: record.size,
        customMetadata: include?.includes('customMetadata') ? record.customMetadata : undefined,
        httpMetadata: include?.includes('httpMetadata') ? record.httpMetadata : undefined,
      })),
      truncated: start + 1000 < objects.length,
      cursor: page.length ? page[page.length - 1].key : undefined,
    }
  }

  async #read(key) {
    try {
      return JSON.parse(await readFile(this.fileFor(key), 'utf8'))
    } catch (error) {
      if (error && error.code === 'ENOENT') return null
      throw error
    }
  }
}

async function asBytes(value) {
  if (typeof value === 'string') return new TextEncoder().encode(value)
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (value && typeof value.arrayBuffer === 'function') return new Uint8Array(await value.arrayBuffer())
  throw new Error('Unsupported R2 body.')
}

function materialize(record) {
  const bytes = Buffer.from(record.body, 'base64')
  return {
    key: record.key,
    etag: record.etag,
    size: record.size,
    customMetadata: record.customMetadata,
    httpMetadata: record.httpMetadata,
    body: bytes,
    async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) },
    async text() { return bytes.toString('utf8') },
  }
}
