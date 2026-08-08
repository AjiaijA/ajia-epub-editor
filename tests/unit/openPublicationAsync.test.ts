import { describe, expect, it } from 'vitest'

import { openPublicationAsync } from '../../src/app/openPublicationAsync.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('background EPUB open client', () => {
  it('honors cancellation before starting work', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      openPublicationAsync(
        new Uint8Array(),
        'cancelled.epub',
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('uses the same parser contract when Worker is unavailable', async () => {
    const publication = await openPublicationAsync(
      await buildFixtureArchive('epub2-ncx'),
      'worker-fallback.epub',
    )
    expect(publication.navigation.source).toBe('ncx')
  })
})
