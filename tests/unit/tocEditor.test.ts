import { describe, expect, it } from 'vitest'

import {
  createEditSession,
  getEntrySource,
  redoEdit,
  undoEdit,
} from '../../src/epub/editor/editSession.js'
import {
  getCurrentNavigation,
  renameNavigationLabel,
} from '../../src/epub/navigation/tocEditor.js'
import { openEpubPublication } from '../../src/epub/parser/publication.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('navigation label editing', () => {
  it('patches one EPUB 2 NCX label without changing its target and supports undo', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'toc.epub',
    )
    const session = createEditSession(publication)
    const item = getCurrentNavigation(session).items[0]
    if (item === undefined) throw new Error('Navigation item missing')
    const path = item.sources[0]?.documentPath
    if (path === undefined) throw new Error('Navigation source missing')
    const before = getEntrySource(session, path)

    const result = renameNavigationLabel(session, item, '修订后的目录')

    expect(result.updatedPaths).toEqual([path])
    expect(getEntrySource(result.session, path)).toBe(
      before.replace('唯一章节', '修订后的目录'),
    )
    expect(getCurrentNavigation(result.session).items[0]?.label).toBe(
      '修订后的目录',
    )
    expect(getCurrentNavigation(result.session).items[0]?.href).toBe(item.href)
    expect(getEntrySource(undoEdit(result.session), path)).toBe(before)
    expect(
      getCurrentNavigation(redoEdit(undoEdit(result.session))).items[0]?.label,
    ).toBe('修订后的目录')
  })

  it('synchronizes a uniquely matched NAV and NCX target', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub3-nav'),
      'dual-toc.epub',
    )
    const session = createEditSession(publication)
    const item = getCurrentNavigation(session).items[1]
    if (item === undefined) throw new Error('Navigation item missing')

    const result = renameNavigationLabel(session, item, '同步后的第二章')

    expect(result.updatedPaths).toHaveLength(2)
    expect(result.issues).toHaveLength(0)
    for (const path of result.updatedPaths) {
      expect(getEntrySource(result.session, path)).toContain('同步后的第二章')
    }
    expect(result.session.transactions.at(-1)?.type).toBe('toc-label')

    const currentItem = getCurrentNavigation(result.session).items[1]
    if (currentItem === undefined) throw new Error('Renamed item missing')
    const renamedAgain = renameNavigationLabel(
      result.session,
      currentItem,
      '再次同步的第二章',
    )
    expect(renamedAgain.updatedPaths).toHaveLength(2)
    expect(renamedAgain.issues).toHaveLength(0)
    for (const path of renamedAgain.updatedPaths) {
      expect(getEntrySource(renamedAgain.session, path)).toContain(
        '再次同步的第二章',
      )
    }
  })
})
