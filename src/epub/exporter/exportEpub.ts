import type { EpubEditSession, EpubIssue } from '../../models/publication.js'
import {
  assertEpubMimetypeHeader,
  extractArchive,
  writeEpubArchive,
} from '../archive/epubZip.js'
import { openEpubPublication } from '../parser/publication.js'
import {
  validateExportSession,
  type ExportCheckResult,
} from '../validator/exportValidator.js'

export interface ExportedEpub {
  readonly bytes: Uint8Array
  readonly fileName: string
  readonly validation: ExportCheckResult
}

export class ExportValidationError extends Error {
  readonly issues: readonly EpubIssue[]

  constructor(issues: readonly EpubIssue[]) {
    super('EPUB 未通过导出前检查。')
    this.name = 'ExportValidationError'
    this.issues = issues
  }
}

export function exportEpubSession(session: EpubEditSession): ExportedEpub {
  const validation = validateExportSession(session)
  if (!validation.canExport) throw new ExportValidationError(validation.issues)

  const payloads = new Map<string, Uint8Array>()
  for (const [path, entry] of session.publication.archive.entries) {
    payloads.set(path, session.modifiedEntries.get(path) ?? entry.originalData)
  }
  const bytes = writeEpubArchive(payloads)
  assertEpubMimetypeHeader(bytes)
  const extracted = extractArchive(bytes)

  for (const [path, entry] of session.publication.archive.entries) {
    if (path === 'mimetype') continue
    const expected = session.modifiedEntries.get(path) ?? entry.originalData
    if (!byteEqual(extracted.get(path), expected)) {
      throw new Error(`导出后 payload 字节校验失败：${path}`)
    }
  }

  const fileName = editedFileName(session.publication.fileName)
  openEpubPublication(bytes, fileName)
  return { bytes, fileName, validation }
}

export function editedFileName(fileName: string): string {
  return /\.epub$/iu.test(fileName)
    ? fileName.replace(/\.epub$/iu, '-edited.epub')
    : `${fileName}-edited.epub`
}

function byteEqual(
  actual: Uint8Array | undefined,
  expected: Uint8Array,
): boolean {
  return (
    actual !== undefined &&
    actual.byteLength === expected.byteLength &&
    actual.every((value, index) => value === expected[index])
  )
}
