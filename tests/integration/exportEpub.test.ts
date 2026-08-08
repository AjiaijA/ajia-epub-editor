import { describe, expect, it } from 'vitest'

import {
  assertEpubMimetypeHeader,
  extractArchive,
} from '../../src/epub/archive/epubZip.js'
import {
  commitChapterSource,
  commitVisualText,
  createEditSession,
  getChapterTextSegments,
} from '../../src/epub/editor/editSession.js'
import {
  editedFileName,
  exportEpubSession,
} from '../../src/epub/exporter/exportEpub.js'
import {
  getCurrentNavigation,
  renameNavigationLabel,
} from '../../src/epub/navigation/tocEditor.js'
import { openEpubPublication } from '../../src/epub/parser/publication.js'
import {
  replaceAllSearchResults,
  searchBodyText,
} from '../../src/epub/search/textSearch.js'
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

  it('exports one safe visual text patch and preserves every clean entry', async () => {
    const originalArchive = await buildFixtureArchive('epub2-ncx')
    const originalEntries = extractArchive(originalArchive)
    const publication = openEpubPublication(originalArchive, 'visual.epub')
    const chapter = publication.chapters[0]
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const initial = createEditSession(publication)
    const segment = getChapterTextSegments(initial, chapter.archivePath).find(
      (candidate) => candidate.decodedText.includes('测试文字'),
    )
    if (segment === undefined) throw new Error('Visual segment missing')
    const session = commitVisualText(
      initial,
      chapter.archivePath,
      segment.id,
      '这是阶段三安全编辑的 & <句子>。',
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
    const reopened = openEpubPublication(exported.bytes, exported.fileName)
    expect(reopened.chapters[0]?.originalSource).toContain(
      '阶段三安全编辑的 &amp; &lt;句子&gt;',
    )
  })

  it('exports atomic book replacement and synchronized TOC labels while preserving clean payloads', async () => {
    const originalArchive = await buildFixtureArchive('epub3-nav')
    const originalEntries = extractArchive(originalArchive)
    const publication = openEpubPublication(originalArchive, 'phase-4.epub')
    const initial = createEditSession(publication)
    const results = searchBodyText(initial, '章', 'book')
    const replaced = replaceAllSearchResults(initial, results, '篇')
    const tocItem = getCurrentNavigation(replaced).items[1]
    if (tocItem === undefined) throw new Error('Navigation item missing')
    const renamed = renameNavigationLabel(replaced, tocItem, '第二篇').session

    const exported = exportEpubSession(renamed)
    const exportedEntries = extractArchive(exported.bytes)
    const changedPaths = new Set(renamed.modifiedEntries.keys())
    expect(changedPaths.size).toBe(4)
    for (const [path, payload] of originalEntries) {
      if (changedPaths.has(path)) {
        expect(exportedEntries.get(path), path).not.toEqual(payload)
      } else {
        expect(exportedEntries.get(path), path).toEqual(payload)
      }
    }

    const reopened = openEpubPublication(exported.bytes, exported.fileName)
    expect(reopened.navigation.items[1]?.label).toBe('第二篇')
    expect(reopened.navigation.alternateItems[1]?.label).toBe('第二篇')
    expect(
      searchBodyText(createEditSession(reopened), '章', 'book'),
    ).toHaveLength(0)
  })
})
