import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  EPUB_MIMETYPE,
  assertEpubMimetypeHeader,
  extractArchive,
  readLocalFileHeaders,
  writeEpubArchive,
} from '../../src/epub/archive/epubZip.js'

const fixtureRoot = new URL('../fixtures/minimal-epub/', import.meta.url)
const cleanPaths = [
  'META-INF/container.xml',
  'EPUB/package.opf',
  'EPUB/chapter.xhtml',
] as const

describe('EPUB ZIP round-trip spike', () => {
  it('writes byte-exact mimetype first and STOREs it without an extra field', async () => {
    const entries = await loadFixtureEntries()
    const archive = writeEpubArchive(entries)

    assertEpubMimetypeHeader(archive)
    const [first] = readLocalFileHeaders(archive)
    expect(first).toMatchObject({
      compressionMethod: 0,
      extraFieldLength: 0,
      fileName: 'mimetype',
      offset: 0,
      uncompressedSize: new TextEncoder().encode(EPUB_MIMETYPE).byteLength,
    })
    expect(extractArchive(archive).get('mimetype')).toEqual(
      new TextEncoder().encode(EPUB_MIMETYPE),
    )
  })

  it('preserves every clean entry payload byte after extraction', async () => {
    const entries = await loadFixtureEntries()
    const extracted = extractArchive(writeEpubArchive(entries))

    expect([...extracted.keys()]).toEqual(['mimetype', ...cleanPaths])
    for (const path of cleanPaths) {
      expect(extracted.get(path), path).toEqual(entries.get(path))
    }
  })
})

async function loadFixtureEntries(): Promise<Map<string, Uint8Array>> {
  const entries = new Map<string, Uint8Array>()
  entries.set('mimetype', new TextEncoder().encode(EPUB_MIMETYPE))
  for (const path of cleanPaths) {
    entries.set(
      path,
      new Uint8Array(await readFile(fileURLToPath(new URL(path, fixtureRoot)))),
    )
  }
  return entries
}
