import { type Document, type Element, type Node } from '@xmldom/xmldom'

import { parseXml as parsePublicationXml } from '../parser/xml.js'

export interface TextSegment {
  readonly chapterPath: string
  readonly currentText: string
  readonly decodedText: string
  readonly end: number
  readonly id: string
  readonly nodePath: readonly number[]
  readonly rawSource: string
  readonly sourceEnd: number
  readonly sourceRevision: number
  readonly sourceStart: number
  readonly start: number
}

interface SourceToken {
  readonly end: number
  readonly kind: 'markup' | 'text'
  readonly raw: string
  readonly start: number
}

export interface SafeTextPatchResult {
  readonly escapedReplacement: string
  readonly source: string
  readonly structuralFingerprint: string
}

export function findEditableTextSegments(
  source: string,
): readonly TextSegment[] {
  return findChapterTextSegments(source, '', 0)
}

export function findChapterTextSegments(
  source: string,
  chapterPath: string,
  sourceRevision: number,
): readonly TextSegment[] {
  return findXmlTextSegments(source, chapterPath, sourceRevision, true)
}

export function findAllXmlTextSegments(
  source: string,
  documentPath: string,
  sourceRevision: number,
): readonly TextSegment[] {
  return findXmlTextSegments(source, documentPath, sourceRevision, false)
}

function findXmlTextSegments(
  source: string,
  chapterPath: string,
  sourceRevision: number,
  requireBody: boolean,
): readonly TextSegment[] {
  const document = parseXml(source)
  const tokens = tokenizeXmlSource(source)
  const stack: string[] = []
  const sourceSegments: Omit<TextSegment, 'currentText' | 'id' | 'nodePath'>[] =
    []

  for (const token of tokens) {
    if (token.kind === 'markup') {
      updateElementStack(stack, token.raw)
      continue
    }

    const bodyIndex = stack.lastIndexOf('body')
    const excluded = stack.some((name) => name === 'script' || name === 'style')
    if (
      (!requireBody || bodyIndex !== -1) &&
      !excluded &&
      token.raw.length > 0
    ) {
      const decodedText = decodeXmlText(token.raw)
      if (decodedText.trim().length === 0) continue
      sourceSegments.push({
        chapterPath,
        decodedText,
        end: token.end,
        rawSource: token.raw,
        sourceEnd: token.end,
        sourceRevision,
        sourceStart: token.start,
        start: token.start,
      })
    }
  }
  const domTextNodes = collectEditableDomTextNodes(document, requireBody)
  if (
    domTextNodes.length !== sourceSegments.length ||
    domTextNodes.some(
      (candidate, index) =>
        candidate.text !== sourceSegments[index]?.decodedText,
    )
  ) {
    throw new Error('XML tokenizer and parser text-node mappings disagree')
  }
  return sourceSegments.map((segment, index) => ({
    ...segment,
    currentText: segment.decodedText,
    id: `segment:${chapterPath}:${String(sourceRevision)}:${String(segment.sourceStart)}:${String(segment.sourceEnd)}:${String(index)}`,
    nodePath: domTextNodes[index]?.path ?? [],
  }))
}

export function findSafeVisualTextSegments(
  source: string,
  chapterPath: string,
  sourceRevision: number,
): readonly TextSegment[] {
  const document = parseXml(source)
  const unsafe = collectElementNames(document.documentElement).find((name) =>
    ['math', 'script', 'svg'].includes(name),
  )
  if (unsafe !== undefined) {
    throw new Error(`Complex ${unsafe} content requires source mode`)
  }
  return findChapterTextSegments(source, chapterPath, sourceRevision)
}

export function applySafeTextPatch(
  source: string,
  segment: TextSegment,
  replacement: string,
  expectedRevision = segment.sourceRevision,
): SafeTextPatchResult {
  assertWellFormedXml(source)
  if (segment.sourceRevision !== expectedRevision) {
    throw new Error('Text segment belongs to a stale source revision')
  }
  if (source.slice(segment.start, segment.end) !== segment.rawSource) {
    throw new Error(
      'Text segment is stale or belongs to another source revision',
    )
  }

  const beforeFingerprint = createStructuralFingerprint(source)
  const escapedReplacement = escapeXmlText(replacement)
  const patched =
    source.slice(0, segment.start) +
    escapedReplacement +
    source.slice(segment.end)

  assertWellFormedXml(patched)
  const afterFingerprint = createStructuralFingerprint(patched)
  if (beforeFingerprint !== afterFingerprint) {
    throw new Error('Safe text patch changed the XML structure')
  }

  return {
    escapedReplacement,
    source: patched,
    structuralFingerprint: afterFingerprint,
  }
}

