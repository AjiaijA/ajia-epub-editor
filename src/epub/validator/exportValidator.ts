import type { EpubEditSession, EpubIssue } from '../../models/publication.js'
import { resolveArchiveHref } from '../archive/pathSafety.js'
import {
  getChapterSource,
  getEntrySource,
  validateChapterSource,
} from '../editor/editSession.js'
import { descendantsByLocalName, parseXml } from '../parser/xml.js'

export interface ExportCheckResult {
  readonly canExport: boolean
  readonly issues: readonly EpubIssue[]
}

const BLOCKING_OPEN_ISSUES = new Set([
  'manifest.duplicate-id',
  'manifest.unsafe-href',
  'spine.missing-manifest-item',
  'encryption.invalid',
  'encryption.unsafe-reference',
])

export function validateExportSession(
  session: EpubEditSession,
): ExportCheckResult {
  const issues: EpubIssue[] = []
  const { publication } = session

  for (const issue of publication.issues) {
    if (BLOCKING_OPEN_ISSUES.has(issue.code)) {
      issues.push({ ...issue, severity: 'error' })
    }
  }
  if (!publication.archive.entries.has('META-INF/container.xml')) {
    issues.push(
      errorIssue(
        'export.missing-container',
        'META-INF/container.xml is missing.',
      ),
    )
  }
  if (!publication.archive.entries.has(publication.packagePath)) {
    issues.push(
      errorIssue('export.missing-package', 'The package document is missing.'),
    )
  }

  for (const item of publication.packageDocument.manifest.values()) {
    if (
      item.archivePath !== null &&
      !publication.archive.entries.has(item.archivePath)
    ) {
      issues.push(
        errorIssue(
          'export.missing-manifest-resource',
          `Manifest resource “${item.href}” is missing.`,
          item.archivePath,
        ),
      )
    }
  }

  for (const chapter of publication.chapters) {
    const source = getChapterSource(session, chapter.archivePath)
    if (session.dirtyEntries.has(chapter.archivePath)) {
      if (chapter.sourceEditCapability === 'encrypted') {
        issues.push(
          errorIssue(
            'export.encrypted-dirty-entry',
            'A protected chapter cannot be exported as a dirty entry.',
            chapter.archivePath,
          ),
        )
        continue
      }
      try {
        validateChapterSource(chapter.archivePath, source)
      } catch (cause) {
        issues.push(
          errorIssue(
            'export.invalid-dirty-xhtml',
            'The modified XHTML is not valid XML.',
            chapter.archivePath,
            cause instanceof Error ? cause.message : undefined,
          ),
        )
        continue
      }
    }
    validateLocalReferences(source, chapter.archivePath, session, issues)
  }

  for (const path of session.dirtyEntries) {
    if (!publication.archive.entries.has(path)) {
      issues.push(
        errorIssue(
          'export.unknown-dirty-entry',
          'A dirty entry does not belong to the original archive.',
          path,
        ),
      )
    }
    if (!session.modifiedEntries.has(path)) {
      issues.push(
        errorIssue(
          'export.missing-modified-bytes',
          'A dirty entry has no validated modified bytes.',
          path,
        ),
      )
    }
    if (
      !session.transactions.some((transaction) =>
        transaction.changes.some((change) => change.path === path),
      )
    ) {
      issues.push(
        errorIssue(
          'export.dirty-without-transaction',
          'A dirty entry has no explicit edit transaction.',
          path,
        ),
      )
    }
    if (
      !publication.chapters.some((chapter) => chapter.archivePath === path) &&
      session.currentSources.has(path)
    ) {
      try {
        parseXml(getEntrySource(session, path), path)
      } catch (cause) {
        issues.push(
          errorIssue(
            'export.invalid-dirty-xml',
            'The modified NAV or NCX is not valid XML.',
            path,
            cause instanceof Error ? cause.message : undefined,
          ),
        )
      }
    }
  }

  if (issues.length === 0) {
    issues.push({
      code: 'export.ready',
      message: 'Lightweight validation passed. A new EPUB can be exported.',
      severity: 'info',
    })
  }
  return {
    canExport: !issues.some((issue) => issue.severity === 'error'),
    issues,
  }
}

function validateLocalReferences(
  source: string,
  chapterPath: string,
  session: EpubEditSession,
  issues: EpubIssue[],
): void {
  let document
  try {
    document = parseXml(source, chapterPath)
  } catch {
    return
  }
  for (const element of descendantsByLocalName(document, 'html').flatMap(
    (root) => descendants(root),
  )) {
    for (const attributeName of ['href', 'src']) {
      const href = element.getAttribute(attributeName)
      if (href === null || href.trim() === '') continue
      try {
        const resolved = resolveArchiveHref(chapterPath, href)
        if (
          !resolved.external &&
          resolved.path !== null &&
          !session.publication.archive.entries.has(resolved.path)
        ) {
          issues.push({
            code: 'export.missing-linked-resource',
            message: `A chapter references a missing local resource: “${href}”.`,
            path: chapterPath,
            severity: 'warning',
          })
        }
      } catch (cause) {
        issues.push(
          errorIssue(
            'export.unsafe-linked-resource',
            `A chapter contains an unsafe local reference: “${href}”.`,
            chapterPath,
            cause instanceof Error ? cause.message : undefined,
          ),
        )
      }
    }
  }
}

function descendants(
  root: import('@xmldom/xmldom').Element,
): readonly import('@xmldom/xmldom').Element[] {
  const output: import('@xmldom/xmldom').Element[] = [root]
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === 1) {
      output.push(...descendants(child as import('@xmldom/xmldom').Element))
    }
  }
  return output
}

function errorIssue(
  code: string,
  message: string,
  path?: string,
  detail?: string,
): EpubIssue {
  return {
    code,
    message,
    severity: 'error',
    ...(path === undefined ? {} : { path }),
    ...(detail === undefined ? {} : { detail }),
  }
}
