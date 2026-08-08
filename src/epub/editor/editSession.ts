import type {
  ChapterDocument,
  EditTransaction,
  EntrySourceChange,
  EpubEditSession,
  EpubPublication,
} from '../../models/publication.js'
import { decodeUtf8Xml, encodeUtf8Xml, parseXml } from '../parser/xml.js'
import {
  applySafeTextPatch,
  findSafeVisualTextSegments,
  type TextSegment,
} from '../text/safeTextPatch.js'

export class SourceValidationError extends Error {
  readonly chapterPath: string

  constructor(chapterPath: string, message: string) {
    super(message)
    this.name = 'SourceValidationError'
    this.chapterPath = chapterPath
  }
}

export interface SourceChangeInput {
  readonly afterSource: string
  readonly path: string
}

export function createEditSession(
  publication: EpubPublication,
): EpubEditSession {
  return {
    chapterRevisions: new Map(
      publication.chapters.map((chapter) => [chapter.archivePath, 0]),
    ),
    currentSources: new Map(
      publication.chapters.map((chapter) => [
        chapter.archivePath,
        chapter.originalSource,
      ]),
    ),
    dirtyEntries: new Set(),
    modifiedEntries: new Map(),
    publication,
    redoTransactions: [],
    revision: 0,
    transactions: [],
  }
}

export function getChapterSource(
  session: EpubEditSession,
  chapterPath: string,
): string {
  const source = session.currentSources.get(chapterPath)
  if (source === undefined) throw new Error(`章节不存在：${chapterPath}`)
  return source
}

export function getEntrySource(session: EpubEditSession, path: string): string {
  const current = session.currentSources.get(path)
  if (current !== undefined) return current
  const entry = session.publication.archive.entries.get(path)
  if (entry === undefined) throw new Error(`Entry 不存在：${path}`)
  return decodeUtf8Xml(session.modifiedEntries.get(path) ?? entry.originalData)
    .source
}

export function commitChapterSource(
  session: EpubEditSession,
  chapterPath: string,
  source: string,
): EpubEditSession {
  const chapter = findChapter(session.publication, chapterPath)
  if (chapter.sourceEditCapability === 'encrypted') {
    throw new SourceValidationError(
      chapterPath,
      '受保护章节不能在源码模式中修改。',
    )
  }
  validateChapterSource(chapterPath, source)
  return commitSourceChanges(
    session,
    [{ afterSource: source, path: chapterPath }],
    'source-edit',
    `修改章节源码：${chapter.title}`,
  )
}

export function getChapterTextSegments(
  session: EpubEditSession,
  chapterPath: string,
): readonly TextSegment[] {
  return findSafeVisualTextSegments(
    getChapterSource(session, chapterPath),
    chapterPath,
    session.chapterRevisions.get(chapterPath) ?? 0,
  )
}

export function commitVisualText(
  session: EpubEditSession,
  chapterPath: string,
  segmentId: string,
  replacement: string,
): EpubEditSession {
  const chapter = findChapter(session.publication, chapterPath)
  if (chapter.sourceEditCapability === 'encrypted') {
    throw new SourceValidationError(chapterPath, '受保护章节不能修改。')
  }
  const chapterRevision = session.chapterRevisions.get(chapterPath) ?? 0
  const segment = findSafeVisualTextSegments(
    getChapterSource(session, chapterPath),
    chapterPath,
    chapterRevision,
  ).find((candidate) => candidate.id === segmentId)
  if (segment === undefined) {
    throw new SourceValidationError(
      chapterPath,
      '可视编辑位置已经失效，请刷新章节后重试。',
    )
  }
  const patched = applySafeTextPatch(
    getChapterSource(session, chapterPath),
    segment,
    replacement,
    chapterRevision,
  )
  return commitSourceChanges(
    session,
    [{ afterSource: patched.source, path: chapterPath }],
    'text-edit',
    `修改正文：${chapter.title}`,
  )
}

