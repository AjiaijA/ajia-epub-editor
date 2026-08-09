import { useMemo, useRef, useState, type RefObject } from 'react'

import { IssuePanel } from '../components/IssuePanel.js'
import { NavigationTree } from '../components/NavigationTree.js'
import { SafeVisualEditor } from '../components/SafeVisualEditor.js'
import { SearchReplacePanel } from '../components/SearchReplacePanel.js'
import { SourceEditor } from '../components/SourceEditor.js'
import { TocLabelEditor } from '../components/TocLabelEditor.js'
import {
  commitChapterSource,
  commitVisualText,
  createEditSession,
  getChapterSource,
  getChapterTextSegments,
  redoEdit,
  SourceValidationError,
  undoEdit,
} from '../epub/editor/editSession.js'
import { ExportValidationError } from '../epub/exporter/exportEpub.js'
import { createSandboxedPreview } from '../epub/preview/createPreview.js'
import { getCurrentNavigation } from '../epub/navigation/tocEditor.js'
import { validateExportSession } from '../epub/validator/exportValidator.js'
import {
  EpubOpenError,
  type EpubEditSession,
  type EpubIssue,
  type NavigationItem,
} from '../models/publication.js'
import { RELEASE_LABEL } from '../release.js'
import { openPublicationAsync } from './openPublicationAsync.js'
import { exportEpubAsync } from './exportEpubAsync.js'

type AppState =
  | { readonly kind: 'empty' }
  | { readonly fileName: string; readonly kind: 'loading' }
  | { readonly issues: readonly EpubIssue[]; readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly session: EpubEditSession }

type EditorMode = 'preview' | 'source' | 'visual'

