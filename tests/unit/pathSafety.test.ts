import { describe, expect, it } from 'vitest'

import {
  normalizeArchiveEntryPath,
  resolveArchiveHref,
} from '../../src/epub/archive/pathSafety.js'

describe('archive path safety', () => {
  it('normalizes safe entry paths and rejects archive traversal', () => {
    expect(normalizeArchiveEntryPath('./EPUB//chapter.xhtml')).toBe(
      'EPUB/chapter.xhtml',
    )
    expect(() => normalizeArchiveEntryPath('../chapter.xhtml')).toThrow(
      'traversal',
    )
    expect(() => normalizeArchiveEntryPath('C:/chapter.xhtml')).toThrow(
      'absolute',
    )
    expect(() => normalizeArchiveEntryPath('EPUB\\chapter.xhtml')).toThrow(
      'backslash',
    )
  })

  it('resolves legal parent segments and percent-encoded Unicode hrefs', () => {
    expect(
      resolveArchiveHref(
        'Books/内容/package.opf',
        'Text/%E7%AC%AC%E4%B8%80%E7%AB%A0.xhtml#start',
      ),
    ).toMatchObject({
      path: 'Books/内容/Text/第一章.xhtml',
      normalizedTarget: 'Books/内容/Text/第一章.xhtml#start',
    })
    expect(
      resolveArchiveHref('Books/Text/chapter.xhtml', '../Images/封面.png').path,
    ).toBe('Books/Images/封面.png')
  })

  it('marks remote targets and rejects encoded separators', () => {
    expect(
      resolveArchiveHref('EPUB/chapter.xhtml', 'https://example.com/a')
        .external,
    ).toBe(true)
    expect(() =>
      resolveArchiveHref('EPUB/chapter.xhtml', '%2e%2e/secret'),
    ).toThrow('encoded traversal')
    expect(() =>
      resolveArchiveHref('EPUB/chapter.xhtml', 'a%2Fb.xhtml'),
    ).toThrow('separator')
  })

  it('resolves a fragment-only href to the current document', () => {
    expect(resolveArchiveHref('EPUB/chapter.xhtml', '#note')).toMatchObject({
      path: 'EPUB/chapter.xhtml',
      normalizedTarget: 'EPUB/chapter.xhtml#note',
    })
  })
})
