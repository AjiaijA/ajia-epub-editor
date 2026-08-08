import { describe, expect, it } from 'vitest'

import {
  assertEpubMimetypeHeader,
  extractArchive,
} from '../../src/epub/archive/epubZip.js'
import {
  commitChapterSource,
  createEditSession,
} from '../../src/epub/editor/editSession.js'
import {
  editedFileName,
  exportEpubSession,
} from '../../src/epub/exporter/exportEpub.js'
import { openEpubPublication } from '../../src/epub/parser/publication.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('preserve-first EPUB export', () => {
  it('performs a no-op round trip with every payload byte preserved', async () => {
    const originalArchive = await buildFixtureArchive('epub2-ncx')
    const originalEntries = extractArchive(originalArchive)
    const publication = openEpubPublication(originalArchive, 'no-op.epub')

    const exported = exportEpubSession(createEditSession(publication))
    const exportedEntries = extractArchive(exported.bytes)
    assertEpubMimetypeHeader(exported.bytes)
    expect(exported.fileName).toBe('no-op-edited.epub')
    expect([...exportedEntries.keys()]).toEqual([...originalEntries.keys()])
    for (const [path, payload] of originalEntries) {
      expect(exportedEntries.get(path), path).toEqual(payload)
    }
  })

  it('exports one source edit while every clean entry remains byte-identical', async () => {
    const originalArchive = await buildFixtureArchive('epub3-nav')
    const originalEntries = extractArchive(originalArchive)
    const publication = openEpubPublication(originalArchive, 'source-edit.EPUB')
    const chapter = publication.chapters[0]
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const editedSource = chapter.originalSource.replace(
      '阶段一测试文字',
      '阶段二修订文字',
    )
    const session = commitChapterSource(
      createEditSession(publication),
      chapter.archivePath,
      editedSource,
    )

    const exported = exportEpubSession(session)
    const exportedEntries = extractArchive(exported.bytes)
    for (const [path, payload] of originalEntries) {
      if (path === chapter.archivePath) {
        expect(exportedEntries.get(path)).not.toEqual(payload)
      } else {
        expect(exportedEntries.get(path), path).toEqual(payload)
      }
    }
    expect(
      new TextDecoder().decode(exportedEntries.get(chapter.archivePath)),
    ).toBe(editedSource)
    const reopened = openEpubPublication(exported.bytes, exported.fileName)
    expect(reopened.chapters[0]?.originalSource).toContain('阶段二修订文字')
  })

  it('uses a safe edited filename for names with or without an extension', () => {
    expect(editedFileName('Book.EPUB')).toBe('Book-edited.epub')
    expect(editedFileName('Book')).toBe('Book-edited.epub')
  })
})
