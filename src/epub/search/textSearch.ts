import type { EpubEditSession } from '../../models/publication.js'
import { commitSourceChanges, getChapterSource } from '../editor/editSession.js'
import {
  applySafeTextPatch,
  findChapterTextSegments,
  type TextSegment,
} from '../text/safeTextPatch.js'

export interface SearchResult {
  readonly chapterPath: string
  readonly chapterRevision: number
  readonly chapterTitle: string
  readonly contextAfter: string
  readonly contextBefore: string
  readonly end: number
  readonly id: string
  readonly matchedText: string
  readonly query: string
  readonly segmentId: string
  readonly start: number
}

export type SearchScope = 'book' | 'chapter'

export function searchBodyText(
  session: EpubEditSession,
  query: string,
  scope: SearchScope,
  activeChapterPath?: string,
): readonly SearchResult[] {
  if (query === '') return []
  const chapters = session.publication.chapters.filter(
    (chapter) =>
      chapter.sourceEditCapability === 'editable' &&
      (scope === 'book' || chapter.archivePath === activeChapterPath),
  )
  const results: SearchResult[] = []
  for (const chapter of chapters) {
    const chapterRevision =
      session.chapterRevisions.get(chapter.archivePath) ?? 0
    const segments = findChapterTextSegments(
      getChapterSource(session, chapter.archivePath),
      chapter.archivePath,
      chapterRevision,
    )
    for (const segment of segments) {
      let start = 0
      while (start <= segment.decodedText.length - query.length) {
        const matchStart = segment.decodedText.indexOf(query, start)
        if (matchStart === -1) break
        const end = matchStart + query.length
        results.push({
          chapterPath: chapter.archivePath,
          chapterRevision,
          chapterTitle: chapter.title,
          contextAfter: segment.decodedText.slice(end, end + 24),
          contextBefore: segment.decodedText.slice(
            Math.max(0, matchStart - 24),
            matchStart,
          ),
          end,
          id: `${segment.id}:match:${String(matchStart)}:${String(end)}`,
          matchedText: query,
          query,
          segmentId: segment.id,
          start: matchStart,
        })
        start = end
      }
    }
  }
  return results
}

export function replaceSearchResult(
  session: EpubEditSession,
  result: SearchResult,
  replacement: string,
): EpubEditSession {
  const segment = resolveResultSegment(session, result)
  const nextText =
    segment.decodedText.slice(0, result.start) +
    replacement +
    segment.decodedText.slice(result.end)
  const patched = applySafeTextPatch(
    getChapterSource(session, result.chapterPath),
    segment,
    nextText,
    result.chapterRevision,
  )
  return commitSourceChanges(
    session,
    [{ afterSource: patched.source, path: result.chapterPath }],
    'replace-current',
    `替换 1 处正文：“${result.query}”`,
  )
}

export function replaceAllSearchResults(
  session: EpubEditSession,
  results: readonly SearchResult[],
  replacement: string,
): EpubEditSession {
  if (results.length === 0) return session
  const byChapter = new Map<string, SearchResult[]>()
  for (const result of results) {
    resolveResultSegment(session, result)
    const chapterResults = byChapter.get(result.chapterPath) ?? []
    chapterResults.push(result)
    byChapter.set(result.chapterPath, chapterResults)
  }
  const changes: { afterSource: string; path: string }[] = []
  for (const [chapterPath, chapterResults] of byChapter) {
    const chapterRevision = chapterResults[0]?.chapterRevision ?? 0
    let source = getChapterSource(session, chapterPath)
    const segmentGroups = new Map<string, SearchResult[]>()
    for (const result of chapterResults) {
      const matches = segmentGroups.get(result.segmentId) ?? []
      matches.push(result)
      segmentGroups.set(result.segmentId, matches)
    }
    const segments = findChapterTextSegments(
      source,
      chapterPath,
      chapterRevision,
    )
    const patches: { matches: SearchResult[]; segment: TextSegment }[] = []
    for (const [segmentId, matches] of segmentGroups) {
      const segment = segments.find((candidate) => candidate.id === segmentId)
      if (segment === undefined) throw staleSearchError()
      patches.push({ matches, segment })
    }
    patches.sort(
      (left, right) => right.segment.sourceStart - left.segment.sourceStart,
    )
    for (const patch of patches) {
      let nextText = patch.segment.decodedText
      for (const match of [...patch.matches].sort(
        (left, right) => right.start - left.start,
      )) {
        if (nextText.slice(match.start, match.end) !== match.matchedText) {
          throw staleSearchError()
        }
        nextText =
          nextText.slice(0, match.start) +
          replacement +
          nextText.slice(match.end)
      }
      source = applySafeTextPatch(
        source,
        patch.segment,
        nextText,
        chapterRevision,
      ).source
    }
    changes.push({ afterSource: source, path: chapterPath })
  }
  return commitSourceChanges(
    session,
    changes,
    'replace-all',
    `全部替换 ${String(results.length)} 处正文，涉及 ${String(byChapter.size)} 章`,
  )
}

function resolveResultSegment(
  session: EpubEditSession,
  result: SearchResult,
): TextSegment {
  if (
    (session.chapterRevisions.get(result.chapterPath) ?? 0) !==
    result.chapterRevision
  ) {
    throw staleSearchError()
  }
  const segment = findChapterTextSegments(
    getChapterSource(session, result.chapterPath),
    result.chapterPath,
    result.chapterRevision,
  ).find((candidate) => candidate.id === result.segmentId)
  if (
    segment === undefined ||
    segment.decodedText.slice(result.start, result.end) !== result.matchedText
  ) {
    throw staleSearchError()
  }
  return segment
}

function staleSearchError(): Error {
  return new Error('搜索结果已经失效，请重新搜索。')
}