export function commitSourceChanges(
  session: EpubEditSession,
  inputs: readonly SourceChangeInput[],
  type: EditTransaction['type'],
  summary: string,
): EpubEditSession {
  const uniquePaths = new Set(inputs.map((input) => input.path))
  if (uniquePaths.size !== inputs.length) {
    throw new Error('同一 transaction 不能重复修改同一 entry。')
  }
  const changes: EntrySourceChange[] = []
  for (const input of inputs) {
    const beforeSource = getEntrySource(session, input.path)
    if (beforeSource === input.afterSource) continue
    validateEntrySource(session, input.path, input.afterSource)
    const entry = session.publication.archive.entries.get(input.path)
    if (entry === undefined) throw new Error(`Entry 不存在：${input.path}`)
    const encoding = encodingForPath(session, input.path)
    changes.push({
      afterBytes: encodeUtf8Xml(input.afterSource, encoding),
      afterSource: input.afterSource,
      beforeBytes:
        session.modifiedEntries.get(input.path) ?? entry.originalData,
      beforeSource,
      path: input.path,
    })
  }
  if (changes.length === 0) return session
  const revision = session.revision + 1
  const transaction: EditTransaction = {
    changes,
    id: `transaction-${String(revision)}`,
    revision,
    summary,
    timestamp: Date.now(),
    type,
  }
  return applyChanges(session, changes, {
    redoTransactions: [],
    revision,
    transactions: [...session.transactions, transaction],
  })
}

export function undoEdit(session: EpubEditSession): EpubEditSession {
  const transaction = session.transactions.at(-1)
  if (transaction === undefined) return session
  const inverse = transaction.changes.map((change) => ({
    ...change,
    afterBytes: change.beforeBytes,
    afterSource: change.beforeSource,
  }))
  return applyChanges(session, inverse, {
    redoTransactions: [transaction, ...session.redoTransactions],
    revision: session.revision + 1,
    transactions: session.transactions.slice(0, -1),
  })
}

export function redoEdit(session: EpubEditSession): EpubEditSession {
  const transaction = session.redoTransactions[0]
  if (transaction === undefined) return session
  return applyChanges(session, transaction.changes, {
    redoTransactions: session.redoTransactions.slice(1),
    revision: session.revision + 1,
    transactions: [...session.transactions, transaction],
  })
}

export function validateChapterSource(
  chapterPath: string,
  source: string,
): void {
  try {
    const document = parseXml(source, chapterPath)
    const root = document.documentElement
    if (
      root === null ||
      (root.localName ?? root.tagName).toLowerCase() !== 'html'
    ) {
      throw new Error('XHTML 根元素必须是 html。')
    }
  } catch (cause) {
    throw new SourceValidationError(
      chapterPath,
      cause instanceof Error ? cause.message : 'XHTML XML 无效。',
    )
  }
}

function applyChanges(
  session: EpubEditSession,
  changes: readonly EntrySourceChange[],
  history: Pick<
    EpubEditSession,
    'redoTransactions' | 'revision' | 'transactions'
  >,
): EpubEditSession {
  const currentSources = new Map(session.currentSources)
  const modifiedEntries = new Map(session.modifiedEntries)
  const dirtyEntries = new Set(session.dirtyEntries)
  const chapterRevisions = new Map(session.chapterRevisions)
  for (const change of changes) {
    const original = session.publication.archive.entries.get(change.path)
    if (original === undefined) throw new Error(`Entry 不存在：${change.path}`)
    currentSources.set(change.path, change.afterSource)
    if (byteEqual(change.afterBytes, original.originalData)) {
      modifiedEntries.delete(change.path)
      dirtyEntries.delete(change.path)
    } else {
      modifiedEntries.set(change.path, change.afterBytes)
      dirtyEntries.add(change.path)
    }
    if (chapterRevisions.has(change.path)) {
      chapterRevisions.set(
        change.path,
        (chapterRevisions.get(change.path) ?? 0) + 1,
      )
    }
  }
  return {
    chapterRevisions,
    currentSources,
    dirtyEntries,
    modifiedEntries,
    publication: session.publication,
    ...history,
  }
}

function validateEntrySource(
  session: EpubEditSession,
  path: string,
  source: string,
): void {
  if (
    session.publication.chapters.some((chapter) => chapter.archivePath === path)
  ) {
    validateChapterSource(path, source)
  } else {
    parseXml(source, path)
  }
}

function encodingForPath(
  session: EpubEditSession,
  path: string,
): 'utf-8' | 'utf-8-bom' {
  const chapter = session.publication.chapters.find(
    (candidate) => candidate.archivePath === path,
  )
  if (chapter !== undefined) return chapter.sourceEncoding
  const entry = session.publication.archive.entries.get(path)
  if (entry === undefined) throw new Error(`Entry 不存在：${path}`)
  return decodeUtf8Xml(entry.originalData).encoding
}

function findChapter(
  publication: EpubPublication,
  chapterPath: string,
): ChapterDocument {
  const chapter = publication.chapters.find(
    (candidate) => candidate.archivePath === chapterPath,
  )
  if (chapter === undefined) throw new Error(`章节不存在：${chapterPath}`)
  return chapter
}

function byteEqual(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index])
  )
}
