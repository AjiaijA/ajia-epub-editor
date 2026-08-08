import { xml } from '@codemirror/lang-xml'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useEffect, useRef } from 'react'

interface SourceEditorProps {
  readonly onChange: (source: string) => void
  readonly readOnly?: boolean
  readonly value: string
}

export function SourceEditor({
  onChange,
  readOnly = false,
  value,
}: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const container = containerRef.current
    if (container === null) return
    const view = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        xml(),
        EditorState.tabSize.of(2),
        EditorView.lineWrapping,
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({
          'aria-label': readOnly ? 'XHTML 源码（只读）' : 'XHTML 源码编辑器',
          spellcheck: 'false',
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged)
            onChangeRef.current(update.state.doc.toString())
        }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-content': {
            caretColor: '#315c50',
            fontFamily:
              '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
            fontSize: '13px',
            lineHeight: '1.65',
            padding: '18px 0',
          },
          '.cm-focused': { outline: 'none' },
          '.cm-gutters': {
            backgroundColor: '#f7f5f0',
            borderRight: '1px solid #e1dcd4',
            color: '#94897d',
          },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-selectionBackground': { backgroundColor: '#dbe9e2 !important' },
        }),
      ],
      parent: container,
    })
    editorRef.current = view
    return () => {
      view.destroy()
      editorRef.current = null
    }
  }, [readOnly])

  useEffect(() => {
    const view = editorRef.current
    if (view === null || view.state.doc.toString() === value) return
    view.dispatch({
      changes: { from: 0, insert: value, to: view.state.doc.length },
    })
  }, [value])

  return <div className="source-editor" ref={containerRef} />
}