export function App() {
  const [state, setState] = useState<AppState>({ kind: 'empty' })
  const [activePath, setActivePath] = useState<string | null>(null)
  const [mode, setMode] = useState<EditorMode>('preview')
  const [draft, setDraft] = useState('')
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [visualError, setVisualError] = useState<string | null>(null)
  const [visualResetRevision, setVisualResetRevision] = useState(0)
  const [exportIssues, setExportIssues] = useState<readonly EpubIssue[]>([])
  const [exporting, setExporting] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedTocId, setSelectedTocId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const openTaskRef = useRef<AbortController | null>(null)
  const pendingVisualRef = useRef<{
    readonly segmentId: string
    readonly text: string
  } | null>(null)

  const session = state.kind === 'ready' ? state.session : null
  const publication = session?.publication ?? null
  const currentNavigation = useMemo(
    () => (session === null ? null : getCurrentNavigation(session)),
    [session],
  )
  const selectedTocItem = useMemo(() => {
    if (currentNavigation === null || selectedTocId === null) return null
    return (
      flattenNavigation(currentNavigation.items).find(
        (item) => item.id === selectedTocId,
      ) ?? null
    )
  }, [currentNavigation, selectedTocId])
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
  const visualSegments = useMemo(() => {
    if (
      session === null ||
      activeChapter === null ||
      activeChapter.visualEditCapability !== 'safe'
    ) {
      return []
    }
    try {
      return getChapterTextSegments(session, activeChapter.archivePath)
    } catch {
      return []
    }
  }, [activeChapter, session])
  const preview = useMemo(() => {
    if (
      publication === null ||
      activeChapter === null ||
      activeChapter.visualEditCapability === 'source-only'
    ) {
      return null
    }
    try {
      return createSandboxedPreview(
        { ...activeChapter, originalSource: currentSource },
        publication.archive,
        mode === 'visual' ? { editableSegments: visualSegments } : {},
      )
    } catch {
      return null
    }
  }, [activeChapter, currentSource, mode, publication, visualSegments])

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
      setSelectedTocId(nextPublication.navigation.items[0]?.id ?? null)
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
    setVisualError(null)
    setVisualResetRevision(0)
    setExportIssues([])
    setSearchOpen(false)
    setSelectedTocId(null)
    pendingVisualRef.current = null
  }

  function commitDraft(sourceSession: EpubEditSession): EpubEditSession | null {
    if (mode === 'visual') return flushVisualDraft(sourceSession).session
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

  function flushVisualDraft(sourceSession: EpubEditSession): {
    readonly accepted: boolean
    readonly session: EpubEditSession
  } {
    const pending = pendingVisualRef.current
    if (pending === null || activeChapter === null) {
      return { accepted: true, session: sourceSession }
    }
    try {
      const nextSession = commitVisualText(
        sourceSession,
        activeChapter.archivePath,
        pending.segmentId,
        pending.text,
      )
      pendingVisualRef.current = null
      setState({ kind: 'ready', session: nextSession })
      setDraft(getChapterSource(nextSession, activeChapter.archivePath))
      setVisualError(null)
      setExportIssues([])
      return { accepted: true, session: nextSession }
    } catch {
      pendingVisualRef.current = null
      setVisualResetRevision((revision) => revision + 1)
      setVisualError(
        '这次修改未保存，原文字已恢复；您可以继续操作。若要改变标签结构，请使用 XHTML 源码模式。',
      )
      return { accepted: false, session: sourceSession }
    }
  }

  function selectChapter(path: string, item?: NavigationItem): void {
    if (session === null) return
    const nextSession = commitDraft(session)
    if (nextSession === null) return
    setActivePath(path)
    if (item !== undefined) setSelectedTocId(item.id)
    setDraft(getChapterSource(nextSession, path))
    setSourceError(null)
  }

  function showPreview(): void {
    if (session === null) return
    const nextSession = commitDraft(session)
    if (nextSession !== null) setMode('preview')
  }

  function showVisual(): void {
    if (session === null || activeChapter?.visualEditCapability !== 'safe') {
      setVisualError('本章包含复杂结构，请使用预览或 XHTML 源码模式。')
      return
    }
    const nextSession = commitDraft(session)
    if (nextSession !== null) {
      setVisualError(null)
      setMode('visual')
    }
  }

  function applyVisualEdit(segmentId: string, text: string): boolean {
    if (session === null) return false
    pendingVisualRef.current = { segmentId, text }
    return flushVisualDraft(session).accepted
  }

  function showSource(): void {
    if (activeChapter === null || session === null) return
    const nextSession = commitDraft(session)
    if (nextSession === null) return
    setDraft(getChapterSource(nextSession, activeChapter.archivePath))
    setSourceError(null)
    setMode('source')
  }

  function openSearch(): void {
    if (session === null) return
    const nextSession = commitDraft(session)
    if (nextSession !== null) setSearchOpen(true)
  }

  function applySession(nextSession: EpubEditSession, path?: string): void {
    const nextPath = path ?? activeChapter?.archivePath ?? null
    setState({ kind: 'ready', session: nextSession })
    if (nextPath !== null) {
      setActivePath(nextPath)
      setDraft(getChapterSource(nextSession, nextPath))
    }
    pendingVisualRef.current = null
    setSourceError(null)
    setVisualError(null)
    setExportIssues([])
  }

  function runUndo(): void {
    if (session === null) return
    const committed = commitDraft(session)
    if (committed !== null) applySession(undoEdit(committed))
  }

  function runRedo(): void {
    if (session === null) return
    const committed = commitDraft(session)
    if (committed !== null) applySession(redoEdit(committed))
  }

  function restoreActiveChapter(): void {
    if (session === null || activeChapter === null) return
    if (
      !window.confirm('确认将本章恢复为打开 EPUB 时的内容吗？此操作可以 Undo。')
    ) {
      return
    }
    try {
      const nextSession = commitChapterSource(
        session,
        activeChapter.archivePath,
        activeChapter.originalSource,
      )
      applySession(nextSession, activeChapter.archivePath)
    } catch (cause) {
      setSourceError(
        cause instanceof Error ? cause.message : '无法恢复本章原始内容。',
      )
    }
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
          <p className="phase-label">{RELEASE_LABEL} · 本地测试版本</p>
          <h2>
            {state.kind === 'loading'
              ? `正在检查 ${state.fileName}`
              : '打开一本本地 EPUB'}
          </h2>
          <p>先检查压缩包安全与书籍结构，再在本地进行源码修订。</p>
          {state.kind === 'loading' ? (
            <div aria-live="polite" className="task-progress" role="status">
              <progress aria-label="正在安全检查 EPUB" />
              <span>正在后台检查压缩包、书籍结构和目录…</span>
            </div>
          ) : null}
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
  const affectedChapterCount = new Set(
    readySession.transactions.flatMap((transaction) =>
      transaction.changes
        .map((change) => change.path)
        .filter((path) =>
          readyPublication.chapters.some(
            (chapter) => chapter.archivePath === path,
          ),
        ),
    ),
  ).size

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
            onClick={openSearch}
            ref={searchButtonRef}
            type="button"
          >
            查找替换
          </button>
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

      {exporting ? (
        <div aria-live="polite" className="task-status" role="status">
          <progress aria-label="正在导出 EPUB" />
          正在后台验证并生成新 EPUB，请保持页面开启…
        </div>
      ) : null}

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
              {currentNavigation?.source.toUpperCase() ?? '—'}
            </span>
          </div>
          <NavigationTree
            activePath={activeChapter?.archivePath ?? null}
            availablePaths={
              new Set(
                readyPublication.chapters.map((chapter) => chapter.archivePath),
              )
            }
            items={currentNavigation?.items ?? []}
            onSelect={selectChapter}
            selectedItemId={selectedTocId}
          />
          {selectedTocItem === null ||
          selectedTocItem.sources[0]?.kind === 'spine' ? null : (
            <TocLabelEditor
              item={selectedTocItem}
              onApply={(nextSession, issues) => {
                applySession(nextSession)
                setExportIssues(issues)
              }}
              session={readySession}
            />
          )}
        </aside>

        <section className="reading-pane" aria-labelledby="chapter-heading">
          <div className="reading-toolbar reading-toolbar--editor">
            <div>
              <p className="eyebrow">
                {mode === 'preview'
                  ? '隔离预览'
                  : mode === 'visual'
                    ? '安全文字编辑'
                    : '高级源码模式'}
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
              {mode === 'visual' ? (
                <span className="sanitization-badge">
                  虚线文字可编辑 · {visualSegments.length} 段
                </span>
              ) : null}
              <div className="editor-tabs" role="tablist" aria-label="章节视图">
                <button
                  aria-selected={mode === 'visual'}
                  disabled={activeChapter?.visualEditCapability !== 'safe'}
                  onClick={showVisual}
                  role="tab"
                  type="button"
                >
                  安全编辑
                </button>
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

          {visualError === null ? null : (
            <div className="source-error visual-error" role="alert">
              <div>
                <strong>安全编辑提示</strong>
                <span>{visualError}</span>
              </div>
              <button
                aria-label="关闭安全编辑提示"
                onClick={() => {
                  setVisualError(null)
                }}
                type="button"
              >
                关闭提示
              </button>
            </div>
          )}

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
                      disabled={
                        activeChapter === null ||
                        (!draftChanged &&
                          !readySession.dirtyEntries.has(
                            activeChapter.archivePath,
                          ))
                      }
                      onClick={restoreActiveChapter}
                      type="button"
                    >
                      恢复本章打开时内容
                    </button>
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
          ) : mode === 'visual' &&
            activeChapter !== null &&
            preview !== null ? (
            <SafeVisualEditor
              key={`${activeChapter.archivePath}:${String(readySession.chapterRevisions.get(activeChapter.archivePath) ?? 0)}:${String(visualResetRevision)}`}
              onCommit={applyVisualEdit}
              onDraftChange={(segmentId, text) => {
                pendingVisualRef.current = { segmentId, text }
              }}
              onError={setVisualError}
              preview={preview}
              segments={visualSegments}
              title={activeChapter.title}
            />
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
          {searchOpen ? (
            <SearchReplacePanel
              activeChapterPath={activeChapter?.archivePath ?? null}
              onApply={applySession}
              onClose={() => {
                setSearchOpen(false)
                window.setTimeout(() => searchButtonRef.current?.focus(), 0)
              }}
              onNavigate={(path) => {
                selectChapter(path)
              }}
              session={readySession}
            />
          ) : null}
          {exportIssues.length > 0 ? (
            <IssuePanel issues={exportIssues} />
          ) : null}
          <IssuePanel issues={readyPublication.issues} />
        </aside>
      </div>
      <footer className="reader-footer">
        <span>
          本地处理 · 已修改 {readySession.dirtyEntries.size} 个 entry · 涉及{' '}
          {affectedChapterCount} 章 · {readySession.transactions.length}{' '}
          次编辑提交
        </span>
        <span className="history-actions">
          <button
            disabled={readySession.transactions.length === 0}
            onClick={runUndo}
            type="button"
          >
            Undo
          </button>
          <button
            disabled={readySession.redoTransactions.length === 0}
            onClick={runRedo}
            type="button"
          >
            Redo
          </button>
          <span>
            {readySession.transactions.at(-1)?.summary ?? '尚无修改'} ·{' '}
            {RELEASE_LABEL}
          </span>
        </span>
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

function flattenNavigation(
  items: readonly NavigationItem[],
): readonly NavigationItem[] {
  return items.flatMap((item) => [item, ...flattenNavigation(item.children)])
}
