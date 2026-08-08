import { XMLSerializer, type Element } from '@xmldom/xmldom'

import type { ChapterDocument, EpubArchive } from '../../models/publication.js'
import { resolveArchiveHref } from '../archive/pathSafety.js'
import {
  descendantsByLocalName,
  directChildElements,
  parseXml,
} from '../parser/xml.js'

const BLOCKED_ELEMENTS = new Set([
  'base',
  'embed',
  'form',
  'iframe',
  'object',
  'script',
])

const PREVIEW_CSP = [
  "default-src 'none'",
  'img-src data: blob:',
  "style-src 'unsafe-inline'",
  'font-src data: blob:',
  'media-src data: blob:',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

export interface PreviewResult {
  readonly blockedResourceCount: number
  readonly html: string
}

export function createSandboxedPreview(
  chapter: ChapterDocument,
  archive: EpubArchive,
): PreviewResult {
  if (chapter.visualEditCapability !== 'readonly') {
    throw new Error('该章节已降级，不能生成可视预览。')
  }
  const document = parseXml(chapter.originalSource, chapter.archivePath)
  let blockedResourceCount = 0

  blockedResourceCount += replaceStylesheets(
    document.documentElement,
    chapter.archivePath,
    archive,
  )
  const allElements = collectElements(document.documentElement)
  for (const element of allElements) {
    const name = (element.localName ?? element.tagName).toLowerCase()
    if (BLOCKED_ELEMENTS.has(name)) {
      element.parentNode?.removeChild(element)
      blockedResourceCount += 1
      continue
    }
    if (
      name === 'meta' &&
      (element.getAttribute('http-equiv') ?? '').toLowerCase() === 'refresh'
    ) {
      element.parentNode?.removeChild(element)
      blockedResourceCount += 1
      continue
    }

    for (const attribute of [...Array.from(element.attributes)]) {
      const attributeName = attribute.name.toLowerCase()
      if (
        attributeName.startsWith('on') ||
        attributeName === 'formaction' ||
        attributeName === 'srcdoc'
      ) {
        element.removeAttribute(attribute.name)
        blockedResourceCount += 1
      }
    }

    const inlineStyle = element.getAttribute('style')
    if (inlineStyle !== null) {
      const sanitized = sanitizeCss(inlineStyle, chapter.archivePath, archive)
      blockedResourceCount += sanitized.blocked
      element.setAttribute('style', sanitized.css)
    }
    if (name === 'style') {
      const sanitized = sanitizeCss(
        element.textContent ?? '',
        chapter.archivePath,
        archive,
      )
      blockedResourceCount += sanitized.blocked
      element.textContent = sanitized.css
    }

    if (name === 'a') {
      const href = element.getAttribute('href')
      if (href !== null) {
        element.setAttribute('data-epub-href', href)
        element.removeAttribute('href')
        element.setAttribute('aria-disabled', 'true')
        element.setAttribute('title', '只读预览中已禁用链接')
        blockedResourceCount += 1
      }
      continue
    }

    if (
      name === 'img' ||
      name === 'source' ||
      name === 'audio' ||
      name === 'video'
    ) {
      const sourceAttribute =
        name === 'video' && element.hasAttribute('poster') ? 'poster' : 'src'
      const source = element.getAttribute(sourceAttribute)
      if (source !== null) {
        const dataUrl = resolveResourceDataUrl(
          chapter.archivePath,
          source,
          archive,
        )
        if (dataUrl === null) {
          element.removeAttribute(sourceAttribute)
          blockedResourceCount += 1
        } else {
          element.setAttribute(sourceAttribute, dataUrl)
        }
      }
      continue
    }

    for (const attributeName of ['href', 'src', 'xlink:href']) {
      if (element.hasAttribute(attributeName)) {
        element.removeAttribute(attributeName)
        blockedResourceCount += 1
      }
    }
  }

  const head = descendantsByLocalName(document, 'head')[0]
  if (head !== undefined) {
    const csp = document.createElement('meta')
    csp.setAttribute('http-equiv', 'Content-Security-Policy')
    csp.setAttribute('content', PREVIEW_CSP)
    head.insertBefore(csp, head.firstChild)
  }
  return {
    blockedResourceCount,
    html: new XMLSerializer().serializeToString(document),
  }
}

function collectElements(root: Element | null): Element[] {
  if (root === null) return []
  return [
    root,
    ...directChildElements(root).flatMap((child) => collectElements(child)),
  ]
}

function replaceStylesheets(
  root: Element | null,
  basePath: string,
  archive: EpubArchive,
): number {
  let blocked = 0
  for (const link of collectElements(root).filter(
    (element) =>
      (element.localName ?? element.tagName).toLowerCase() === 'link' &&
      (element.getAttribute('rel') ?? '')
        .toLowerCase()
        .split(/\s+/u)
        .includes('stylesheet'),
  )) {
    const href = link.getAttribute('href')
    if (href === null) {
      link.parentNode?.removeChild(link)
      blocked += 1
      continue
    }
    const resolved = resolveLocalResource(basePath, href, archive)
    if (resolved === null) {
      link.parentNode?.removeChild(link)
      blocked += 1
      continue
    }
    let css: string
    try {
      css = new TextDecoder('utf-8', { fatal: true }).decode(resolved.payload)
    } catch {
      link.parentNode?.removeChild(link)
      blocked += 1
      continue
    }
    const ownerDocument = link.ownerDocument
    if (ownerDocument === null) {
      link.parentNode?.removeChild(link)
      continue
    }
    const style = ownerDocument.createElement('style')
    style.setAttribute('data-epub-source', resolved.path)
    const sanitized = sanitizeCss(css, resolved.path, archive)
    blocked += sanitized.blocked
    style.appendChild(ownerDocument.createTextNode(sanitized.css))
    link.parentNode?.replaceChild(style, link)
  }
  return blocked
}

function sanitizeCss(
  css: string,
  basePath: string,
  archive: EpubArchive,
): { readonly blocked: number; readonly css: string } {
  let blocked = 0
  const withoutImports = css.replace(/@import\s+(?:url\()?[^;]+;?/giu, () => {
    blocked += 1
    return ''
  })
  const sanitized = withoutImports.replace(
    /url\(\s*(['"]?)(.*?)\1\s*\)/giu,
    (_match: string, _quote: string, rawUrl: string) => {
      const dataUrl = resolveResourceDataUrl(basePath, rawUrl.trim(), archive)
      if (dataUrl === null) {
        blocked += 1
        return 'url("")'
      }
      return `url("${dataUrl}")`
    },
  )
  return { blocked, css: sanitized }
}

function resolveResourceDataUrl(
  basePath: string,
  href: string,
  archive: EpubArchive,
): string | null {
  const resolved = resolveLocalResource(basePath, href, archive)
  if (resolved === null) return null
  return `data:${mediaTypeForPath(resolved.path)};base64,${encodeBase64(resolved.payload)}`
}

function resolveLocalResource(
  basePath: string,
  href: string,
  archive: EpubArchive,
): { readonly path: string; readonly payload: Uint8Array } | null {
  try {
    const resolved = resolveArchiveHref(basePath, href)
    if (resolved.external || resolved.path === null) return null
    const entry = archive.entries.get(resolved.path)
    return entry === undefined
      ? null
      : { path: resolved.path, payload: entry.originalData }
  } catch {
    return null
  }
}

function mediaTypeForPath(path: string): string {
  const extension = path.split('.').at(-1)?.toLowerCase()
  return (
    {
      css: 'text/css',
      gif: 'image/gif',
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      mp3: 'audio/mpeg',
      mp4: 'video/mp4',
      otf: 'font/otf',
      png: 'image/png',
      svg: 'image/svg+xml',
      ttf: 'font/ttf',
      webp: 'image/webp',
      woff: 'font/woff',
      woff2: 'font/woff2',
    }[extension ?? ''] ?? 'application/octet-stream'
  )
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let output = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1] ?? 0
    const third = bytes[index + 2] ?? 0
    const combined = (first << 16) | (second << 8) | third
    output += alphabet.charAt((combined >>> 18) & 63)
    output += alphabet.charAt((combined >>> 12) & 63)
    output +=
      index + 1 < bytes.length ? alphabet.charAt((combined >>> 6) & 63) : '='
    output += index + 2 < bytes.length ? alphabet.charAt(combined & 63) : '='
  }
  return output
}
