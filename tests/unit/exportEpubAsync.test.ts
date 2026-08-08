import { describe, expect, it } from 'vitest'

import { exportEpubAsync } from '../../src/app/exportEpubAsync.js'
import { assertEpubMimetypeHeader } from '../../src/epub/archive/epubZip.js'
import { createEditSession } from '../../src/epub/editor/editSession.js'
import { openEpubPublication } from '../../src/epub/parser/publication.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('exportEpubAsync', () => {
  it('uses the in-process fallback when Worker is unavailable', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('minimal-epub'),
      'fallback.epub',
    )

    const exported = await exportEpubAsync(createEditSession(publication))

    expect(exported.fileName).toBe('fallback-edited.epub')
    expect(() => {
      assertEpubMimetypeHeader(exported.bytes)
    }).not.toThrow()
  })
})
