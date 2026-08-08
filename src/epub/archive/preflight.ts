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
    throw new EpubOpenError('EPUB 文件超过安全上限。', [
      errorIssue('archive.file-too-large', 'EPUB 文件超过 100 MiB 安全上限。'),
    ])
  }
  if (bytes.byteLength < 22) {
    throw new EpubOpenError('ZIP 文件不完整。', [
      errorIssue('archive.truncated', '文件太短，不是完整的 ZIP。'),
    ])
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocdOffset = findEndOfCentralDirectory(view)
  if (eocdOffset === -1) {
    throw new EpubOpenError('找不到 ZIP central directory。', [
      errorIssue(
        'archive.missing-central-directory',
        '无法定位 ZIP 目录记录。',
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
    issues.push(errorIssue('archive.multi-disk', '不支持分卷 ZIP。'))
  }
  if (
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  ) {
    issues.push(
      errorIssue('archive.zip64-unsupported', '当前阶段不支持 ZIP64 EPUB。'),
    )
  }
  if (entryCount > limits.maxEntries) {
    issues.push(
      errorIssue('archive.too-many-entries', 'ZIP entry 数量超过安全上限。'),
    )
  }
  if (centralOffset + centralSize > eocdOffset) {
    issues.push(
      errorIssue('archive.invalid-central-directory', 'ZIP 目录范围无效。'),
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
        errorIssue('archive.invalid-central-entry', 'ZIP 目录项损坏或截断。'),
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
        errorIssue('archive.invalid-central-entry', 'ZIP 目录项超出文件范围。'),
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
          'ZIP 文件名不是有效 UTF-8。',
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
            'ZIP 包含规范化后重复的路径。',
            normalizedPath,
          ),
        )
      }
      normalizedPaths.add(normalizedPath)
    } catch (cause) {
      issues.push(
        errorIssue(
          'archive.unsafe-path',
          'ZIP 包含不安全路径。',
          name,
          cause instanceof Error ? cause.message : undefined,
        ),
      )
    }

    if ((flags & 0x0001) !== 0) {
      issues.push(
        errorIssue('archive.encrypted-entry', '不支持 ZIP 加密 entry。', name),
      )
    }
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      issues.push(
        errorIssue(
          'archive.unsupported-compression',
          'ZIP 使用了不支持的压缩方式。',
          name,
        ),
      )
    }
    if (uncompressedSize > limits.maxEntryUncompressedBytes) {
      issues.push(
        errorIssue(
          'archive.entry-too-large',
          '单个 entry 超过安全上限。',
          name,
        ),
      )
    }
    const ratio = uncompressedSize / Math.max(compressedSize, 1)
    if (uncompressedSize > 0 && ratio > limits.maxCompressionRatio) {
      issues.push(
        errorIssue(
          'archive.suspicious-compression-ratio',
          'ZIP entry 压缩比异常。',
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
        'ZIP central directory 声明大小与实际目录项不一致。',
      ),
    )
  }

  if (totalUncompressed > limits.maxTotalUncompressedBytes) {
    issues.push(
      errorIssue(
        'archive.total-too-large',
        'ZIP 声明的总解压大小超过安全上限。',
      ),
    )
  }
  validateLocalHeaders(bytes, entries, issues)
  if (issues.some((issue) => issue.severity === 'error')) {
    throw new EpubOpenError('EPUB 未通过 ZIP 安全预检。', issues)
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
    throw new EpubOpenError('EPUB 解压失败。', [
      errorIssue(
        'archive.extraction-failed',
        'ZIP 通过目录预检但无法解压。',
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
      throw new EpubOpenError('ZIP 解压结果与目录记录不一致。', [
        errorIssue(
          'archive.size-mismatch',
          'entry 解压大小与目录声明不一致。',
          metadata.name,
        ),
      ])
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
      message: '根目录 mimetype 缺失或内容不严格正确。',
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
          'ZIP local header 无效。',
          entry.name,
        ),
      )
      continue
    }
    if (seenOffsets.has(offset)) {
      issues.push(
        errorIssue(
          'archive.duplicate-local-offset',
          '多个 ZIP 目录项指向同一个 local header。',
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
          'ZIP local header 与 central directory 不一致。',
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
          'ZIP local entry 范围重叠或越界。',
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
            'ZIP local header 与 central directory 文件名不一致。',
            entry.name,
          ),
        )
      }
    } catch {
      issues.push(
        errorIssue(
          'archive.invalid-local-filename',
          'ZIP local header 文件名不是有效 UTF-8。',
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
      message: 'mimetype 不是首个 STORE local entry；打开后会继续保持只读。',
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
