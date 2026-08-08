import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { preflightArchive } from '../../src/epub/archive/preflight.js'
import { EpubOpenError } from '../../src/models/publication.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('ZIP central-directory safety preflight', () => {
  it('accepts the self-authored EPUB before extraction', async () => {
    const result = preflightArchive(await buildFixtureArchive('epub3-nav'))
    expect(
      result.entries.some((entry) =>
        entry.normalizedPath.endsWith('第一章.xhtml'),
      ),
    ).toBe(true)
  })

  it.each([
    ['parent traversal', '../outside.xhtml', 'archive.unsafe-path'],
    ['absolute path', '/outside.xhtml', 'archive.unsafe-path'],
    ['drive path', 'C:/outside.xhtml', 'archive.unsafe-path'],
  ])('rejects %s before extraction', (_label, unsafePath, expectedCode) => {
    const archive = zipSync({
      mimetype: [strToU8('application/epub+zip'), { level: 0 }],
      [unsafePath]: strToU8('blocked'),
    })
    expectIssueCode(() => preflightArchive(archive), expectedCode)
  })

  it('rejects paths that collide after normalization', () => {
    const archive = zipSync({
      mimetype: [strToU8('application/epub+zip'), { level: 0 }],
      'EPUB/./chapter.xhtml': strToU8('one'),
      'EPUB/chapter.xhtml': strToU8('two'),
    })
    expectIssueCode(() => preflightArchive(archive), 'archive.duplicate-path')
  })

  it('enforces configured size and compression-ratio bounds from metadata', () => {
    const archive = zipSync({
      mimetype: [strToU8('application/epub+zip'), { level: 0 }],
      'EPUB/repeated.txt': strToU8('A'.repeat(2_000)),
    })
    expectIssueCode(
      () =>
        preflightArchive(archive, {
          maxCompressionRatio: 2,
          maxEntries: 10,
          maxEntryUncompressedBytes: 4_000,
          maxFileBytes: 10_000,
          maxTotalUncompressedBytes: 4_000,
        }),
      'archive.suspicious-compression-ratio',
    )
  })

  it('cross-checks local filenames against the central directory', async () => {
    const archive = (await buildFixtureArchive('epub3-nav')).slice()
    archive[30] = 'x'.charCodeAt(0)
    expectIssueCode(
      () => preflightArchive(archive),
      'archive.header-name-mismatch',
    )
  })

  it('rejects central entries that alias one local header', async () => {
    const archive = (await buildFixtureArchive('epub3-nav')).slice()
    const view = new DataView(
      archive.buffer,
      archive.byteOffset,
      archive.byteLength,
    )
    const eocdOffset = findSignatureFromEnd(view, 0x06054b50)
    const firstCentralOffset = view.getUint32(eocdOffset + 16, true)
    const firstNameLength = view.getUint16(firstCentralOffset + 28, true)
    const firstExtraLength = view.getUint16(firstCentralOffset + 30, true)
    const firstCommentLength = view.getUint16(firstCentralOffset + 32, true)
    const secondCentralOffset =
      firstCentralOffset +
      46 +
      firstNameLength +
      firstExtraLength +
      firstCommentLength
    view.setUint32(secondCentralOffset + 42, 0, true)

    expectIssueCode(
      () => preflightArchive(archive),
      'archive.duplicate-local-offset',
    )
  })
})

function expectIssueCode(run: () => unknown, code: string): void {
  try {
    run()
    throw new Error('Expected archive preflight to fail')
  } catch (cause) {
    expect(cause).toBeInstanceOf(EpubOpenError)
    if (!(cause instanceof EpubOpenError)) throw cause
    expect(cause.issues.map((issue) => issue.code)).toContain(code)
  }
}

function findSignatureFromEnd(view: DataView, signature: number): number {
  for (let offset = view.byteLength - 4; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === signature) return offset
  }
  throw new Error('ZIP signature not found in fixture')
}
