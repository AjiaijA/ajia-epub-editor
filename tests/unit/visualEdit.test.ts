import { describe, expect, it } from 'vitest'

import {
  commitVisualText,
  createEditSession,
  getChapterSource,
  getChapterTextSegments,
  redoEdit,
  SourceValidationError,
  undoEdit,
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

    const undone = undoEdit(edited)
    expect(getChapterSource(undone, chapter.archivePath)).toBe(
      chapter.originalSource,
    )
    expect(getChapterSource(redoEdit(undone), chapter.archivePath)).toBe(
      getChapterSource(edited, chapter.archivePath),
    )
  })

  it('commits deletion of an isolated text token and keeps later edits usable', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'visual-delete.epub',
    )
    const chapter = publication.chapters[0]
    if (chapter === undefined) throw new Error('Fixture chapter missing')
    const session = createEditSession(publication)
    const original = getChapterSource(session, chapter.archivePath)
    const seeded = original.replace(
      '<body>',
      '<body><p><big><span>J</span></big>1970年，<em>叔叔</em>来访。</p>',
    )
    const seededSession = {
      ...session,
      currentSources: new Map([[chapter.archivePath, seeded]]),
    }
    const isolated = getChapterTextSegments(
      seededSession,
      chapter.archivePath,
    ).find((segment) => segment.decodedText === 'J')
    if (isolated === undefined) throw new Error('Isolated token missing')

    const deleted = commitVisualText(
      seededSession,
      chapter.archivePath,
      isolated.id,
      '',
    )
    expect(getChapterSource(deleted, chapter.archivePath)).toContain(
      '<big><span></span></big>1970年，<em>叔叔</em>来访。',
    )
    const later = getChapterTextSegments(deleted, chapter.archivePath).find(
      (segment) => segment.decodedText === '叔叔',
    )
    if (later === undefined) throw new Error('Later token missing')
    const edited = commitVisualText(
      deleted,
      chapter.archivePath,
      later.id,
      '姨父',
    )
    expect(getChapterSource(edited, chapter.archivePath)).toContain(
      '<big><span></span></big>1970年，<em>姨父</em>来访。',
    )
    expect(getChapterSource(edited, chapter.archivePath)).not.toContain('>J<')
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
