import { useMemo, useRef, useState, type RefObject } from 'react'

import { IssuePanel } from '../components/IssuePanel.js'
import { NavigationTree } from '../components/NavigationTree.js'
import { SourceEditor } from '../components/SourceEditor.js'
import {
  commitChapterSource,
  createEditSession,
  getChapterSource,
  SourceValidationError,
} from '../epub/editor/editSession.js'
import { ExportValidationError } from '../epub/exporter/exportEpub.js'
import { createSandboxedPreview } from '../epub/preview/createPreview.js'
import { validateExportSession } from '../epub/validator/exportValidator.js'
import {
  EpubOpenError,
  type EpubEditSession,
  type EpubIssue,
} from '../models/publication.js'
import { openPublicationAsync } from './openPublicationAsync.js'
import { exportEpubAsync } from './exportEpubAsync.js'

type AppState =
  | { readonly kind: 'empty' }
  | { readonly fileName: string; readonly kind: 'loading' }
  | { readonly issues: readonly EpubIssue[]; readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly session: EpubEditSession }

type EditorMode = 'preview' | 'source'

export function App() {
  const [state, setState] = useState<AppState>({ kind: 'empty' })
  const [activePath, setActivePath] = useState<string | null>(null)
  const [mode, setMode] = useState<EditorMode>('preview')
  const [draft, setDraft] = useState('')
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [exportIssues, setExportIssues] = useState<readonly EpubIssue[]>([])
  const [exporting, setExporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const openTaskRef = useRef<AbortController | null>(null)

  const session = state.kind === 'ready' ? state.session : null
  const publication = session?.publication ?? null
  const activeChapter =
    publication?.chapters.find(
      (chapter) => chapter.archivePath === activePath,
    ) ??
    publication?.chapters[0] ??
    null
  const currentSource =
    session !== null && activeChapter !== null
      ? getChapterSource(session, activeChapter.archivePath)
      : ''
  const preview = useMemo(() => {
    if (
      publication === null ||
      activeChapter?.visualEditCapability !== 'readonly'
    ) {
      return null
    }
    try {
      return createSandboxedPreview(
        { ...activeChapter, originalSource: currentSource },
        publication.archive,
      )
    } catch {
      return null
    }
  }, [activeChapter, currentSource, publication])

  async function openFile(file: File): Promise<void> {
    if (
      session !== null &&
      session.dirtyEntries.size > 0 &&
      !window.confirm('当前修改尚未导出。确认放弃修改并打开另一本书吗？')
    ) {
      return
    }
    openTaskRef.current?.abort()
    const controller = new AbortController()
    openTaskRef.current = controller
    setState({ fileName: file.name, kind: 'loading' })
    resetEditorUi()
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const nextPublication = await openPublicationAsync(
        bytes,
        file.name,
        controller.signal,
      )
      if (controller.signal.aborted) return
      const nextSession = createEditSession(nextPublication)
      const firstPath = nextPublication.chapters[0]?.archivePath ?? null
      setState({ kind: 'ready', session: nextSession })
      setActivePath(firstPath)
      setDraft(
        firstPath === null ? '' : getChapterSource(nextSession, firstPath),
      )
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

  function resetEditorUi(): void {
    setActivePath(null)
    setMode('preview')
    setDraft('')
    setSourceError(null)
    setExportIssues([])
  }

  function commitDraft(sourceSession: EpubEditSession): EpubEditSession | null {
    if (activeChapter === null || mode !== 'source') return sourceSession
    const savedSource = getChapterSource(
      sourceSession,
      activeChapter.archivePath,
    )
    if (draft === savedSource) {
      setSourceError(null)
      return sourceSession
    }
    try {
      const nextSession = commitChapterSource(
        sourceSession,
        activeChapter.archivePath,
        draft,
      )
      setState({ kind: 'ready', session: nextSession })
      setSourceError(null)
      setExportIssues([])
      return nextSession
    } catch (cause) {
      setSourceError(
        cause instanceof SourceValidationError
          ? cause.message
          : '源码提交失败，请检查 XHTML。',
      )
      return null
    }
  }

  function selectChapter(path: string): void {
    if (session === null) return
    const nextSession = commitDraft(session)
    if (nextSession === null) return
    setActivePath(path)
    setDraft(getChapterSource(nextSession, path))
    setSourceError(null)
  }

  function showPreview(): void {
    if (session === null) return
    const nextSession = commitDraft(session)
    if (nextSession !== null) setMode('preview')
  }

  function showSource(): void {
    if (activeChapter === null) return
    setDraft(currentSource)
    setSourceError(null)
    setMode('source')
  }

  function runExportCheck(): EpubEditSession | null {
    if (session === null) return null
    const nextSession = commitDraft(session)
    if (nextSession === null) return null
    setExportIssues(validateExportSession(nextSession).issues)
    return nextSession
  }

  async function downloadExport(): Promise<void> {
    const nextSession = runExportCheck()
    if (nextSession === null) return
    setExporting(true)
    try {
      const exported = await exportEpubAsync(nextSession)
      const buffer = exported.bytes.slice().buffer
      const url = URL.createObjectURL(
        new Blob([buffer], { type: 'application/epub+zip' }),
      )
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = exported.fileName
      anchor.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 0)
      setExportIssues([
        ...exported.validation.issues,
        {
          code: 'export.download-created',
          message: `已生成“${exported.fileName}”，原文件未被覆盖。`,
          severity: 'info',
        },
      ])
    } catch (cause) {
      setExportIssues(
        cause instanceof ExportValidationError
          ? cause.issues
          : [
              {
                code: 'export.failed',
                message: '导出失败，没有生成下载文件。',
                severity: 'error',
                ...(cause instanceof Error ? { detail: cause.message } : {}),
              },
            ],
      )
    } finally {
      setExporting(false)
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
          <p className="phase-label">阶段 2 · 源码编辑与可靠导出</p>
          <h2>
            {state.kind === 'loading'
              ? `正在检查 ${state.fileName}`
              : '打开一本本地 EPUB'}
          </h2>
          <p>先检查压缩包安全与书籍结构，再在本地进行源码修订。</p>
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
          <FileInput inputRef={inputRef} onFile={openFile} />
          <p className="privacy-note">
            文件只在您的浏览器中处理，不会上传到服务器。
          </p>
          <p className="support-note">
            支持无 DRM 的 EPUB 2 / EPUB 3；导出始终生成新文件。
          </p>
        </section>
        {issues.length > 0 ? <IssuePanel issues={issues} /> : null}
      </main>
    )
  }

  const readySession = state.session
  const readyPublication = readySession.publication
  const draftChanged = activeChapter !== null && draft !== currentSource
  const sourceLocked = activeChapter?.sourceEditCapability === 'encrypted'

  return (
    <main className="reader-shell">
      <header className="reader-header">
        <div className="brand-lockup brand-lockup--compact">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <div>
            <p className="eyebrow">Ajia EPUB Editor</p>
            <h1>{readyPublication.packageDocument.title}</h1>
          </div>
        </div>
        <div className="header-actions">
          <span className="local-badge">仅本地处理</span>
          <button
            className="secondary-button"
            onClick={() => {
              runExportCheck()
            }}
            type="button"
          >
            检查
          </button>
          <button
            className="export-button"
            disabled={exporting}
            onClick={() => {
              void downloadExport()
            }}
            type="button"
          >
            {exporting ? '正在导出…' : '导出 EPUB'}
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              inputRef.current?.click()
            }}
            type="button"
          >
            打开另一本
          </button>
          <FileInput inputRef={inputRef} onFile={openFile} />
        </div>
      </header>

      <div className="reader-grid">
        <aside className="sidebar">
          <div className="book-meta">
            <p>{readyPublication.fileName}</p>
            <span>
              EPUB {readyPublication.epubVersion} ·{' '}
              {readyPublication.chapters.length} 章
            </span>
          </div>
          <div className="section-heading section-heading--sidebar">
            <div>
              <p className="eyebrow">阅读顺序</p>
              <h2>目录</h2>
            </div>
            <span className="source-badge">
              {readyPublication.navigation.source.toUpperCase()}
            </span>
          </div>
          <NavigationTree
            activePath={activeChapter?.archivePath ?? null}
            availablePaths={
              new Set(
                readyPublication.chapters.map((chapter) => chapter.archivePath),
              )
            }
            items={readyPublication.navigation.items}
            onSelect={selectChapter}
          />
        </aside>

        <section className="reading-pane" aria-labelledby="chapter-heading">
          <div className="reading-toolbar reading-toolbar--editor">
            <div>
              <p className="eyebrow">
                {mode === 'preview' ? '隔离预览' : '高级源码模式'}
              </p>
              <h2 id="chapter-heading">
                {activeChapter?.title ?? '没有可用章节'}
              </h2>
            </div>
            <div className="reading-tools">
              {mode === 'preview' && preview !== null ? (
                <span className="sanitization-badge">
                  已隔离 · 拦截 {preview.blockedResourceCount} 项
                </span>
              ) : null}
              <div className="editor-tabs" role="tablist" aria-label="章节视图">
                <button
                  aria-selected={mode === 'preview'}
                  onClick={showPreview}
                  role="tab"
                  type="button"
                >
                  预览
                </button>
                <button
                  aria-selected={mode === 'source'}
                  onClick={showSource}
                  role="tab"
                  type="button"
                >
                  XHTML 源码
                </button>
              </div>
            </div>
          </div>

          {mode === 'source' ? (
            sourceLocked ? (
              <div className="empty-preview">
                本章标记为受保护内容，不能查看或修改源码。
              </div>
            ) : (
              <div className="source-workspace">
                <div className="source-actions">
                  <span>
                    {draftChanged
                      ? '有尚未验证的源码修改'
                      : readySession.dirtyEntries.has(
                            activeChapter?.archivePath ?? '',
                          )
                        ? '本章已有已验证修改'
                        : '源码与打开时一致'}
                  </span>
                  <div>
                    <button
                      className="secondary-button"
                      disabled={!draftChanged}
                      onClick={() => {
                        setDraft(currentSource)
                        setSourceError(null)
                      }}
                      type="button"
                    >
                      取消本次输入
                    </button>
                    <button
                      className="apply-button"
                      disabled={!draftChanged}
                      onClick={() => {
                        commitDraft(readySession)
                      }}
                      type="button"
                    >
                      验证并应用
                    </button>
                  </div>
                </div>
                {sourceError === null ? null : (
                  <div className="source-error" role="alert">
                    <strong>XML 未通过验证</strong>
                    <span>{sourceError}</span>
                  </div>
                )}
                {activeChapter === null ? (
                  <div className="empty-preview">没有可编辑的 XHTML 章节。</div>
                ) : (
                  <SourceEditor
                    key={activeChapter.archivePath}
                    onChange={setDraft}
                    value={draft}
                  />
                )}
              </div>
            )
          ) : activeChapter === null ? (
            <div className="empty-preview">
              spine 中没有可读取的 XHTML 章节。
            </div>
          ) : preview === null ? (
            <div className="empty-preview">
              本章结构无法安全预览，请切换到 XHTML 源码修正。
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
          {exportIssues.length > 0 ? (
            <IssuePanel issues={exportIssues} />
          ) : null}
          <IssuePanel issues={readyPublication.issues} />
        </aside>
      </div>
      <footer className="reader-footer">
        <span>
          本地处理 · 已修改 {readySession.dirtyEntries.size} 个 entry ·{' '}
          {readySession.transactions.length} 次源码提交
        </span>
        <span>阶段 2 · 原文件永不覆盖</span>
      </footer>
    </main>
  )
}

function FileInput({
  inputRef,
  onFile,
}: {
  readonly inputRef: RefObject<HTMLInputElement | null>
  readonly onFile: (file: File) => Promise<void>
}) {
  return (
    <input
      accept=".epub,application/epub+zip"
      className="visually-hidden"
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file !== undefined) void onFile(file)
      }}
      ref={inputRef}
      type="file"
    />
  )
}
