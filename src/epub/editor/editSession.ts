import type {
  ChapterDocument,
  EpubEditSession,
  EpubPublication,
} from '../../models/publication.js'
import { encodeUtf8Xml, parseXml } from '../parser/xml.js'

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
  return {
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
