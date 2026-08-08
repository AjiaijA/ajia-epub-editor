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

export function parseXml(source: string, context: string): Document {
  if (/<!DOCTYPE/i.test(source)) {
    throw new Error(`${context} 包含不允许的 DOCTYPE。`)
  }
  const errors: string[] = []
  const document = new DOMParser({
    onError: (level, message) => {
      if (level !== 'warning') errors.push(message)
    },
  }).parseFromString(source, 'application/xml')
  if (document.documentElement === null || errors.length > 0) {
    throw new Error(`${context} XML 无效：${errors.join('; ') || '缺少根元素'}`)
  }
  return document
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
