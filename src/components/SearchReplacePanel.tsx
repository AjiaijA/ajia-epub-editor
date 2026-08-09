import { useEffect, useRef, useState } from 'react'

import { searchBodyTextAsync } from '../app/searchBodyTextAsync.js'
import {
  replaceAllSearchResults,
  replaceSearchResult,
  type SearchResult,
  type SearchScope,
} from '../epub/search/textSearch.js'
import type { EpubEditSession } from '../models/publication.js'
import { useI18n } from '../i18n.js'

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
  const { locale, text } = useI18n()
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [scope, setScope] = useState<SearchScope>('book')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<readonly SearchResult[]>([])
  const [indexing, setIndexing] = useState(false)
  const [indexCancelled, setIndexCancelled] = useState(false)
  const searchControllerRef = useRef<AbortController | null>(null)
  const queryInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    queryInputRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])
  useEffect(() => {
    searchControllerRef.current?.abort()
    setSelectedIndex(0)
    setError(null)
    setIndexCancelled(false)
    if (query === '') {
      setResults([])
      setIndexing(false)
      return
    }
    const controller = new AbortController()
    searchControllerRef.current = controller
    setIndexing(true)
    const timer = window.setTimeout(() => {
      void searchBodyTextAsync(
        session,
        query,
        scope,
        activeChapterPath ?? undefined,
        controller.signal,
      )
        .then((nextResults) => {
          if (controller.signal.aborted) return
          setResults(nextResults)
          setIndexing(false)
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return
          setResults([])
          setIndexing(false)
          setError(
            cause instanceof Error && locale === 'en'
              ? cause.message
              : text(
                  'The body-text index could not be created.',
                  '无法建立正文索引。',
                ),
          )
        })
    }, 120)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [activeChapterPath, locale, query, scope, session, text])
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
      setError(
        cause instanceof Error && locale === 'en'
          ? cause.message
          : text('Replacement failed.', '替换失败。'),
      )
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
      setError(
        cause instanceof Error && locale === 'en'
          ? cause.message
          : text('Replace all failed.', '全部替换失败。'),
      )
    }
  }

  return (
    <section
      aria-label={text('Find and replace', '查找替换')}
      className="search-panel"
    >
      <div className="search-panel__heading">
        <div>
          <p className="eyebrow">Body TextSegment</p>
          <h2>{text('Find & replace', '查找替换')}</h2>
        </div>
        <button className="secondary-button" onClick={onClose} type="button">
          {text('Close', '关闭')}
        </button>
      </div>
      <label>
        {text('Find in body text', '查找正文')}
        <input
          onChange={(event) => {
            setQuery(event.target.value)
            setSelectedIndex(0)
          }}
          placeholder={text('Enter text to find', '输入查找文字')}
          ref={queryInputRef}
          value={query}
        />
      </label>
      <label>
        {text('Replace with', '替换为')}
        <input
          onChange={(event) => {
            setReplacement(event.target.value)
          }}
          placeholder={text('Leave empty to delete', '可以留空以删除')}
          value={replacement}
        />
      </label>
      <fieldset>
        <legend>{text('Scope', '范围')}</legend>
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
          {text('Current chapter', '当前章节')}
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
          {text('Whole book', '全书')}
        </label>
      </fieldset>
      <div aria-live="polite" className="search-summary" role="status">
        {indexing ? (
          <>
            <progress
              aria-label={text('Indexing body text', '正在建立正文索引')}
            />
            <span>{text('Indexing body text…', '正在后台建立正文索引…')}</span>
            <button
              className="cancel-button cancel-button--inline"
              onClick={() => {
                searchControllerRef.current?.abort()
                setResults([])
                setIndexing(false)
                setIndexCancelled(true)
              }}
              type="button"
            >
              {text('Cancel indexing', '取消索引')}
            </button>
          </>
        ) : query === '' ? (
          text('Enter text to begin searching.', '输入查找文字后开始索引。')
        ) : indexCancelled ? (
          text(
            'Indexing was cancelled. Change the query to restart.',
            '索引已取消；修改查找文字即可重新开始。',
          )
        ) : (
          text(
            `Found ${String(results.length)} matches in ${String(chapterCount)} chapters.`,
            `找到 ${String(results.length)} 处，涉及 ${String(chapterCount)} 章。`,
          )
        )}
      </div>
      <p className="search-help">
        {text(
          'Search covers body text, not attributes. Phrases spanning inline text segments do not match.',
          '仅搜索正文，不搜索属性；跨 inline text segment 的词组不会匹配。',
        )}
      </p>
      {error === null ? null : (
        <p className="search-error" role="alert">
          {error}
        </p>
      )}
      <div className="search-actions">
        <button
          className="secondary-button"
          disabled={indexing || results.length === 0}
          onClick={() => {
            moveSelection(-1)
          }}
          type="button"
        >
          {text('Previous', '上一处')}
        </button>
        <span className="search-position">
          {selected === undefined
            ? '— / —'
            : `${String(Math.min(selectedIndex, results.length - 1) + 1)} / ${String(results.length)}`}
        </span>
        <button
          className="secondary-button"
          disabled={indexing || results.length === 0}
          onClick={() => {
            moveSelection(1)
          }}
          type="button"
        >
          {text('Next', '下一处')}
        </button>
      </div>
      <div className="search-actions">
        <button
          className="secondary-button"
          disabled={indexing || selected === undefined}
          onClick={replaceOne}
          type="button"
        >
          {text('Replace current', '替换当前')}
        </button>
        <button
          className="apply-button"
          disabled={indexing || results.length === 0}
          onClick={replaceAll}
          type="button"
        >
          {text('Replace all', '全部替换')}{' '}
          {results.length > 0 ? `(${String(results.length)})` : ''}
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
