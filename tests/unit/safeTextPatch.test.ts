import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  applySafeTextPatch,
  createStructuralFingerprint,
  findEditableTextSegments,
} from '../../src/epub/text/safeTextPatch.js'

const fixtureUrl = new URL(
  '../fixtures/minimal-epub/EPUB/chapter.xhtml',
  import.meta.url,
)

describe('safe XHTML text-patch spike', () => {
  it('changes one entity-bearing token around an inline tag and nothing else', async () => {
    const source = await readFile(fileURLToPath(fixtureUrl), 'utf8')
    const segments = findEditableTextSegments(source)
    const target = segments.find(
      (segment) => segment.rawSource === ' &amp; after.',
    )
    expect(target).toBeDefined()
    if (target === undefined)
      throw new Error('Fixture target segment is missing')

    const beforeFingerprint = createStructuralFingerprint(source)
    const replacement = ' & revised <safe> > final'
    const result = applySafeTextPatch(source, target, replacement)

    expect(result.escapedReplacement).toBe(
      ' &amp; revised &lt;safe&gt; &gt; final',
    )
    expect(result.structuralFingerprint).toBe(beforeFingerprint)
    expect(result.source.slice(0, target.start)).toBe(
      source.slice(0, target.start),
    )
    expect(
      result.source.slice(
        target.start,
        target.start + result.escapedReplacement.length,
      ),
    ).toBe(result.escapedReplacement)
    expect(
      result.source.slice(target.start + result.escapedReplacement.length),
    ).toBe(source.slice(target.end))
    expect(result.source).toContain('<em>inline</em>')
    expect(result.source).toContain('<?fixture preserve?>')
    expect(result.source).toContain('<!-- preserve-comment -->')
    expect(result.source).toContain('<![CDATA[const marker = "<&>";]]>')

    const patchedSegments = findEditableTextSegments(result.source)
    expect(
      patchedSegments
        .map((segment) => segment.decodedText)
        .filter((text) => text.trim().length > 0),
    ).toEqual(['Before ', 'inline', replacement])
  })

  it('rejects a stale segment instead of patching an uncertain offset', async () => {
    const source = await readFile(fileURLToPath(fixtureUrl), 'utf8')
    const target = findEditableTextSegments(source).at(-1)
    expect(target).toBeDefined()
    if (target === undefined)
      throw new Error('Fixture target segment is missing')

    expect(() =>
      applySafeTextPatch(source.replace('Before', 'Changed'), target, 'x'),
    ).toThrow('stale')
  })

  it('refuses DTD input outside the safe patch boundary', () => {
    const source = '<!DOCTYPE html><html><body>text</body></html>'
    expect(() => findEditableTextSegments(source)).toThrow('DOCTYPE')
  })
})
