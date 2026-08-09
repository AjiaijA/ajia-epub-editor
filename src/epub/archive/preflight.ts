import { unzipSync } from 'fflate'

import {
  EpubOpenError,
  type EpubArchive,
  type EpubIssue,
} from '../../models/publication.js'
import { DEFAULT_ARCHIVE_LIMITS, type ArchiveLimits } from './archiveLimits.js'
import { normalizeArchiveEntryPath } from './pathSafety.js'

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const MAX_EOCD_SEARCH = 65_557

export interface CentralDirectoryEntry {
  readonly compressedSize: number
  readonly compressionMethod: number
  readonly encrypted: boolean
  readonly localHeaderOffset: number
  readonly name: string
  readonly normalizedPath: string
  readonly uncompressedSize: number
}

export interface ArchivePreflightResult {
  readonly entries: readonly CentralDirectoryEntry[]
  readonly issues: readonly EpubIssue[]
}

export interface OpenedArchive {
  readonly archive: EpubArchive
  readonly issues: readonly EpubIssue[]
}

export function preflightArchive(
  bytes: Uint8Array,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): ArchivePreflightResult {
  const issues: EpubIssue[] = []
  if (bytes.byteLength > limits.maxFileBytes) {
    throw new EpubOpenError('The EPUB exceeds the safety limit.', [
      errorIssue(
        'archive.file-too-large',
        'The EPUB exceeds the 100 MiB safety limit.',
      ),
    ])
  }
  if (bytes.byteLength < 22) {
    throw new EpubOpenError('The ZIP file is incomplete.', [
      errorIssue('archive.truncated', 'The file is too short to be a ZIP.'),
    ])
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocdOffset = findEndOfCentralDirectory(view)
  if (eocdOffset === -1) {
    throw new EpubOpenError('The ZIP central directory was not found.', [
      errorIssue(
        'archive.missing-central-directory',
        'The ZIP directory record could not be located.',
      ),
    ])
  }

  const diskNumber = view.getUint16(eocdOffset + 4, true)
  const centralDisk = view.getUint16(eocdOffset + 6, true)
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true)
  const entryCount = view.getUint16(eocdOffset + 10, true)
  const centralSize = view.getUint32(eocdOffset + 12, true)
  const centralOffset = view.getUint32(eocdOffset + 16, true)
  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    issues.push(
      errorIssue('archive.multi-disk', 'Multi-disk ZIP is unsupported.'),
    )
  }
  if (
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  ) {
    issues.push(
      errorIssue('archive.zip64-unsupported', 'ZIP64 EPUB is unsupported.'),
    )
  }
  if (entryCount > limits.maxEntries) {
    issues.push(
      errorIssue(
        'archive.too-many-entries',
        'The ZIP entry count exceeds the safety limit.',
      ),
    )
  }
  if (centralOffset + centralSize > eocdOffset) {
    issues.push(
      errorIssue(
        'archive.invalid-central-directory',
        'The ZIP central-directory range is invalid.',
      ),
    )
  }

  const entries: CentralDirectoryEntry[] = []
  const normalizedPaths = new Set<string>()
  let totalUncompressed = 0
  let offset = centralOffset
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > bytes.byteLength ||
      view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE
    ) {
      issues.push(
        errorIssue(
          'archive.invalid-central-entry',
          'A ZIP central-directory entry is damaged or truncated.',
        ),
      )
      break
    }

    const flags = view.getUint16(offset + 8, true)
    const compressionMethod = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const fileNameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const nextOffset =
      offset + 46 + fileNameLength + extraLength + commentLength
    if (nextOffset > bytes.byteLength) {
      issues.push(
        errorIssue(
          'archive.invalid-central-entry',
          'A ZIP central-directory entry is outside the file.',
        ),
      )
      break
    }

    let name = ''
    try {
      name = new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.subarray(offset + 46, offset + 46 + fileNameLength),
      )
    } catch {
      issues.push(
        errorIssue(
          'archive.invalid-filename-encoding',
          'A ZIP filename is not valid UTF-8.',
        ),
      )
    }

    let normalizedPath = name
    try {
      normalizedPath = normalizeArchiveEntryPath(name)
      if (normalizedPaths.has(normalizedPath)) {
        issues.push(
          errorIssue(
            'archive.duplicate-path',
            'The ZIP contains duplicate normalized paths.',
            normalizedPath,
          ),
        )
      }
      normalizedPaths.add(normalizedPath)
    } catch (cause) {
      issues.push(
        errorIssue(
          'archive.unsafe-path',
          'The ZIP contains an unsafe path.',
          name,
          cause instanceof Error ? cause.message : undefined,
        ),
      )
    }

    if ((flags & 0x0001) !== 0) {
      issues.push(
        errorIssue(
          'archive.encrypted-entry',
          'Encrypted ZIP entries are unsupported.',
          name,
        ),
      )
    }
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      issues.push(
        errorIssue(
          'archive.unsupported-compression',
          'The ZIP uses an unsupported compression method.',
          name,
        ),
      )
    }
    if (uncompressedSize > limits.maxEntryUncompressedBytes) {
      issues.push(
        errorIssue(
          'archive.entry-too-large',
          'An entry exceeds the safety limit.',
          name,
        ),
      )
    }
    const ratio = uncompressedSize / Math.max(compressedSize, 1)
    if (uncompressedSize > 0 && ratio > limits.maxCompressionRatio) {
      issues.push(
        errorIssue(
          'archive.suspicious-compression-ratio',
          'A ZIP entry has a suspicious compression ratio.',
          name,
        ),
      )
    }
    totalUncompressed += uncompressedSize
    entries.push({
      compressedSize,
      compressionMethod,
      encrypted: (flags & 0x0001) !== 0,
      localHeaderOffset,
      name,
      normalizedPath,
      uncompressedSize,
    })
    offset = nextOffset
  }
  if (offset !== centralOffset + centralSize) {
    issues.push(
      errorIssue(
        'archive.central-directory-size-mismatch',
        'The ZIP central-directory size does not match its entries.',
      ),
    )
  }

  if (totalUncompressed > limits.maxTotalUncompressedBytes) {
    issues.push(
      errorIssue(
        'archive.total-too-large',
        'The declared total uncompressed size exceeds the safety limit.',
      ),
    )
  }
  validateLocalHeaders(bytes, entries, issues)
  if (issues.some((issue) => issue.severity === 'error')) {
    throw new EpubOpenError('The EPUB failed ZIP safety preflight.', issues)
  }
  return { entries, issues }
}

