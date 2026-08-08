import type { EpubEditSession, EpubIssue } from '../../models/publication.js'
import { resolveArchiveHref } from '../archive/pathSafety.js'
import {
  getChapterSource,
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
      errorIssue('export.missing-container', '缺少 META-INF/container.xml。'),
    )
  }
  if (!publication.archive.entries.has(publication.packagePath)) {
    issues.push(
      errorIssue('export.missing-package', 'package document 不存在。'),
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
          `manifest 资源“${item.href}”不存在。`,
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
            '受保护章节不能作为 dirty entry 导出。',
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
            '修改后的 XHTML 不是合法 XML。',
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
          'dirty entry 不属于原始 archive。',
          path,
        ),
      )
    }
    if (!session.modifiedEntries.has(path)) {
      issues.push(
        errorIssue(
          'export.missing-modified-bytes',
          'dirty entry 没有经过验证的 modified bytes。',
          path,
        ),
      )
    }
  }

  if (issues.length === 0) {
    issues.push({
      code: 'export.ready',
      message: '轻量检查通过，可以导出新的 EPUB。',
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
            message: `章节引用的本地资源不存在：“${href}”。`,
            path: chapterPath,
            severity: 'warning',
          })
        }
      } catch (cause) {
        issues.push(
          errorIssue(
            'export.unsafe-linked-resource',
            `章节包含不安全的本地引用：“${href}”。`,
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
