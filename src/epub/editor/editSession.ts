import type {
  ChapterDocument,
  EpubEditSession,
  EpubPublication,
} from '../../models/publication.js'
import { encodeUtf8Xml, parseXml } from '../parser/xml.js'
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

  const beforeSource = getChapterSource(session, chapterPath)
  if (beforeSource === source) return session
  const currentSources = new Map(session.currentSources)
  const modifiedEntries = new Map(session.modifiedEntries)
  const dirtyEntries = new Set(session.dirtyEntries)
  currentSources.set(chapterPath, source)

  if (source === chapter.originalSource) {
    modifiedEntries.delete(chapterPath)
    dirtyEntries.delete(chapterPath)
  } else {
    modifiedEntries.set(
      chapterPath,
      encodeUtf8Xml(source, chapter.sourceEncoding),
    )
    dirtyEntries.add(chapterPath)
  }
  const revision = session.revision + 1
  const chapterRevisions = new Map(session.chapterRevisions)
  chapterRevisions.set(
    chapterPath,
    (chapterRevisions.get(chapterPath) ?? 0) + 1,
  )
  return {
    chapterRevisions,
    currentSources,
    dirtyEntries,
    modifiedEntries,
    publication: session.publication,
    revision,
    transactions: [
      ...session.transactions,
      {
        afterSource: source,
        beforeSource,
        chapterPath,
        revision,
        type: 'source-edit',
      },
    ],
  }
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
  if (segment.decodedText === replacement) return session
  const patched = applySafeTextPatch(
    getChapterSource(session, chapterPath),
    segment,
    replacement,
    chapterRevision,
  )
  const currentSources = new Map(session.currentSources)
  const modifiedEntries = new Map(session.modifiedEntries)
  const dirtyEntries = new Set(session.dirtyEntries)
  const chapterRevisions = new Map(session.chapterRevisions)
  currentSources.set(chapterPath, patched.source)
  if (patched.source === chapter.originalSource) {
    modifiedEntries.delete(chapterPath)
    dirtyEntries.delete(chapterPath)
  } else {
    modifiedEntries.set(
      chapterPath,
      encodeUtf8Xml(patched.source, chapter.sourceEncoding),
    )
    dirtyEntries.add(chapterPath)
  }
  const revision = session.revision + 1
  chapterRevisions.set(chapterPath, chapterRevision + 1)
  return {
    chapterRevisions,
    currentSources,
    dirtyEntries,
    modifiedEntries,
    publication: session.publication,
    revision,
    transactions: [
      ...session.transactions,
      {
        afterText: replacement,
        beforeText: segment.decodedText,
        chapterPath,
        revision,
        segmentId,
        type: 'text-edit',
      },
    ],
  }
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