export function openArchiveSafely(
  bytes: Uint8Array,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): OpenedArchive {
  const preflight = preflightArchive(bytes, limits)
  let extracted: ReadonlyMap<string, Uint8Array>
  try {
    extracted = new Map(Object.entries(unzipSync(bytes)))
  } catch (cause) {
    throw new EpubOpenError('The EPUB could not be extracted.', [
      errorIssue(
        'archive.extraction-failed',
        'The ZIP passed directory preflight but could not be extracted.',
        undefined,
        cause instanceof Error ? cause.message : undefined,
      ),
    ])
  }

  const entries = new Map<string, { originalData: Uint8Array; path: string }>()
  for (const metadata of preflight.entries) {
    if (metadata.normalizedPath.endsWith('/')) continue
    const payload = extracted.get(metadata.name)
    if (
      payload === undefined ||
      payload.byteLength !== metadata.uncompressedSize
    ) {
      throw new EpubOpenError(
        'The extracted ZIP does not match its directory records.',
        [
          errorIssue(
            'archive.size-mismatch',
            'An extracted entry size does not match its directory declaration.',
            metadata.name,
          ),
        ],
      )
    }
    entries.set(metadata.normalizedPath, {
      originalData: payload,
      path: metadata.normalizedPath,
    })
  }

  const issues = [...preflight.issues]
  const mimetype = entries.get('mimetype')?.originalData
  if (
    mimetype === undefined ||
    new TextDecoder().decode(mimetype) !== 'application/epub+zip'
  ) {
    issues.push({
      code: 'archive.invalid-mimetype',
      message: 'The root mimetype is missing or its content is not exact.',
      severity: 'warning',
    })
  }
  return { archive: { entries }, issues }
}

