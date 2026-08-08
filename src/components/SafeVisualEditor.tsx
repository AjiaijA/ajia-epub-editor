import { useEffect, useMemo, useRef } from 'react'

import type { PreviewResult } from '../epub/preview/createPreview.js'
import type { TextSegment } from '../epub/text/safeTextPatch.js'

interface SafeVisualEditorProps {
  readonly onCommit: (segmentId: string, text: string) => void
  readonly onDraftChange: (segmentId: string, text: string) => void
  readonly onError: (message: string) => void
  readonly preview: PreviewResult
  readonly segments: readonly TextSegment[]
  readonly title: string
}

const ALLOWED_INPUT_TYPES = new Set([
  'deleteByCut',
  'deleteContentBackward',
  'deleteContentForward',
  'deleteWordBackward',
  'deleteWordForward',
  'insertCompositionText',
  'insertReplacementText',
  'insertText',
])

export function isAllowedVisualInput(inputType: string): boolean {
  return ALLOWED_INPUT_TYPES.has(inputType)
}

export function SafeVisualEditor({
  onCommit,
  onDraftChange,
  onError,
  preview,
  segments,
  title,
}: SafeVisualEditorProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const segmentText = useMemo(
    () => new Map(segments.map((segment) => [segment.id, segment.currentText])),
    [segments],
  )
  const onCommitRef = useRef(onCommit)
  const onErrorRef = useRef(onError)
  const onDraftChangeRef = useRef(onDraftChange)
  onCommitRef.current = onCommit
  onErrorRef.current = onError
  onDraftChangeRef.current = onDraftChange

  useEffect(
    () => () => {
      cleanupRef.current?.()
    },
    [],
  )

  function connectFrame(): void {
    cleanupRef.current?.()
    const document = frameRef.current?.contentDocument
    if (document === null || document === undefined) return
    let composingSegment: HTMLElement | null = null

    const segmentFromEvent = (event: Event): HTMLElement | null => {
      const target = event.target
      const FrameHTMLElement = document.defaultView?.HTMLElement
      return FrameHTMLElement !== undefined &&
        target instanceof FrameHTMLElement
        ? target.closest('[data-epub-segment-id]')
        : null
    }
    const resetSegment = (segment: HTMLElement): void => {
      const id = segment.dataset.epubSegmentId
      if (id !== undefined) segment.textContent = segmentText.get(id) ?? ''
    }
    const commit = (segment: HTMLElement): void => {
      const id = segment.dataset.epubSegmentId
      if (id === undefined) return
      if (!hasTextOnlyChildren(segment)) {
        resetSegment(segment)
        onErrorRef.current('已阻止会改变 XHTML 结构的输入。')
        return
      }
      const text = segment.textContent
      if (text !== segmentText.get(id)) onCommitRef.current(id, text)
    }
    const beforeInput = (event: InputEvent): void => {
      const segment = segmentFromEvent(event)
      if (
        segment === null ||
        !isAllowedVisualInput(event.inputType) ||
        !selectionInside(document, segment)
      ) {
        event.preventDefault()
        onErrorRef.current('安全编辑只允许在同一段文字内输入、删除或改字。')
      }
    }
    const paste = (event: ClipboardEvent): void => {
      event.preventDefault()
      const segment = segmentFromEvent(event)
      const text = event.clipboardData?.getData('text/plain')
      if (
        segment === null ||
        text === undefined ||
        !replaceSelectionWithPlainText(document, segment, text)
      ) {
        onErrorRef.current('粘贴已被阻止；只能在同一文字段内粘贴纯文本。')
        return
      }
      commit(segment)
    }
    const drop = (event: DragEvent): void => {
      event.preventDefault()
      onErrorRef.current('安全编辑不允许拖放内容。')
    }
    const keydown = (event: KeyboardEvent): void => {
      if (event.key === 'Enter') {
        event.preventDefault()
        onErrorRef.current('安全编辑不能用回车创建新段落。')
      }
    }
    const compositionStart = (event: CompositionEvent): void => {
      composingSegment = segmentFromEvent(event)
    }
    const input = (event: InputEvent): void => {
      const segment = segmentFromEvent(event)
      const id = segment?.dataset.epubSegmentId
      if (segment === null || id === undefined) return
      if (!hasTextOnlyChildren(segment)) {
        resetSegment(segment)
        onErrorRef.current('已阻止会改变 XHTML 结构的输入。')
        return
      }
      onDraftChangeRef.current(id, segment.textContent)
    }
    const compositionEnd = (event: CompositionEvent): void => {
      const segment = segmentFromEvent(event) ?? composingSegment
      composingSegment = null
      if (segment !== null) commit(segment)
    }
    const focusOut = (event: FocusEvent): void => {
      const segment = segmentFromEvent(event)
      if (segment !== null && segment !== composingSegment) commit(segment)
    }

    document.addEventListener('beforeinput', beforeInput)
    document.addEventListener('paste', paste)
    document.addEventListener('drop', drop)
    document.addEventListener('keydown', keydown)
    document.addEventListener('compositionstart', compositionStart)
    document.addEventListener('compositionend', compositionEnd)
    document.addEventListener('input', input)
    document.addEventListener('focusout', focusOut)
    cleanupRef.current = () => {
      document.removeEventListener('beforeinput', beforeInput)
      document.removeEventListener('paste', paste)
      document.removeEventListener('drop', drop)
      document.removeEventListener('keydown', keydown)
      document.removeEventListener('compositionstart', compositionStart)
      document.removeEventListener('compositionend', compositionEnd)
      document.removeEventListener('input', input)
      document.removeEventListener('focusout', focusOut)
    }
  }

  return (
    <iframe
      className="chapter-frame chapter-frame--editable"
      onLoad={connectFrame}
      ref={frameRef}
      sandbox="allow-same-origin"
      srcDoc={preview.html}
      title={`${title}安全文字编辑`}
    />
  )
}

function hasTextOnlyChildren(element: HTMLElement): boolean {
  return Array.from(element.childNodes).every((node) => node.nodeType === 3)
}

function selectionInside(document: Document, segment: HTMLElement): boolean {
  const selection = document.getSelection()
  return (
    selection !== null &&
    selection.rangeCount === 1 &&
    segment.contains(selection.anchorNode) &&
    segment.contains(selection.focusNode)
  )
}

export function replaceSelectionWithPlainText(
  document: Document,
  segment: HTMLElement,
  text: string,
): boolean {
  const selection = document.getSelection()
  if (
    selection === null ||
    selection.rangeCount !== 1 ||
    !segment.contains(selection.anchorNode) ||
    !segment.contains(selection.focusNode)
  ) {
    return false
  }
  const range = selection.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  segment.normalize()
  return true
}
