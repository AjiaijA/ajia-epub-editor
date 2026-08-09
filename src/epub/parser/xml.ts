import {
  DOMParser,
  type Document,
  type Element,
  type Node,
} from '@xmldom/xmldom'

export function decodeUtf8Xml(bytes: Uint8Array): {
  readonly encoding: 'utf-8' | 'utf-8-bom'
  readonly source: string
} {
  const hasBom =
    bytes.byteLength >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  const payload = hasBom ? bytes.subarray(3) : bytes
  return {
    encoding: hasBom ? 'utf-8-bom' : 'utf-8',
    source: new TextDecoder('utf-8', { fatal: true }).decode(payload),
  }
}

export function encodeUtf8Xml(
  source: string,
  encoding: 'utf-8' | 'utf-8-bom',
): Uint8Array {
  const payload = new TextEncoder().encode(source)
  if (encoding === 'utf-8') return payload
  const encoded = new Uint8Array(payload.byteLength + 3)
  encoded.set([0xef, 0xbb, 0xbf])
  encoded.set(payload, 3)
  return encoded
}

export function parseXml(source: string, context: string): Document {
  const parseSource = maskSafeDoctype(source, context)
  const errors: string[] = []
  const document = new DOMParser({
    onError: (level, message) => {
      if (level !== 'warning') errors.push(message)
    },
  }).parseFromString(parseSource, 'application/xml')
  if (document.documentElement === null || errors.length > 0) {
    throw new Error(
      `${context} is not valid XML: ${errors.join('; ') || 'missing root element'}`,
    )
  }
  return document
}

function maskSafeDoctype(source: string, context: string): string {
  const matches = [...source.matchAll(/<!DOCTYPE\b/giu)]
  if (matches.length === 0) return source
  if (matches.length > 1) {
    throw new Error(`${context} contains multiple DOCTYPE declarations.`)
  }
  const start = matches[0]?.index
  if (start === undefined) return source
  const end = findDoctypeEnd(source, start, context)
  const declaration = source.slice(start, end)
  if (
    !/^<!DOCTYPE\s+[A-Za-z_][\w.:-]*(?:\s+(?:SYSTEM\s+(?:"[^"]*"|'[^']*')|PUBLIC\s+(?:"[^"]*"|'[^']*')\s+(?:"[^"]*"|'[^']*')))?\s*>$/isu.test(
      declaration,
    )
  ) {
    throw new Error(
      `${context} contains an unsafe DOCTYPE; internal DTD subsets and entity declarations are not allowed.`,
    )
  }
  const masked = declaration.replace(/[^\r\n]/gu, ' ')
  return source.slice(0, start) + masked + source.slice(end)
}

function findDoctypeEnd(
  source: string,
  start: number,
  context: string,
): number {
  let quote: '"' | "'" | null = null
  for (
    let index = start + '<!DOCTYPE'.length;
    index < source.length;
    index += 1
  ) {
    const character = source[index]
    if (quote !== null) {
      if (character === quote) quote = null
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === '[') {
      throw new Error(
        `${context} contains an unsafe DOCTYPE; internal DTD subsets and entity declarations are not allowed.`,
      )
    }
    if (character === '>') return index + 1
  }
  throw new Error(`${context} has an unterminated DOCTYPE declaration.`)
}

export function descendantsByLocalName(
  parent: Document | Element,
  localName: string,
): readonly Element[] {
  const matches: Element[] = []
  const visit = (node: Node): void => {
    if (node.nodeType === 1) {
      const element = node as Element
      if ((element.localName ?? element.tagName) === localName)
        matches.push(element)
    }
    for (const child of Array.from(node.childNodes)) visit(child)
  }
  visit(parent)
  return matches
}

export function directChildElements(
  parent: Element,
  localName?: string,
): readonly Element[] {
  return Array.from(parent.childNodes).filter((node): node is Element => {
    if (node.nodeType !== 1) return false
    return (
      localName === undefined ||
      ((node as Element).localName ?? node.nodeName) === localName
    )
  })
}

export function attributeByLocalName(
  element: Element,
  localName: string,
): string | null {
  const attribute = Array.from(element.attributes).find(
    (candidate) => (candidate.localName ?? candidate.name) === localName,
  )
  return attribute?.value ?? null
}

export function normalizedText(element: Element | null): string {
  return element?.textContent?.replace(/\s+/gu, ' ').trim() ?? ''
}