function validateLocalHeaders(
  bytes: Uint8Array,
  entries: readonly CentralDirectoryEntry[],
  issues: EpubIssue[],
): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ordered = [...entries].sort(
    (left, right) => left.localHeaderOffset - right.localHeaderOffset,
  )
  const seenOffsets = new Set<number>()
  for (const [index, entry] of ordered.entries()) {
    const offset = entry.localHeaderOffset
    if (
      offset + 30 > bytes.byteLength ||
      view.getUint32(offset, true) !== LOCAL_FILE_HEADER_SIGNATURE
    ) {
      issues.push(
        errorIssue(
          'archive.invalid-local-header',
          'A ZIP local header is invalid.',
          entry.name,
        ),
      )
      continue
    }
    if (seenOffsets.has(offset)) {
      issues.push(
        errorIssue(
          'archive.duplicate-local-offset',
          'Multiple ZIP directory entries point to the same local header.',
          entry.name,
        ),
      )
      continue
    }
    seenOffsets.add(offset)

    const localFlags = view.getUint16(offset + 6, true)
    const localMethod = view.getUint16(offset + 8, true)
    const fileNameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const payloadOffset = offset + 30 + fileNameLength + extraLength
    const payloadEnd = payloadOffset + entry.compressedSize
    const nextOffset = ordered[index + 1]?.localHeaderOffset
    if (
      localMethod !== entry.compressionMethod ||
      (localFlags & 0x0001) !== (entry.encrypted ? 0x0001 : 0)
    ) {
      issues.push(
        errorIssue(
          'archive.header-mismatch',
          'A ZIP local header disagrees with the central directory.',
          entry.name,
        ),
      )
    }
    if (
      payloadEnd > bytes.byteLength ||
      (nextOffset !== undefined && payloadEnd > nextOffset)
    ) {
      issues.push(
        errorIssue(
          'archive.overlapping-entry',
          'ZIP local-entry ranges overlap or extend outside the file.',
          entry.name,
        ),
      )
    }
    try {
      const localName = new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.subarray(offset + 30, offset + 30 + fileNameLength),
      )
      if (localName !== entry.name) {
        issues.push(
          errorIssue(
            'archive.header-name-mismatch',
            'A ZIP local-header filename disagrees with the central directory.',
            entry.name,
          ),
        )
      }
    } catch {
      issues.push(
        errorIssue(
          'archive.invalid-local-filename',
          'A ZIP local-header filename is not valid UTF-8.',
          entry.name,
        ),
      )
    }
  }
  const first = ordered[0]
  if (
    first?.name !== 'mimetype' ||
    first.localHeaderOffset !== 0 ||
    first.compressionMethod !== 0
  ) {
    issues.push({
      code: 'archive.nonconforming-mimetype-header',
      message:
        'mimetype is not the first STORE local entry; the book will remain read-only after opening.',
      severity: 'warning',
    })
  }
}

function findEndOfCentralDirectory(view: DataView): number {
  const start = Math.max(0, view.byteLength - MAX_EOCD_SEARCH)
  for (let offset = view.byteLength - 22; offset >= start; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      const commentLength = view.getUint16(offset + 20, true)
      if (offset + 22 + commentLength === view.byteLength) return offset
    }
  }
  return -1
}

function errorIssue(
  code: string,
  message: string,
  path?: string,
  detail?: string,
): EpubIssue {
  return {
    code,
    message,
    severity: 'error',
    ...(path === undefined ? {} : { path }),
    ...(detail === undefined ? {} : { detail }),
  }
}
