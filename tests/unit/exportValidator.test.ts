import { describe, expect, it } from 'vitest'

import {
  commitChapterSource,
  createEditSession,
} from '../../src/epub/editor/editSession.js'
import { openEpubPublication } from '../../src/epub/parser/publication.js'
import { validateExportSession } from '../../src/epub/validator/exportValidator.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('export validation', () => {
  it('blocks an unsafe archive-local reference in edited XHTML', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'unsafe-reference.epub',
    )
    const chapter = publication.chapters[0]
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const source = chapter.originalSource.replace(
      '</body>',
      '<img src="../../../escape.png" alt=""/></body>',
    )
    const session = commitChapterSource(
      createEditSession(publication),
      chapter.archivePath,
      source,
    )

    const result = validateExportSession(session)

    expect(result.canExport).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'export.unsafe-linked-resource' }),
    )
  })

  it('warns but permits export for a missing optional linked resource', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'missing-link.epub',
    )
    const chapter = publication.chapters[0]
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const source = chapter.originalSource.replace(
      '</body>',
      '<img src="missing.png" alt=""/></body>',
    )
    const session = commitChapterSource(
      createEditSession(publication),
      chapter.archivePath,
      source,
    )

    const result = validateExportSession(session)

    expect(result.canExport).toBe(true)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'export.missing-linked-resource',
        severity: 'warning',
      }),
    )
  })

  it('blocks a manifest resource missing from the archive', async () => {
    const opened = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'missing-manifest.epub',
    )
    const manifest = new Map(opened.packageDocument.manifest)
    manifest.set('missing', {
      archivePath: 'OEBPS/missing.css',
      href: 'missing.css',
      id: 'missing',
      mediaType: 'text/css',
      properties: [],
    })
    const publication = {
      ...opened,
      packageDocument: { ...opened.packageDocument, manifest },
    }

    const result = validateExportSession(createEditSession(publication))

    expect(result.canExport).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'export.missing-manifest-resource' }),
    )
  })
})
