import type {
  EpubArchive,
  EpubEditSession,
  EpubIssue,
  NavigationItem,
  NavigationModel,
} from '../../models/publication.js'
import { resolveArchiveHref } from '../archive/pathSafety.js'
import { commitSourceChanges, getEntrySource } from '../editor/editSession.js'
import {
  descendantsByLocalName,
  directChildElements,
  normalizedText,
  parseXml,
} from '../parser/xml.js'
import {
  applySafeTextPatch,
  findAllXmlTextSegments,
} from '../text/safeTextPatch.js'
import { parseNavigation } from './navigation.js'

export interface TocRenameResult {
  readonly issues: readonly EpubIssue[]
  readonly session: EpubEditSession
  readonly updatedPaths: readonly string[]
}

export function getCurrentNavigation(
  session: EpubEditSession,
): NavigationModel {
  const entries = new Map(
    [...session.publication.archive.entries].map(([path, entry]) => [
      path,
      {
        originalData: session.modifiedEntries.get(path) ?? entry.originalData,
        path,
      },
    ]),
  )
  const archive: EpubArchive = { entries }
  const fallbackItems: NavigationItem[] = session.publication.chapters.map(
    (chapter, index) => ({
      children: [],
      href: chapter.archivePath,
      id: `spine-${String(index + 1)}`,
      label: chapter.title,
      normalizedTarget: chapter.archivePath,
      sources: [
        {
          documentPath: session.publication.packagePath,
          kind: 'spine' as const,
        },
      ],
    }),
  )
  return parseNavigation(
    archive,
    session.publication.packageDocument,
    fallbackItems,
    [],
  )
}

export function renameNavigationLabel(
  session: EpubEditSession,
  item: NavigationItem,
  newLabel: string,
): TocRenameResult {
  if (newLabel.trim() === '') throw new Error('目录名称不能为空。')
  if (item.sources[0]?.kind === 'spine') {
    throw new Error('spine fallback 目录没有可安全写回的 NAV/NCX。')
  }
  const issues: EpubIssue[] = []
  const sourceRefs = [...item.sources]
  const currentNavigation = getCurrentNavigation(session)
  const alternateMatches = flattenNavigation(
    currentNavigation.alternateItems,
  ).filter(
    (candidate) =>
      candidate.normalizedTarget !== null &&
      candidate.normalizedTarget === item.normalizedTarget,
  )
  if (alternateMatches.length === 1) {
    const alternate = alternateMatches[0]
    if (alternate !== undefined) sourceRefs.push(...alternate.sources)
  } else if (currentNavigation.alternateItems.length > 0) {
    issues.push({
      code: 'toc.sync-ambiguous',
      message: 'NAV 与 NCX 无法按唯一目标可靠同步，只修改选定目录来源。',
      severity: 'warning',
    })
  }

  const changes: { afterSource: string; path: string }[] = []
  for (const sourceRef of sourceRefs) {
    const source = getEntrySource(session, sourceRef.documentPath)
    const segment = locateLabelSegment(
      source,
      sourceRef.documentPath,
      sourceRef.kind,
      item,
      session.revision,
    )
    if (segment === null) {
      issues.push({
        code: 'toc.label-not-unique',
        message: `${sourceRef.kind.toUpperCase()} 中无法唯一定位该目录文字，未修改该来源。`,
        path: sourceRef.documentPath,
        severity: 'warning',
      })
      continue
    }
    changes.push({
      afterSource: applySafeTextPatch(
        source,
        segment,
        newLabel,
        session.revision,
      ).source,
      path: sourceRef.documentPath,
    })
  }
  if (changes.length === 0) {
    return { issues, session, updatedPaths: [] }
  }
  return {
    issues,
    session: commitSourceChanges(
      session,
      changes,
      'toc-label',
      `目录改名：“${item.label}”→“${newLabel}”`,
    ),
    updatedPaths: changes.map((change) => change.path),
  }
}

function locateLabelSegment(
  source: string,
  documentPath: string,
  kind: 'nav' | 'ncx' | 'spine',
  item: NavigationItem,
  revision: number,
): ReturnType<typeof findAllXmlTextSegments>[number] | null {
  if (kind === 'spine') return null
  const document = parseXml(source, documentPath)
  const labelElements =
    kind === 'nav'
      ? descendantsByLocalName(document, 'a').filter((anchor) => {
          const href = anchor.getAttribute('href')
          return (
            href !== null &&
            resolveArchiveHref(documentPath, href).normalizedTarget ===
              item.normalizedTarget &&
            normalizedText(anchor) === item.label
          )
        })
      : descendantsByLocalName(document, 'navPoint')
          .filter((navPoint) => {
            const href = directChildElements(
              navPoint,
              'content',
            )[0]?.getAttribute('src')
            return (
              href !== null &&
              href !== undefined &&
              resolveArchiveHref(documentPath, href).normalizedTarget ===
                item.normalizedTarget
            )
          })
          .map((navPoint) => {
            const navLabel = directChildElements(navPoint, 'navLabel')[0]
            return navLabel === undefined
              ? undefined
              : descendantsByLocalName(navLabel, 'text')[0]
          })
          .filter((element) => element !== undefined)
          .filter((element) => normalizedText(element) === item.label)
  if (labelElements.length !== 1) return null
  const labelElement = labelElements[0]
  if (labelElement === undefined) return null
  const textNodes = descendantTextNodes(labelElement)
  if (textNodes.length !== 1) return null
  const textNode = textNodes[0]
  if (textNode === undefined) return null
  const path = nodePath(document.documentElement, textNode)
  if (path === null) return null
  const segments = findAllXmlTextSegments(source, documentPath, revision)
  return (
    segments.find(
      (segment) => JSON.stringify(segment.nodePath) === JSON.stringify(path),
    ) ?? null
  )
}

function descendantTextNodes(
  element: import('@xmldom/xmldom').Element,
): readonly import('@xmldom/xmldom').Node[] {
  const output: import('@xmldom/xmldom').Node[] = []
  const visit = (node: import('@xmldom/xmldom').Node): void => {
    if (node.nodeType === 3 && (node.nodeValue ?? '').trim() !== '') {
      output.push(node)
    }
    for (const child of Array.from(node.childNodes)) visit(child)
  }
  visit(element)
  return output
}

function nodePath(
  root: import('@xmldom/xmldom').Node | null,
  target: import('@xmldom/xmldom').Node,
): readonly number[] | null {
  if (root === null) return null
  if (root === target) return []
  for (const [index, child] of Array.from(root.childNodes).entries()) {
    const nested = nodePath(child, target)
    if (nested !== null) return [index, ...nested]
  }
  return null
}

function flattenNavigation(
  items: readonly NavigationItem[],
): readonly NavigationItem[] {
  return items.flatMap((item) => [item, ...flattenNavigation(item.children)])
}
