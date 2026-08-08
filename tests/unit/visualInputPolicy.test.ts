// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
  isAllowedVisualInput,
  replaceSelectionWithPlainText,
} from '../../src/components/SafeVisualEditor.js'

describe('safe visual input policy', () => {
  it('allows Chinese IME composition text but blocks structural input', () => {
    expect(isAllowedVisualInput('insertCompositionText')).toBe(true)
    expect(isAllowedVisualInput('insertText')).toBe(true)
    expect(isAllowedVisualInput('deleteContentBackward')).toBe(true)
    expect(isAllowedVisualInput('insertParagraph')).toBe(false)
    expect(isAllowedVisualInput('insertFromDrop')).toBe(false)
    expect(isAllowedVisualInput('formatBold')).toBe(false)
  })

  it('inserts clipboard plain text as a text node within one segment', () => {
    const segment = document.createElement('span')
    segment.textContent = '前后'
    document.body.appendChild(segment)
    const textNode = segment.firstChild
    if (textNode === null) throw new Error('Text node missing')
    const range = document.createRange()
    range.setStart(textNode, 1)
    range.setEnd(textNode, 1)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    expect(replaceSelectionWithPlainText(document, segment, '<纯文本>&')).toBe(
      true,
    )
    expect(segment.textContent).toBe('前<纯文本>&后')
    expect(segment.children).toHaveLength(0)
  })

  it('rejects a selection that crosses segment boundaries', () => {
    const first = document.createElement('span')
    const second = document.createElement('span')
    first.textContent = '甲'
    second.textContent = '乙'
    document.body.append(first, second)
    const range = document.createRange()
    range.setStart(first.firstChild ?? first, 0)
    range.setEnd(second.firstChild ?? second, 1)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    expect(replaceSelectionWithPlainText(document, first, '跨段')).toBe(false)
  })
})
