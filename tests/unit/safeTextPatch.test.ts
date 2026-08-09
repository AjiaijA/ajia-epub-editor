import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  applySafeTextPatch,
  createMarkupFingerprint,
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

  it('deletes an isolated whole text token without changing its inline markup', () => {
    const source =
      '<html xmlns="http://www.w3.org/1999/xhtml"><body><p class="outer"><span class="one"><big class="two"><span class="three">J</span></big>1970年1月4日，<em>保留标签</em>与其余正文。</span></p></body></html>'
    const target = findEditableTextSegments(source).find(
      (segment) => segment.decodedText === 'J',
    )
    expect(target).toBeDefined()
    if (target === undefined) throw new Error('Isolated token missing')

    const beforeMarkup = createMarkupFingerprint(source)
    const beforeStructure = createStructuralFingerprint(source)
    const result = applySafeTextPatch(source, target, '')

    expect(result.escapedReplacement).toBe('')
    expect(result.source).toBe(
      source.slice(0, target.start) + source.slice(target.end),
    )
    expect(result.source).toContain(
      '<big class="two"><span class="three"></span></big>1970年1月4日，',
    )
    expect(createMarkupFingerprint(result.source)).toBe(beforeMarkup)
    expect(createStructuralFingerprint(result.source)).not.toBe(beforeStructure)
    expect(
      findEditableTextSegments(result.source).map((item) => item.decodedText),
    ).toEqual(['1970年1月4日，', '保留标签', '与其余正文。'])
  })

  it('patches text around a safe external XHTML doctype without changing it', () => {
    const doctype =
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN"\n  "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">'
    const source = `${doctype}\n<html><body><p>before <em>inline</em> after</p></body></html>`
    const segment = findEditableTextSegments(source).at(-1)
    expect(segment?.decodedText).toBe(' after')
    if (segment === undefined) throw new Error('Target segment missing')

    const result = applySafeTextPatch(source, segment, ' & <revised>')

    expect(result.source.startsWith(`${doctype}\n`)).toBe(true)
    expect(result.source).toContain('<em>inline</em> &amp; &lt;revised&gt;')
    expect(result.source.slice(0, segment.start)).toBe(
      source.slice(0, segment.start),
    )
  })

  it('preserves full-width indentation and untouched whitespace-only nodes', () => {
    const source =
      '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>　　正文<br/>　　</p></body></html>'
    const segments = findEditableTextSegments(source)

    expect(segments.map((segment) => segment.decodedText)).toEqual(['　　正文'])
    const target = segments[0]
    if (target === undefined) throw new Error('Indented text segment missing')

    const result = applySafeTextPatch(source, target, '　　修订正文')

    expect(result.source).toBe(
      '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>　　修订正文<br/>　　</p></body></html>',
    )
  })

  it('maps text around XML self-closing elements and rejects HTML-style void tags', () => {
    const valid =
      '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>前<br/>后<hr /></p></body></html>'

    expect(
      findEditableTextSegments(valid).map((segment) => segment.decodedText),
    ).toEqual(['前', '后'])

    const invalid =
      '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>前<br>后</p></body></html>'
    expect(() => findEditableTextSegments(invalid)).toThrow(
      'Opening and ending tag mismatch',
    )
  })

  it('refuses an internal DTD subset and custom entity declaration', () => {
    const source =
      '<!DOCTYPE html [<!ENTITY secret "unsafe">]><html><body>&secret;</body></html>'
    expect(() => findEditableTextSegments(source)).toThrow('DOCTYPE')
  })

  it.each([
    '<!DOCTYPE html><!DOCTYPE html><html><body>text</body></html>',
    '<!DOCTYPE html PUBLIC "unfinished><html><body>text</body></html>',
  ])('refuses ambiguous or unterminated doctype input', (source) => {
    expect(() => findEditableTextSegments(source)).toThrow('DOCTYPE')
  })
})
