import { useMemo, useRef, useState } from 'react'

import { IssuePanel } from '../components/IssuePanel.js'
import { NavigationTree } from '../components/NavigationTree.js'
import { createSandboxedPreview } from '../epub/preview/createPreview.js'
import {
  EpubOpenError,
  type EpubIssue,
  type EpubPublication,
} from '../models/publication.js'
import { openPublicationAsync } from './openPublicationAsync.js'

type AppState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'loading'; readonly fileName: string }
  | { readonly issues: readonly EpubIssue[]; readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly publication: EpubPublication }

export function App() {
  const [state, setState] = useState<AppState>({ kind: 'empty' })
  const [activePath, setActivePath] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const openTaskRef = useRef<AbortController | null>(null)

  const publication = state.kind === 'ready' ? state.publication : null
  const activeChapter =
    publication?.chapters.find(
      (chapter) => chapter.archivePath === activePath,
    ) ??
    publication?.chapters[0] ??
    null
  const preview = useMemo(() => {
    if (
      publication === null ||
      activeChapter?.visualEditCapability !== 'readonly'
    )
      return null
    try {
      return createSandboxedPreview(activeChapter, publication.archive)
    } catch {
      return null
    }
  }, [activeChapter, publication])

  async function openFile(file: File): Promise<void> {
    openTaskRef.current?.abort()
    const controller = new AbortController()
    openTaskRef.current = controller
    setState({ fileName: file.name, kind: 'loading' })
    setActivePath(null)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const nextPublication = await openPublicationAsync(
        bytes,
        file.name,
        controller.signal,
      )
      if (controller.signal.aborted) return
      setState({ kind: 'ready', publication: nextPublication })
      setActivePath(nextPublication.chapters[0]?.archivePath ?? null)
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        if (openTaskRef.current === controller) setState({ kind: 'empty' })
        return
      }
      if (openTaskRef.current !== controller) return
      const issues =
        cause instanceof EpubOpenError
          ? cause.issues
          : [
              {
                code: 'open.unexpected',
                message: '无法打开这个 EPUB。',
                severity: 'error' as const,
                ...(cause instanceof Error ? { detail: cause.message } : {}),
              },
            ]
      setState({ issues, kind: 'error' })
    } finally {
      if (openTaskRef.current === controller) openTaskRef.current = null
    }
  }

  if (state.kind !== 'ready') {
    const issues = state.kind === 'error' ? state.issues : []
    return (
      <main className="welcome-shell">
        <header className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <div>
            <p className="eyebrow">Local-first · Preserve-first</p>
            <h1>Ajia EPUB Editor</h1>
          </div>
        </header>
        <section
          className="drop-zone"
          onDragOver={(event) => {
            event.preventDefault()
          }}
          onDrop={(event) => {
            event.preventDefault()
            const file = event.dataTransfer.files[0]
            if (file !== undefined) void openFile(file)
          }}
        >
          <p className="phase-label">阶段 1 · 安全只读浏览</p>
          <h2>
            {state.kind === 'loading'
              ? `正在检查 ${state.fileName}`
              : '打开一本本地 EPUB'}
          </h2>
          <p>先检查压缩包安全与书籍结构，再在隔离区域中显示章节。</p>
          <button
            className="primary-button"
            disabled={state.kind === 'loading'}
            onClick={() => {
              inputRef.current?.click()
            }}
            type="button"
          >
            {state.kind === 'loading' ? '正在打开…' : '选择 EPUB 文件'}
          </button>
          {state.kind === 'loading' ? (
            <button
              className="cancel-button"
              onClick={() => {
                openTaskRef.current?.abort()
              }}
              type="button"
            >
              取消
            </button>
          ) : null}
          <input
            accept=".epub,application/epub+zip"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file !== undefined) void openFile(file)
            }}
            ref={inputRef}
            type="file"
          />
          <p className="privacy-note">
            文件只在您的浏览器中处理，不会上传到服务器。
          </p>
          <p className="support-note">
            支持无 DRM 的 EPUB 2 / EPUB 3；复杂或异常章节可能降级。
          </p>
        </section>
        {issues.length > 0 ? <IssuePanel issues={issues} /> : null}
      </main>
    )
  }

  return (
    <main className="reader-shell">
      <header className="reader-header">
        <div className="brand-lockup brand-lockup--compact">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <div>
            <p className="eyebrow">Ajia EPUB Editor</p>
            <h1>{state.publication.packageDocument.title}</h1>
          </div>
        </div>
        <div className="header-actions">
          <span className="local-badge">仅本地处理</span>
          <button
            className="secondary-button"
            onClick={() => {
              inputRef.current?.click()
            }}
            type="button"
          >
            打开另一本
          </button>
          <input
            accept=".epub,application/epub+zip"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file !== undefined) void openFile(file)
            }}
            ref={inputRef}
            type="file"
          />
        </div>
      </header>

      <div className="reader-grid">
        <aside className="sidebar">
          <div className="book-meta">
            <p>{state.publication.fileName}</p>
            <span>
              EPUB {state.publication.epubVersion} ·{' '}
              {state.publication.chapters.length} 章
            </span>
          </div>
          <div className="section-heading section-heading--sidebar">
            <div>
              <p className="eyebrow">阅读顺序</p>
              <h2>目录</h2>
            </div>
            <span className="source-badge">
              {state.publication.navigation.source.toUpperCase()}
            </span>
          </div>
          <NavigationTree
            activePath={activeChapter?.archivePath ?? null}
            availablePaths={
              new Set(
                state.publication.chapters.map(
                  (chapter) => chapter.archivePath,
                ),
              )
            }
            items={state.publication.navigation.items}
            onSelect={setActivePath}
          />
        </aside>

        <section className="reading-pane" aria-labelledby="chapter-heading">
          <div className="reading-toolbar">
            <div>
              <p className="eyebrow">只读沙箱预览</p>
              <h2 id="chapter-heading">
                {activeChapter?.title ?? '没有可预览章节'}
              </h2>
            </div>
            {preview === null ? null : (
              <span className="sanitization-badge">
                已隔离 · 拦截 {preview.blockedResourceCount} 项
              </span>
            )}
          </div>
          {activeChapter === null ? (
            <div className="empty-preview">
              spine 中没有可读取的 XHTML 章节。
            </div>
          ) : preview === null ? (
            <div className="empty-preview">
              本章结构无法安全预览，已降级为只读不可见状态。
            </div>
          ) : (
            <iframe
              className="chapter-frame"
              sandbox=""
              srcDoc={preview.html}
              title={`${activeChapter.title}只读预览`}
            />
          )}
        </section>

        <aside className="issues-column">
          <IssuePanel issues={state.publication.issues} />
        </aside>
      </div>
      <footer className="reader-footer">
        <span>文件只在您的浏览器中处理，不会上传到服务器。</span>
        <span>阶段 1 · 只读模式</span>
      </footer>
    </main>
  )
}
