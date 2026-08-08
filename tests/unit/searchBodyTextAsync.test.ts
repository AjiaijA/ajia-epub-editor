import { describe, expect, it } from 'vitest'

import { searchBodyTextAsync } from '../../src/app/searchBodyTextAsync.js'
import { createEditSession } from '../../src/epub/editor/editSession.js'
import { openEpubPublication } from '../../src/epub/parser/publication.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('background body search boundary', () => {
  it('uses the deterministic fallback when Worker is unavailable', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'async-search.epub',
    )
    const results = await searchBodyTextAsync(
      createEditSession(publication),
      '测试文字',
      'book',
    )
    expect(results).toHaveLength(1)
  })

  it('rejects an already cancelled search', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'cancel-search.epub',
    )
    const controller = new AbortController()
    controller.abort()
    await expect(
      searchBodyTextAsync(
        createEditSession(publication),
        '测试文字',
        'book',
        undefined,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
