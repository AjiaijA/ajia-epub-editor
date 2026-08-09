import { describe, expect, it } from 'vitest'

import {
  commitChapterSource,
  createEditSession,
  getChapterSource,
  redoEdit,
  undoEdit,
} from '../../src/epub/editor/editSession.js'
import { openEpubPublication } from '../../src/epub/parser/publication.js'
import {
  replaceAllSearchResults,
  replaceSearchResult,
  searchBodyText,
} from '../../src/epub/search/textSearch.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('body text search and replace', () => {
  it('searches body segments only and does not bridge inline elements', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'search.epub',
    )
    const chapter = publication.chapters[0]
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const source = chapter.originalSource.replace(
      '<p>这是自建的 EPUB 2 测试文字。</p>',
      '<p data-query="属性词">爱<em>丽</em>丝与正文词。</p>',
    )
    const session = commitChapterSource(
      createEditSession(publication),
      chapter.archivePath,
      source,
    )

    expect(searchBodyText(session, '属性词', 'book')).toHaveLength(0)
    expect(searchBodyText(session, '爱丽丝', 'book')).toHaveLength(0)
    expect(
      searchBodyText(session, '正文词', 'chapter', chapter.archivePath),
    ).toHaveLength(1)
  })

  it('replaces one verified result and rejects it after the chapter changes', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'replace-one.epub',
    )
    const chapter = publication.chapters[0]
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const session = createEditSession(publication)
    const result = searchBodyText(session, '测试文字', 'book')[0]
    if (result === undefined) throw new Error('Search result missing')

    const replaced = replaceSearchResult(session, result, '修订文字')
    expect(getChapterSource(replaced, chapter.archivePath)).toContain(
      '修订文字',
    )
    expect(replaced.transactions.at(-1)?.type).toBe('replace-current')

    const changed = commitChapterSource(
      session,
      chapter.archivePath,
      chapter.originalSource.replace('唯一章节', '新标题'),
    )
    expect(() => replaceSearchResult(changed, result, '过期')).toThrow('stale')
  })

  it('replaces all atomically and one undo/redo restores the whole operation', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub3-nav'),
      'replace-all.epub',
    )
    let session = createEditSession(publication)
    for (const chapter of publication.chapters) {
      session = commitChapterSource(
        session,
        chapter.archivePath,
        chapter.originalSource.replace(
          '</body>',
          '<p>共同词，共同词。</p></body>',
        ),
      )
    }
    const beforeReplace = session
    const results = searchBodyText(session, '共同词', 'book')
    expect(results).toHaveLength(publication.chapters.length * 2)

    const replaced = replaceAllSearchResults(session, results, '统一文字')
    expect(replaced.transactions.at(-1)?.type).toBe('replace-all')
    expect(replaced.transactions.at(-1)?.changes).toHaveLength(
      publication.chapters.length,
    )
    for (const chapter of publication.chapters) {
      expect(getChapterSource(replaced, chapter.archivePath)).not.toContain(
        '共同词',
      )
    }

    const undone = undoEdit(replaced)
    for (const chapter of publication.chapters) {
      expect(getChapterSource(undone, chapter.archivePath)).toBe(
        getChapterSource(beforeReplace, chapter.archivePath),
      )
    }
    const redone = redoEdit(undone)
    for (const chapter of publication.chapters) {
      expect(getChapterSource(redone, chapter.archivePath)).toBe(
        getChapterSource(replaced, chapter.archivePath),
      )
    }
  })

  it('does not partially apply stale Replace All results', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub3-nav'),
      'atomic.epub',
    )
    const session = createEditSession(publication)
    const results = searchBodyText(session, '章', 'book')
    const chapter = publication.chapters[0]
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const changed = commitChapterSource(
      session,
      chapter.archivePath,
      chapter.originalSource.replace('第一章', '首章'),
    )
    const beforeSources = new Map(changed.currentSources)

    expect(() => replaceAllSearchResults(changed, results, '节')).toThrow(
      'stale',
    )
    expect(changed.currentSources).toEqual(beforeSources)
  })
})
