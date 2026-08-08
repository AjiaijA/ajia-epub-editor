import { describe, expect, it } from 'vitest'

import {
  commitVisualText,
  createEditSession,
  getChapterSource,
  getChapterTextSegments,
  SourceValidationError,
} from '../../src/epub/editor/editSession.js'
import { openEpubPublication } from '../../src/epub/parser/publication.js'
import {
  applySafeTextPatch,
  createStructuralFingerprint,
  findSafeVisualTextSegments,
} from '../../src/epub/text/safeTextPatch.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('safe visual text editing', () => {
  it('maps complex inline text and changes only one source token', () => {
    const source =
      '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><p>开头 <em>强调</em> &amp; 结尾。</p><!--保留--></body></html>'
    const segments = findSafeVisualTextSegments(source, 'chapter.xhtml', 7)
    expect(segments.map((segment) => segment.decodedText)).toEqual([
      '开头 ',
      '强调',
      ' & 结尾。',
    ])
    const target = segments[2]
    if (target === undefined) throw new Error('Target segment missing')
    const replacement = ' & 改成 <安全> 句子。'
    const beforeFingerprint = createStructuralFingerprint(source)

    const patched = applySafeTextPatch(source, target, replacement, 7)

    expect(patched.structuralFingerprint).toBe(beforeFingerprint)
    expect(patched.source.slice(0, target.sourceStart)).toBe(
      source.slice(0, target.sourceStart),
    )
    expect(patched.source).toContain('&amp; 改成 &lt;安全&gt; 句子。')
    expect(patched.source).toContain('<em>强调</em>')
    expect(patched.source).toContain('<!--保留-->')
    expect(patched.source.slice(-15)).toBe(source.slice(-15))
  })

  it('commits one visual transaction and invalidates the old segment ID', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'visual.epub',
    )
    const chapter = publication.chapters[0]
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const session = createEditSession(publication)
    const segment = getChapterTextSegments(session, chapter.archivePath).find(
      (candidate) => candidate.decodedText.includes('EPUB 2'),
    )
    if (segment === undefined) throw new Error('Editable segment missing')

    const edited = commitVisualText(
      session,
      chapter.archivePath,
      segment.id,
      '这是安全可视编辑的 & <新句子>。',
    )

    expect(edited.dirtyEntries).toEqual(new Set([chapter.archivePath]))
    expect(edited.transactions.at(-1)?.type).toBe('text-edit')
    expect(getChapterSource(edited, chapter.archivePath)).toContain(
      '这是安全可视编辑的 &amp; &lt;新句子&gt;。',
    )
    expect(
      getChapterTextSegments(edited, chapter.archivePath).some(
        (candidate) => candidate.id === segment.id,
      ),
    ).toBe(false)
    expect(() =>
      commitVisualText(edited, chapter.archivePath, segment.id, '过期修改'),
    ).toThrow(SourceValidationError)
  })

  it('downgrades script-driven content from safe visual mapping', () => {
    expect(() =>
      findSafeVisualTextSegments(
        '<html><body><script>run()</script><p>文字</p></body></html>',
        'script.xhtml',
        0,
      ),
    ).toThrow('requires source mode')
  })
})