export function createStructuralFingerprint(source: string): string {
  const document = parseXml(source)
  const records: string[] = []

  function visit(node: Node): void {
    switch (node.nodeType) {
      case 1: {
        const element = node as Element
        const attributes = Array.from(element.attributes)
          .map((attribute) => [
            attribute.namespaceURI ?? '',
            attribute.localName ?? attribute.name,
            attribute.value,
          ])
          .sort((left, right) =>
            JSON.stringify(left).localeCompare(JSON.stringify(right)),
          )
        records.push(
          JSON.stringify([
            'element-start',
            element.namespaceURI ?? '',
            element.localName ?? element.tagName,
            attributes,
          ]),
        )
        for (const child of Array.from(element.childNodes)) visit(child)
        records.push(JSON.stringify(['element-end']))
        break
      }
      case 3:
        // Preserve text-node count and position while intentionally excluding values.
        records.push(JSON.stringify(['text']))
        break
      case 4:
        records.push(JSON.stringify(['cdata', node.nodeValue ?? '']))
        break
      case 7:
        records.push(
          JSON.stringify([
            'processing-instruction',
            node.nodeName,
            node.nodeValue ?? '',
          ]),
        )
        break
      case 8:
        records.push(JSON.stringify(['comment', node.nodeValue ?? '']))
        break
      case 9:
        for (const child of Array.from(node.childNodes)) visit(child)
        break
      default:
        records.push(JSON.stringify(['node', node.nodeType, node.nodeName]))
    }
  }

  visit(document)
  return records.join('\n')
}

function collectEditableDomTextNodes(
  document: Document,
  requireBody: boolean,
): readonly { readonly path: readonly number[]; readonly text: string }[] {
  const root = document.documentElement
  if (root === null) return []
  const output: { path: readonly number[]; text: string }[] = []
  const visit = (
    node: Node,
    path: readonly number[],
    insideBody: boolean,
    excluded: boolean,
  ): void => {
    const element = node.nodeType === 1 ? (node as Element) : null
    const name = (element?.localName ?? element?.tagName ?? '').toLowerCase()
    const nextInsideBody = insideBody || name === 'body'
    const nextExcluded = excluded || name === 'script' || name === 'style'
    if (
      node.nodeType === 3 &&
      (!requireBody || nextInsideBody) &&
      !nextExcluded
    ) {
      const text = node.nodeValue ?? ''
      if (text.trim().length > 0) output.push({ path, text })
    }
    Array.from(node.childNodes).forEach((child, index) => {
      visit(child, [...path, index], nextInsideBody, nextExcluded)
    })
  }
  visit(root, [], false, false)
  return output
}

function collectElementNames(root: Element | null): readonly string[] {
  if (root === null) return []
  return [
    (root.localName ?? root.tagName).toLowerCase(),
    ...Array.from(root.childNodes).flatMap((child) =>
      child.nodeType === 1 ? collectElementNames(child as Element) : [],
    ),
  ]
}

export function escapeXmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function tokenizeXmlSource(source: string): readonly SourceToken[] {
  const tokens: SourceToken[] = []
  let offset = 0
  while (offset < source.length) {
    if (source[offset] !== '<') {
      const end = source.indexOf('<', offset)
      const resolvedEnd = end === -1 ? source.length : end
      tokens.push({
        end: resolvedEnd,
        kind: 'text',
        raw: source.slice(offset, resolvedEnd),
        start: offset,
      })
      offset = resolvedEnd
      continue
    }

    const end = findMarkupEnd(source, offset)
    tokens.push({
      end,
      kind: 'markup',
      raw: source.slice(offset, end),
      start: offset,
    })
    offset = end
  }
  return tokens
}

function findMarkupEnd(source: string, start: number): number {
  const terminator = source.startsWith('<!--', start)
    ? '-->'
    : source.startsWith('<![CDATA[', start)
      ? ']]>'
      : source.startsWith('<?', start)
        ? '?>'
        : null
  if (terminator !== null) {
    const end = source.indexOf(terminator, start + 2)
    if (end === -1) {
      throw new Error(`Unterminated XML construct at ${String(start)}`)
    }
    return end + terminator.length
  }

  let quote: '"' | "'" | null = null
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index]
    if (quote !== null) {
      if (character === quote) quote = null
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === '>') {
      return index + 1
    }
  }
  throw new Error(`Unterminated XML markup at ${String(start)}`)
}

function updateElementStack(stack: string[], markup: string): void {
  if (markup.startsWith('</')) {
    stack.pop()
    return
  }
  if (markup.startsWith('<?') || markup.startsWith('<!')) return

  const match = /^<\s*([^\s/>]+)/u.exec(markup)
  const qualifiedName = match?.[1]
  if (qualifiedName === undefined || /\/\s*>$/u.test(markup)) return
  stack.push(qualifiedName.split(':').at(-1)?.toLowerCase() ?? qualifiedName)
}

function decodeXmlText(raw: string): string {
  const wrapper = parseXml(`<root>${raw}</root>`)
  const root = wrapper.documentElement
  if (root === null) throw new Error('XML text wrapper has no document element')
  return root.textContent ?? ''
}

function assertWellFormedXml(source: string): void {
  parseXml(source)
}

function parseXml(source: string): Document {
  return parsePublicationXml(source, 'safe text patch')
}
