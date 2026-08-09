import { describe, expect, it } from 'vitest'
import { strToU8 } from 'fflate'

import {
  extractArchive,
  writeEpubArchive,
} from '../../src/epub/archive/epubZip.js'
import { openEpubPublication } from '../../src/epub/parser/publication.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('open EPUB publication', () => {
  it('opens EPUB 3 with Unicode paths, nested NAV, alternate NCX, and spine order', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub3-nav'),
      'phase-1-epub3.epub',
    )

    expect(publication.epubVersion).toBe('3')
    expect(publication.packagePath).toBe('Books/内容/package.opf')
    expect(publication.packageDocument.title).toBe('阶段一 EPUB 3 测试书')
    expect(publication.chapters.map((chapter) => chapter.archivePath)).toEqual([
      'Books/内容/Text/第一章.xhtml',
      'Books/内容/Text/第二章.xhtml',
    ])
    expect(publication.chapters[1]?.linear).toBe(false)
    expect(publication.navigation.source).toBe('nav')
    expect(publication.navigation.items[0]?.children[0]?.label).toBe('第一节')
    expect(publication.navigation.alternateItems).toHaveLength(2)
  })

  it('opens EPUB 2 and uses NCX navigation', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('epub2-ncx'),
      'phase-1-epub2.epub',
    )
    expect(publication.epubVersion).toBe('2')
    expect(publication.navigation.source).toBe('ncx')
    expect(publication.navigation.items[0]).toMatchObject({
      label: '唯一章节',
      normalizedTarget: 'OEBPS/text/chapter.xhtml',
    })
    expect(publication.chapters[0]?.visualEditCapability).toBe('safe')
    expect(publication.chapters[0]?.originalSource).toContain(
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN"',
    )
    expect(publication.issues.map((issue) => issue.code)).not.toContain(
      'chapter.invalid-xhtml',
    )
  })

  it('falls back to spine order when no NAV or NCX exists', async () => {
    const publication = openEpubPublication(
      await buildFixtureArchive('minimal-epub'),
      'fallback.epub',
    )
    expect(publication.navigation.source).toBe('spine')
    expect(publication.issues.map((issue) => issue.code)).toContain(
      'navigation.spine-fallback',
    )
  })

  it('does not preview a chapter referenced by encryption.xml', async () => {
    const entries = new Map(
      extractArchive(await buildFixtureArchive('epub3-nav')),
    )
    entries.set(
      'META-INF/encryption.xml',
      strToU8(
        '<?xml version="1.0"?><encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><EncryptedData xmlns="http://www.w3.org/2001/04/xmlenc#"><CipherData><CipherReference URI="../Books/%E5%86%85%E5%AE%B9/Text/%E7%AC%AC%E4%B8%80%E7%AB%A0.xhtml"/></CipherData></EncryptedData></encryption>',
      ),
    )
    const publication = openEpubPublication(
      writeEpubArchive(entries),
      'encrypted.epub',
    )
    expect(publication.chapters[0]?.visualEditCapability).toBe('source-only')
    expect(publication.issues.map((issue) => issue.code)).toContain(
      'chapter.encrypted',
    )
  })

  it('records missing manifest resources without losing readable chapters', async () => {
    const entries = new Map(
      extractArchive(await buildFixtureArchive('epub3-nav')),
    )
    const packagePath = 'Books/内容/package.opf'
    const packageSource = new TextDecoder().decode(entries.get(packagePath))
    entries.set(
      packagePath,
      strToU8(packageSource.replace('Text/第二章.xhtml', 'Text/missing.xhtml')),
    )
    const publication = openEpubPublication(
      writeEpubArchive(entries),
      'missing-resource.epub',
    )
    expect(publication.chapters).toHaveLength(1)
    expect(publication.issues.map((issue) => issue.code)).toContain(
      'manifest.missing-resource',
    )
  })

  it('disables safe editing for fixed-layout publications', async () => {
    const entries = new Map(
      extractArchive(await buildFixtureArchive('epub3-nav')),
    )
    const packagePath = 'Books/内容/package.opf'
    const packageSource = new TextDecoder().decode(entries.get(packagePath))
    entries.set(
      packagePath,
      strToU8(
        packageSource.replace(
          '<meta property="dcterms:modified">',
          '<meta property="rendition:layout">pre-paginated</meta>\n    <meta property="dcterms:modified">',
        ),
      ),
    )

    const publication = openEpubPublication(
      writeEpubArchive(entries),
      'fixed-layout.epub',
    )

    expect(publication.packageDocument.fixedLayout).toBe(true)
    expect(
      publication.chapters.map((chapter) => chapter.visualEditCapability),
    ).toEqual(['readonly', 'readonly'])
    expect(publication.issues.map((issue) => issue.code)).toContain(
      'package.fixed-layout',
    )
  })
})
