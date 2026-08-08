import { describe, expect, it } from 'vitest'

import { openEpubPublication } from '../../src/epub/parser/publication.js'
import { createSandboxedPreview } from '../../src/epub/preview/createPreview.js'
import {
  createEditSession,
  getChapterTextSegments,
} from '../../src/epub/editor/editSession.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('sandbox preview source', () => {
  it('removes active and remote content while embedding controlled local resources', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub3-nav'),
      'preview.epub',
    )
    const chapter = publication.chapters[0]
    expect(chapter).toBeDefined()
    if (chapter === undefined) throw new Error('Fixture chapter missing')

    const preview = createSandboxedPreview(chapter, publication.archive)
    expect(preview.html).toContain('Content-Security-Policy')
    expect(preview.html).not.toMatch(
      /<script|<iframe|http-equiv="refresh"|onload=/u,
    )
    expect(preview.html).not.toMatch(/\s(?:src|href)="https:\/\/example\.com/u)
    expect(preview.html).not.toContain('url("https://example.com')
    expect(preview.html).toContain('data:image/svg+xml;base64,')
    expect(preview.html).toContain(
      'data-epub-source="Books/内容/Styles/book.css"',
    )
    expect(preview.html).toContain('data-epub-href="https://example.com"')
    expect(preview.html).not.toMatch(/<a[^>]+\shref=/u)
    expect(preview.blockedResourceCount).toBeGreaterThan(0)
  })

  it('wraps only verified source text nodes for safe visual editing', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'editable-preview.epub',
    )
    const chapter = publication.chapters[0]
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const segments = getChapterTextSegments(
      createEditSession(publication),
      chapter.archivePath,
    )

    const preview = createSandboxedPreview(chapter, publication.archive, {
      editableSegments: segments,
    })

    expect(preview.editableSegmentCount).toBe(segments.length)
    expect(preview.html.match(/data-epub-segment-id=/gu)).toHaveLength(
      segments.length,
    )
    expect(preview.html).toContain('contenteditable="plaintext-only"')
    expect(preview.html).toContain('data-ajia-safe-editor="true"')
  })
})
