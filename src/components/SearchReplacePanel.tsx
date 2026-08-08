import { useMemo, useState } from 'react'

import {
  replaceAllSearchResults,
  replaceSearchResult,
  searchBodyText,
  type SearchScope,
} from '../epub/search/textSearch.js'
import type { EpubEditSession } from '../models/publication.js'

interface SearchReplacePanelProps {
  readonly activeChapterPath: string | null
  readonly onApply: (session: EpubEditSession, chapterPath: string) => void
  readonly onClose: () => void
  readonly onNavigate: (chapterPath: string) => void
  readonly session: EpubEditSession
}

export function SearchReplacePanel({
  activeChapterPath,
  onApply,
  onClose,
  onNavigate,
  session,
}: SearchReplacePanelProps) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [scope, setScope] = useState<SearchScope>('book')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const results = useMemo(
    () => searchBodyText(session, query, scope, activeChapterPath ?? undefined),
    [activeChapterPath, query, scope, session],
  )
  const selected = results[Math.min(selectedIndex, results.length - 1)]
  const chapterCount = new Set(results.map((result) => result.chapterPath)).size

  const moveSelection = (offset: number): void => {
    if (results.length === 0) return
    const nextIndex =
      (Math.min(selectedIndex, results.length - 1) + offset + results.length) %
      results.length
    const next = results[nextIndex]
    if (next === undefined) return
    setSelectedIndex(nextIndex)
    onNavigate(next.chapterPath)
  }

  const replaceOne = (): void => {
    if (selected === undefined) return
    try {
      onApply(
        replaceSearchResult(session, selected, replacement),
        selected.chapterPath,
      )
      setError(null)
      setSelectedIndex(0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '替换失败。')
    }
  }
  const replaceAll = (): void => {
    if (results.length === 0) return
    try {
      const firstPath = results[0]?.chapterPath ?? activeChapterPath
      const next = replaceAllSearchResults(session, results, replacement)
      if (firstPath !== null) onApply(next, firstPath)
      setError(null)
      setSelectedIndex(0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '全部替换失败。')
    }
  }

  return (
    <section aria-label="查找替换" className="search-panel">
      <div className="search-panel__heading">
        <div>
          <p className="eyebrow">正文 TextSegment</p>
          <h2>查找替换</h2>
        </div>
        <button className="secondary-button" onClick={onClose} type="button">
          关闭
        </button>
      </div>
      <label>
        查找正文
        <input
          onChange={(event) => {
            setQuery(event.target.value)
            setSelectedIndex(0)
          }}
          placeholder="输入查找文字"
          value={query}
        />
      </label>
      <label>
        替换为
        <input
          onChange={(event) => {
            setReplacement(event.target.value)
          }}
          placeholder="可以留空以删除"
          value={replacement}
        />
      </label>
      <fieldset>
        <legend>范围</legend>
        <label>
          <input
            checked={scope === 'chapter'}
            name="search-scope"
            onChange={() => {
              setScope('chapter')
              setSelectedIndex(0)
            }}
            type="radio"
          />
          当前章节
        </label>
        <label>
          <input
            checked={scope === 'book'}
            name="search-scope"
            onChange={() => {
              setScope('book')
              setSelectedIndex(0)
            }}
            type="radio"
          />
          全书
        </label>
      </fieldset>
      <p className="search-summary">
        {query === ''
          ? '输入查找文字后开始索引。'
          : `找到 ${String(results.length)} 处，涉及 ${String(chapterCount)} 章。`}
      </p>
      <p className="search-help">
        仅搜索正文，不搜索属性；跨 inline text segment 的词组不会匹配。
      </p>
      {error === null ? null : (
        <p className="search-error" role="alert">
          {error}
        </p>
      )}
      <div className="search-actions">
        <button
          className="secondary-button"
          disabled={results.length === 0}
          onClick={() => {
            moveSelection(-1)
          }}
          type="button"
        >
          上一处
        </button>
        <span className="search-position">
          {selected === undefined
            ? '— / —'
            : `${String(Math.min(selectedIndex, results.length - 1) + 1)} / ${String(results.length)}`}
        </span>
        <button
          className="secondary-button"
          disabled={results.length === 0}
          onClick={() => {
            moveSelection(1)
          }}
          type="button"
        >
          下一处
        </button>
      </div>
      <div className="search-actions">
        <button
          className="secondary-button"
          disabled={selected === undefined}
          onClick={replaceOne}
          type="button"
        >
          替换当前
        </button>
        <button
          className="apply-button"
          disabled={results.length === 0}
          onClick={replaceAll}
          type="button"
        >
          全部替换 {results.length > 0 ? `(${String(results.length)})` : ''}
        </button>
      </div>
      <ol className="search-results">
        {results.map((result, index) => (
          <li key={result.id}>
            <button
              aria-current={index === selectedIndex ? 'true' : undefined}
              onClick={() => {
                setSelectedIndex(index)
                onNavigate(result.chapterPath)
              }}
              type="button"
            >
              <strong>{result.chapterTitle}</strong>
              <span>
                {result.contextBefore}
                <mark>{result.matchedText}</mark>
                {result.contextAfter}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
