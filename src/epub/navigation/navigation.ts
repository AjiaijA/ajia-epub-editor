import type {
  EpubArchive,
  EpubIssue,
  NavigationItem,
  NavigationModel,
  PackageDocument,
} from '../../models/publication.js'
import { resolveArchiveHref } from '../archive/pathSafety.js'
import {
  attributeByLocalName,
  decodeUtf8Xml,
  descendantsByLocalName,
  directChildElements,
  normalizedText,
  parseXml,
} from '../parser/xml.js'

export function parseNavigation(
  archive: EpubArchive,
  packageDocument: PackageDocument,
  fallbackItems: readonly NavigationItem[],
  issues: EpubIssue[],
): NavigationModel {
  const navManifestItem = [...packageDocument.manifest.values()].find((item) =>
    item.properties.includes('nav'),
  )
  const navItems =
    navManifestItem?.archivePath === null || navManifestItem === undefined
      ? []
      : parseNavDocument(archive, navManifestItem.archivePath, issues)

  const ncxManifestItem =
    packageDocument.spineTocId === null
      ? [...packageDocument.manifest.values()].find(
          (item) => item.mediaType === 'application/x-dtbncx+xml',
        )
      : packageDocument.manifest.get(packageDocument.spineTocId)
  const ncxItems =
    ncxManifestItem?.archivePath === null || ncxManifestItem === undefined
      ? []
      : parseNcxDocument(archive, ncxManifestItem.archivePath, issues)

  if (
    navItems.length > 0 &&
    ncxItems.length > 0 &&
    !sameTargets(navItems, ncxItems)
  ) {
    issues.push({
      code: 'navigation.sources-differ',
      message:
        'NAV and NCX targets do not match completely; NAV is used for reading navigation.',
      severity: 'warning',
    })
  }
  if (navItems.length > 0)
    return { alternateItems: ncxItems, items: navItems, source: 'nav' }
  if (ncxItems.length > 0)
    return { alternateItems: [], items: ncxItems, source: 'ncx' }

  issues.push({
    code: 'navigation.spine-fallback',
    message:
      'No recognized standard navigation was found; chapters are shown in spine order.',
    severity: 'warning',
  })
  return { alternateItems: [], items: fallbackItems, source: 'spine' }
}

function parseNavDocument(
  archive: EpubArchive,
  path: string,
  issues: EpubIssue[],
): readonly NavigationItem[] {
  const entry = archive.entries.get(path)
  if (entry === undefined) return []
  try {
    const { source } = decodeUtf8Xml(entry.originalData)
    const document = parseXml(source, path)
    const toc = descendantsByLocalName(document, 'nav').find((nav) => {
      const type = attributeByLocalName(nav, 'type') ?? ''
      return type.split(/\s+/u).includes('toc')
    })
    if (toc === undefined) return []
    const list = directChildElements(toc, 'ol')[0]
    return list === undefined
      ? []
      : parseNavList(list, path, issues, { value: 0 })
  } catch (cause) {
    issues.push(
      navigationError(
        'navigation.invalid-nav',
        'The EPUB 3 NAV could not be parsed.',
        path,
        cause,
      ),
    )
    return []
  }
}

function parseNavList(
  list: import('@xmldom/xmldom').Element,
  documentPath: string,
  issues: EpubIssue[],
  sequence: { value: number },
): readonly NavigationItem[] {
  return directChildElements(list, 'li').flatMap((listItem) => {
    const link = directChildElements(listItem).find((element) => {
      const name = element.localName ?? element.tagName
      return name === 'a' || name === 'span'
    })
    const nestedList = directChildElements(listItem, 'ol')[0]
    const label = normalizedText(link ?? null)
    const href = link?.getAttribute('href') ?? ''
    if (label === '') return []
    sequence.value += 1
    return [
      createNavigationItem(
        `nav-${String(sequence.value)}`,
        label,
        href,
        documentPath,
        'nav',
        nestedList === undefined
          ? []
          : parseNavList(nestedList, documentPath, issues, sequence),
        issues,
      ),
    ]
  })
}

function parseNcxDocument(
  archive: EpubArchive,
  path: string,
  issues: EpubIssue[],
): readonly NavigationItem[] {
  const entry = archive.entries.get(path)
  if (entry === undefined) return []
  try {
    const { source } = decodeUtf8Xml(entry.originalData)
    const document = parseXml(source, path)
    const navMap = descendantsByLocalName(document, 'navMap')[0]
    if (navMap === undefined) return []
    return parseNavPoints(navMap, path, issues, { value: 0 })
  } catch (cause) {
    issues.push(
      navigationError(
        'navigation.invalid-ncx',
        'The EPUB 2 NCX could not be parsed.',
        path,
        cause,
      ),
    )
    return []
  }
}

function parseNavPoints(
  parent: import('@xmldom/xmldom').Element,
  documentPath: string,
  issues: EpubIssue[],
  sequence: { value: number },
): readonly NavigationItem[] {
  return directChildElements(parent, 'navPoint').map((navPoint) => {
    const navLabel = directChildElements(navPoint, 'navLabel')[0]
    const label = normalizedText(
      navLabel === undefined
        ? null
        : (descendantsByLocalName(navLabel, 'text')[0] ?? null),
    )
    const href =
      directChildElements(navPoint, 'content')[0]?.getAttribute('src') ?? ''
    sequence.value += 1
    return createNavigationItem(
      `ncx-${String(sequence.value)}`,
      label || 'Untitled navigation item',
      href,
      documentPath,
      'ncx',
      parseNavPoints(navPoint, documentPath, issues, sequence),
      issues,
    )
  })
}

function createNavigationItem(
  id: string,
  label: string,
  href: string,
  documentPath: string,
  kind: 'nav' | 'ncx',
  children: readonly NavigationItem[],
  issues: EpubIssue[],
): NavigationItem {
  let normalizedTarget: string | null = null
  if (href !== '') {
    try {
      const resolved = resolveArchiveHref(documentPath, href)
      normalizedTarget = resolved.normalizedTarget
      if (resolved.external) {
        issues.push({
          code: 'navigation.external-target',
          message: `Navigation item “${label}” points to an external resource and was disabled.`,
          path: documentPath,
          severity: 'info',
        })
      }
    } catch (cause) {
      issues.push(
        navigationError(
          'navigation.unsafe-target',
          `Navigation item “${label}” has an invalid path.`,
          documentPath,
          cause,
        ),
      )
    }
  }
  return {
    children,
    href,
    id,
    label,
    normalizedTarget,
    sources: [{ documentPath, kind }],
  }
}

function sameTargets(
  left: readonly NavigationItem[],
  right: readonly NavigationItem[],
): boolean {
  const flatten = (items: readonly NavigationItem[]): string[] =>
    items.flatMap((item) => [
      item.normalizedTarget ?? '',
      ...flatten(item.children),
    ])
  return JSON.stringify(flatten(left)) === JSON.stringify(flatten(right))
}

function navigationError(
  code: string,
  message: string,
  path: string,
  cause: unknown,
): EpubIssue {
  return {
    code,
    ...(cause instanceof Error ? { detail: cause.message } : {}),
    message,
    path,
    severity: 'warning',
  }
}
