import { strToU8, unzipSync, zipSync, type Zippable } from 'fflate'

export const EPUB_MIMETYPE = 'application/epub+zip'
export const EPUB_MIMETYPE_BYTES = strToU8(EPUB_MIMETYPE)

export interface LocalFileHeader {
  readonly compressedSize: number
  readonly compressionMethod: number
  readonly extraFieldLength: number
  readonly fileName: string
  readonly fileNameLength: number
  readonly offset: number
  readonly uncompressedSize: number
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
const STORE_METHOD = 0

/**
 * Repackages already-extracted EPUB payloads. The caller remains responsible for
 * archive safety checks; this Phase 0 seam only proves export ordering and bytes.
 */
export function writeEpubArchive(
  entries: ReadonlyMap<string, Uint8Array>,
): Uint8Array {
  const files: Zippable = {
    mimetype: [EPUB_MIMETYPE_BYTES, { level: 0 }],
  }

  for (const [path, payload] of entries) {
    if (path !== 'mimetype') {
      files[path] = payload
    }
  }

  return zipSync(files, { level: 6 })
}

export function extractArchive(
  archive: Uint8Array,
): ReadonlyMap<string, Uint8Array> {
  return new Map(Object.entries(unzipSync(archive)))
}

/** Reads local headers directly instead of trusting the ZIP writer's metadata API. */
export function readLocalFileHeaders(
  archive: Uint8Array,
): readonly LocalFileHeader[] {
  const view = new DataView(
    archive.buffer,
    archive.byteOffset,
    archive.byteLength,
  )
  const decoder = new TextDecoder()
  const headers: LocalFileHeader[] = []
  let offset = 0

  while (offset + 4 <= archive.byteLength) {
    const signature = view.getUint32(offset, true)
    if (
      signature === CENTRAL_DIRECTORY_SIGNATURE ||
      signature === END_OF_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      break
    }
    if (signature !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error(`Unexpected ZIP record at byte ${String(offset)}`)
    }
    if (offset + 30 > archive.byteLength) {
      throw new Error('Truncated ZIP local file header')
    }

    const flags = view.getUint16(offset + 6, true)
    if ((flags & 0x0008) !== 0) {
      throw new Error(
        'ZIP data descriptors are not supported by this inspector',
      )
    }
    const compressionMethod = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const uncompressedSize = view.getUint32(offset + 22, true)
    const fileNameLength = view.getUint16(offset + 26, true)
    const extraFieldLength = view.getUint16(offset + 28, true)
    const payloadOffset = offset + 30 + fileNameLength + extraFieldLength
    const nextOffset = payloadOffset + compressedSize
    if (nextOffset > archive.byteLength) {
      throw new Error('ZIP local entry extends beyond the archive')
    }

    const fileName = decoder.decode(
      archive.subarray(offset + 30, offset + 30 + fileNameLength),
    )
    headers.push({
      compressedSize,
      compressionMethod,
      extraFieldLength,
      fileName,
      fileNameLength,
      offset,
      uncompressedSize,
    })
    offset = nextOffset
  }

  return headers
}

export function assertEpubMimetypeHeader(archive: Uint8Array): void {
  const first = readLocalFileHeaders(archive)[0]
  if (first?.fileName !== 'mimetype') {
    throw new Error('EPUB mimetype is not the first local file entry')
  }
  if (first.compressionMethod !== STORE_METHOD) {
    throw new Error('EPUB mimetype is not stored without compression')
  }
  if (first.extraFieldLength !== 0) {
    throw new Error('EPUB mimetype local header contains an extra field')
  }

  const payloadOffset =
    first.offset + 30 + first.fileNameLength + first.extraFieldLength
  const payload = archive.subarray(
    payloadOffset,
    payloadOffset + first.compressedSize,
  )
  if (!bytesEqual(payload, EPUB_MIMETYPE_BYTES)) {
    throw new Error('EPUB mimetype payload is not byte-exact')
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index])
  )
}
