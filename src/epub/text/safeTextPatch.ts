import {
  DOMParser,
  type Document,
  type Element,
  type Node,
} from '@xmldom/xmldom'

export interface TextSegment {
  readonly decodedText: string
  readonly end: number
  readonly id: string
  readonly rawSource: string
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
  assertWellFormedXml(source)
  const tokens = tokenizeXmlSource(source)
  const stack: string[] = []
  const segments: TextSegment[] = []

  for (const token of tokens) {
    if (token.kind === 'markup') {
      updateElementStack(stack, token.raw)
      continue
    }

    const bodyIndex = stack.lastIndexOf('body')
    const excluded = stack.some((name) => name === 'script' || name === 'style')
    if (bodyIndex !== -1 && !excluded && token.raw.length > 0) {
      segments.push({
        decodedText: decodeXmlText(token.raw),
        end: token.end,
        id: `text-${String(segments.length)}-${String(token.start)}-${String(token.end)}`,
        rawSource: token.raw,
        start: token.start,
      })
    }
  }

  return segments
}

export function applySafeTextPatch(
  source: string,
  segment: TextSegment,
  replacement: string,
): SafeTextPatchResult {
  assertWellFormedXml(source)
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
        // Text values are the only part intentionally excluded from this fingerprint.
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

export function escapeXmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function tokenizeXmlSource(source: string): readonly SourceToken[] {
  if (/<!DOCTYPE/i.test(source)) {
    throw new Error(
      'DOCTYPE declarations are outside the safe text-patch boundary',
    )
  }

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
  if (/<!DOCTYPE/i.test(source)) {
    throw new Error(
      'DOCTYPE declarations are outside the safe text-patch boundary',
    )
  }
  const errors: string[] = []
  const parser = new DOMParser({
    onError: (level, message) => {
      if (level !== 'warning') errors.push(message)
    },
  })
  const document = parser.parseFromString(source, 'application/xml')
  if (errors.length > 0 || document.documentElement === null) {
    throw new Error(
      `Invalid XML: ${errors.join('; ') || 'missing document element'}`,
    )
  }
  return document
}
