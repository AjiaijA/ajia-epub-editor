import type {
  EpubArchive,
  EpubIssue,
  ManifestItem,
  PackageDocument,
  SpineItem,
} from '../../models/publication.js'
import { resolveArchiveHref } from '../archive/pathSafety.js'
import {
  attributeByLocalName,
  decodeUtf8Xml,
  descendantsByLocalName,
  directChildElements,
  normalizedText,
  parseXml,
} from './xml.js'

const PACKAGE_MEDIA_TYPE = 'application/oebps-package+xml'

export function locatePackagePath(
  archive: EpubArchive,
  issues: EpubIssue[],
): string {
  const entry = archive.entries.get('META-INF/container.xml')
  if (entry === undefined) throw new Error('META-INF/container.xml is missing.')
  const { source } = decodeUtf8Xml(entry.originalData)
  const document = parseXml(source, 'container.xml')
  const rootfiles = descendantsByLocalName(document, 'rootfile')
  if (rootfiles.length === 0) throw new Error('container.xml has no rootfile.')
  if (rootfiles.length > 1) {
    issues.push({
      code: 'container.multiple-rootfiles',
      message:
        'container.xml has multiple rootfiles; the first EPUB package was selected.',
      path: 'META-INF/container.xml',
      severity: 'info',
    })
  }
  const preferred =
    rootfiles.find(
      (rootfile) => rootfile.getAttribute('media-type') === PACKAGE_MEDIA_TYPE,
    ) ?? rootfiles[0]
  const packagePath = preferred?.getAttribute('full-path')?.trim()
  if (packagePath === undefined || packagePath === '') {
    throw new Error('The container.xml rootfile is missing full-path.')
  }
  const resolved = resolveArchiveHref('container.xml', packagePath)
  if (resolved.external || resolved.path === null)
    throw new Error('The package path is invalid.')
  if (!archive.entries.has(resolved.path))
    throw new Error('The package referenced by container.xml does not exist.')
  return resolved.path
}

export function parsePackageDocument(
  archive: EpubArchive,
  packagePath: string,
  issues: EpubIssue[],
): PackageDocument {
  const entry = archive.entries.get(packagePath)
  if (entry === undefined) throw new Error('The package document is missing.')
  const { source } = decodeUtf8Xml(entry.originalData)
  const document = parseXml(source, packagePath)
  const packageElement = document.documentElement
  if (
    packageElement === null ||
    (packageElement.localName ?? packageElement.tagName) !== 'package'
  ) {
    throw new Error('The package document root element is not package.')
  }

  const version = packageElement.getAttribute('version') ?? ''
  const epubVersion = version.startsWith('3')
    ? '3'
    : version.startsWith('2')
      ? '2'
      : 'unknown'
  if (epubVersion === 'unknown') {
    issues.push({
      code: 'package.unknown-version',
      message: `Unrecognized EPUB version: “${version || 'empty'}”.`,
      path: packagePath,
      severity: 'warning',
    })
  }

  const manifest = new Map<string, ManifestItem>()
  const manifestElement = descendantsByLocalName(document, 'manifest')[0]
  if (manifestElement === undefined)
    throw new Error('The package document is missing its manifest.')
  for (const item of directChildElements(manifestElement, 'item')) {
    const id = item.getAttribute('id')?.trim() ?? ''
    const href = item.getAttribute('href')?.trim() ?? ''
    const mediaType = item.getAttribute('media-type')?.trim() ?? ''
    if (id === '' || href === '' || mediaType === '') {
      issues.push({
        code: 'manifest.incomplete-item',
        message: 'A manifest item is missing id, href, or media-type.',
        path: packagePath,
        severity: 'warning',
      })
      continue
    }
    if (manifest.has(id)) {
      issues.push({
        code: 'manifest.duplicate-id',
        message: `Duplicate manifest id: “${id}”.`,
        path: packagePath,
        severity: 'error',
      })
      continue
    }
    let archivePath: string | null = null
    try {
      const resolved = resolveArchiveHref(packagePath, href)
      archivePath = resolved.external ? null : resolved.path
    } catch (cause) {
      issues.push({
        code: 'manifest.unsafe-href',
        ...(cause instanceof Error ? { detail: cause.message } : {}),
        message: `Manifest item “${id}” has an unsafe path.`,
        path: packagePath,
        severity: 'error',
      })
    }
    const properties = (item.getAttribute('properties') ?? '')
      .split(/\s+/u)
      .filter(Boolean)
    manifest.set(id, { archivePath, href, id, mediaType, properties })
    if (archivePath !== null && !archive.entries.has(archivePath)) {
      issues.push({
        code: 'manifest.missing-resource',
        message: `Manifest resource “${href}” is missing.`,
        path: archivePath,
        severity: 'warning',
      })
    }
  }

  const spineElement = descendantsByLocalName(document, 'spine')[0]
  if (spineElement === undefined)
    throw new Error('The package document is missing its spine.')
  const spine: SpineItem[] = directChildElements(spineElement, 'itemref').map(
    (itemref, index) => {
      const idref = itemref.getAttribute('idref')?.trim() ?? ''
      const manifestItem = manifest.get(idref) ?? null
      if (manifestItem === null) {
        issues.push({
          code: 'spine.missing-manifest-item',
          message: `Spine idref “${idref || 'empty'}” has no matching manifest item.`,
          path: packagePath,
          severity: 'warning',
        })
      }
      return {
        idref,
        index,
        linear: itemref.getAttribute('linear') !== 'no',
        manifestItem,
      }
    },
  )
  const titleElement = descendantsByLocalName(document, 'title')[0] ?? null
  const title = normalizedText(titleElement) || 'Untitled EPUB'

  const fixedLayout = descendantsByLocalName(document, 'meta').some(
    (meta) =>
      (attributeByLocalName(meta, 'property') === 'rendition:layout' &&
        normalizedText(meta) === 'pre-paginated') ||
      (attributeByLocalName(meta, 'name') === 'fixed-layout' &&
        attributeByLocalName(meta, 'content') === 'true'),
  )
  if (fixedLayout) {
    issues.push({
      code: 'package.fixed-layout',
      message:
        'This publication declares fixed layout and is limited to downgraded read-only viewing.',
      path: packagePath,
      severity: 'warning',
    })
  }

  return {
    epubVersion,
    manifest,
    packagePath,
    spine,
    spineTocId: spineElement.getAttribute('toc')?.trim() || null,
    title,
  }
}
