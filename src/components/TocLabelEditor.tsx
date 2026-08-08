import { useEffect, useState } from 'react'

import { renameNavigationLabel } from '../epub/navigation/tocEditor.js'
import type {
  EpubEditSession,
  EpubIssue,
  NavigationItem,
} from '../models/publication.js'

interface TocLabelEditorProps {
  readonly item: NavigationItem
  readonly onApply: (
    session: EpubEditSession,
    issues: readonly EpubIssue[],
  ) => void
  readonly session: EpubEditSession
}

export function TocLabelEditor({
  item,
  onApply,
  session,
}: TocLabelEditorProps) {
  const [label, setLabel] = useState(item.label)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setLabel(item.label)
    setError(null)
  }, [item.id, item.label])

  return (
    <section aria-label="目录名称编辑" className="toc-editor">
      <label>
        目录显示文字
        <input
          onChange={(event) => {
            setLabel(event.target.value)
          }}
          value={label}
        />
      </label>
      <button
        className="secondary-button"
        disabled={label === item.label || label.trim() === ''}
        onClick={() => {
          try {
            const result = renameNavigationLabel(session, item, label)
            onApply(result.session, result.issues)
            setError(null)
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : '目录改名失败。')
          }
        }}
        type="button"
      >
        更新目录名称
      </button>
      {error === null ? null : (
        <p className="search-error" role="alert">
          {error}
        </p>
      )}
      <p>只修改 label；href、fragment 与阅读顺序保持不变。</p>
    </section>
  )
}
