import { describe, expect, it } from 'vitest'

import {
  commitChapterSource,
  createEditSession,
  getChapterSource,
  SourceValidationError,
} from '../../src/epub/editor/editSession.js'
import { openEpubPublication } from '../../src/epub/parser/publication.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('source edit session', () => {
  it('commits valid XHTML as modified bytes without mutating original bytes', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'source.epub',
    )
    const chapter = publication.chapters[0]
    expect(chapter).toBeDefined()
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const originalBytes = chapter.originalBytes.slice()
    const session = createEditSession(publication)
    const source = chapter.originalSource.replace('测试文字', '修订文字')

    const edited = commitChapterSource(session, chapter.archivePath, source)
    expect(edited.dirtyEntries).toEqual(new Set([chapter.archivePath]))
    expect(getChapterSource(edited, chapter.archivePath)).toBe(source)
    expect(
      new TextDecoder().decode(edited.modifiedEntries.get(chapter.archivePath)),
    ).toBe(source)
    expect(chapter.originalBytes).toEqual(originalBytes)
    expect(session.dirtyEntries.size).toBe(0)
    expect(edited.transactions).toHaveLength(1)
  })

  it('rejects malformed XML atomically', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'invalid-source.epub',
    )
    const chapter = publication.chapters[0]
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const session = createEditSession(publication)

    expect(() =>
      commitChapterSource(
        session,
        chapter.archivePath,
        '<html><body><p>broken</body></html>',
      ),
    ).toThrow(SourceValidationError)
    expect(session.dirtyEntries.size).toBe(0)
    expect(getChapterSource(session, chapter.archivePath)).toBe(
      chapter.originalSource,
    )
  })

  it('removes dirty state when source is restored exactly', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'restore.epub',
    )
    const chapter = publication.chapters[0]
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const session = createEditSession(publication)
    const edited = commitChapterSource(
      session,
      chapter.archivePath,
      chapter.originalSource.replace('测试文字', '修订文字'),
    )
    const restored = commitChapterSource(
      edited,
      chapter.archivePath,
      chapter.originalSource,
    )

    expect(restored.dirtyEntries.size).toBe(0)
    expect(restored.modifiedEntries.size).toBe(0)
    expect(restored.transactions).toHaveLength(2)
  })

  it('preserves a chapter UTF-8 BOM when edited', async () => {
    const opened = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'bom.epub',
    )
    const chapter = opened.chapters[0]
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const publication = {
      ...opened,
      chapters: [{ ...chapter, sourceEncoding: 'utf-8-bom' as const }],
    }
    const edited = commitChapterSource(
      createEditSession(publication),
      chapter.archivePath,
      chapter.originalSource.replace('测试文字', '带 BOM 的修订文字'),
    )
    const bytes = edited.modifiedEntries.get(chapter.archivePath)

    expect(bytes?.subarray(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]))
    expect(new TextDecoder().decode(bytes?.subarray(3))).toContain(
      '带 BOM 的修订文字',
    )
  })
})
