import type {
  ChapterDocument,
  EpubIssue,
  EpubPublication,
  NavigationItem,
} from '../../models/publication.js'
import { EpubOpenError } from '../../models/publication.js'
import { openArchiveSafely } from '../archive/preflight.js'
import { resolveArchiveHref } from '../archive/pathSafety.js'
import { parseNavigation } from '../navigation/navigation.js'
import { locatePackagePath, parsePackageDocument } from './packageDocument.js'
import {
  decodeUtf8Xml,
  descendantsByLocalName,
  normalizedText,
  parseXml,
} from './xml.js'
import { findSafeVisualTextSegments } from '../text/safeTextPatch.js'

export function openEpubPublication(
  bytes: Uint8Array,
  fileName: string,
): EpubPublication {
  const opened = openArchiveSafely(bytes)
  const issues = [...opened.issues]
  let packagePath: string
  try {
    packagePath = locatePackagePath(opened.archive, issues)
  } catch (cause) {
    throw fatalOpenError(
      '无法定位 EPUB package document。',
      'container.invalid',
      cause,
      issues,
    )
  }

  let packageDocument
  try {
    packageDocument = parsePackageDocument(opened.archive, packagePath, issues)
  } catch (cause) {
    throw fatalOpenError(
      '无法解析 EPUB package document。',
      'package.invalid',
      cause,
      issues,
      packagePath,
    )
  }

  const encryptedPaths = readEncryptedPaths(opened.archive, issues)
  const chapters: ChapterDocument[] = []
  for (const spineItem of packageDocument.spine) {
    const item = spineItem.manifestItem
    if (item?.archivePath === null || item === null) continue
    const entry = opened.archive.entries.get(item.archivePath)
    if (entry === undefined) continue
    if (!isChapterMediaType(item.mediaType)) {
      issues.push({
        code: 'chapter.unexpected-media-type',
        message: `spine 项“${item.href}”不是 XHTML，已跳过预览。`,
        path: item.archivePath,
        severity: 'warning',
      })
      continue
    }

    let source: string
    let sourceEncoding: 'utf-8' | 'utf-8-bom'
    try {
      const decoded = decodeUtf8Xml(entry.originalData)
      source = decoded.source
      sourceEncoding = decoded.encoding
    } catch (cause) {
      issues.push({
        code: 'chapter.invalid-encoding',
        ...(cause instanceof Error ? { detail: cause.message } : {}),
        message: `章节“${item.href}”不是有效 UTF-8，无法预览。`,
        path: item.archivePath,
        severity: 'warning',
      })
      continue
    }

    let title = fileNameFromPath(item.archivePath)
    let capability: 'readonly' | 'safe' | 'source-only' = 'readonly'
    let sourceEditCapability: 'editable' | 'encrypted' = 'editable'
    if (encryptedPaths.has(item.archivePath)) {
      capability = 'source-only'
      sourceEditCapability = 'encrypted'
      issues.push({
        code: 'chapter.encrypted',
        message: `章节“${item.href}”标记为加密，不能预览或修改其内容。`,
        path: item.archivePath,
        severity: 'error',
      })
    } else {
      try {
        const chapterDocument = parseXml(source, item.archivePath)
        title =
          normalizedText(
            descendantsByLocalName(chapterDocument, 'title')[0] ?? null,
          ) || title
        try {
          findSafeVisualTextSegments(source, item.archivePath, 0)
          capability = 'safe'
        } catch (cause) {
          issues.push({
            code: 'chapter.visual-edit-readonly',
            ...(cause instanceof Error ? { detail: cause.message } : {}),
            message: `章节“${item.href}”包含复杂内容，可预览但只允许源码编辑。`,
            path: item.archivePath,
            severity: 'info',
          })
        }
      } catch (cause) {
        capability = 'source-only'
        issues.push({
          code: 'chapter.invalid-xhtml',
          ...(cause instanceof Error ? { detail: cause.message } : {}),
          message: `章节“${item.href}”不是合法 XML，已降级且不生成预览。`,
          path: item.archivePath,
          severity: 'warning',
        })
      }
    }
    chapters.push({
      archivePath: item.archivePath,
      idref: spineItem.idref,
      linear: spineItem.linear,
      originalBytes: entry.originalData,
      originalSource: source,
      sourceEditCapability,
      sourceEncoding,
      title,
      visualEditCapability: capability,
    })
  }

  const fallbackItems: NavigationItem[] = chapters.map((chapter, index) => ({
    children: [],
    href: chapter.archivePath,
    id: `spine-${String(index + 1)}`,
    label: chapter.title,
    normalizedTarget: chapter.archivePath,
    sources: [{ documentPath: packagePath, kind: 'spine' }],
  }))
  const navigation = parseNavigation(
    opened.archive,
    packageDocument,
    fallbackItems,
    issues,
  )
  return {
    archive: opened.archive,
    chapters,
    epubVersion: packageDocument.epubVersion,
    fileName,
    issues,
    navigation,
    packageDocument,
    packagePath,
  }
}

function readEncryptedPaths(
  archive: EpubPublication['archive'],
  issues: EpubIssue[],
): ReadonlySet<string> {
  const entry = archive.entries.get('META-INF/encryption.xml')
  if (entry === undefined) return new Set()
  try {
    const { source } = decodeUtf8Xml(entry.originalData)
    const document = parseXml(source, 'META-INF/encryption.xml')
    const paths = new Set<string>()
    for (const reference of descendantsByLocalName(
      document,
      'CipherReference',
    )) {
      const uri = reference.getAttribute('URI')
      if (uri !== null) {
        try {
          const resolved = resolveArchiveHref('META-INF/encryption.xml', uri)
          if (!resolved.external && resolved.path !== null)
            paths.add(resolved.path)
        } catch {
          issues.push({
            code: 'encryption.unsafe-reference',
            message: 'encryption.xml 包含不安全的资源路径。',
            path: 'META-INF/encryption.xml',
            severity: 'error',
          })
        }
      }
    }
    issues.push({
      code: 'encryption.present',
      message: '本书包含 encryption.xml；不会尝试解密或修改受保护内容。',
      path: 'META-INF/encryption.xml',
      severity: 'warning',
    })
    return paths
  } catch (cause) {
    issues.push({
      code: 'encryption.invalid',
      ...(cause instanceof Error ? { detail: cause.message } : {}),
      message: 'encryption.xml 无法安全解析。',
      path: 'META-INF/encryption.xml',
      severity: 'error',
    })
    return new Set()
  }
}

function isChapterMediaType(mediaType: string): boolean {
  return mediaType === 'application/xhtml+xml' || mediaType === 'text/html'
}

function fileNameFromPath(path: string): string {
  return path.split('/').at(-1) ?? path
}

function fatalOpenError(
  message: string,
  code: string,
  cause: unknown,
  issues: EpubIssue[],
  path?: string,
): EpubOpenError {
  return new EpubOpenError(message, [
    ...issues,
    {
      code,
      ...(cause instanceof Error ? { detail: cause.message } : {}),
      message,
      ...(path === undefined ? {} : { path }),
      severity: 'error',
    },
  ])
}
