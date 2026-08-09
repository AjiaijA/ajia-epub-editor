import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { EpubIssue } from './models/publication.js'

export type Locale = 'en' | 'zh'

interface I18nValue {
  readonly locale: Locale
  readonly setLocale: (locale: Locale) => void
  readonly text: (english: string, chinese: string) => string
}

const STORAGE_KEY = 'ajia-epub-editor-locale'
const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => readSavedLocale())

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
    document.title = locale === 'zh' ? 'Ajia EPUB 编辑器' : 'Ajia EPUB Editor'
    try {
      window.localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // Language selection remains usable when storage is unavailable.
    }
  }, [locale])

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      text: (english, chinese) => (locale === 'zh' ? chinese : english),
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (value === null) throw new Error('useI18n requires I18nProvider')
  return value
}

const CHINESE_ISSUE_MESSAGES: Readonly<Record<string, string>> = {
  'archive.encrypted-entry': 'ZIP 包含加密条目，当前不支持。',
  'archive.central-directory-size-mismatch': 'ZIP 中央目录声明大小不一致。',
  'archive.duplicate-local-offset': '多个 ZIP 条目指向同一个本地文件头。',
  'archive.duplicate-path': 'ZIP 包含规范化后重复的路径。',
  'archive.entry-too-large': '单个 ZIP 条目超过安全上限。',
  'archive.extraction-failed': 'ZIP 通过预检但无法解压。',
  'archive.file-too-large': 'EPUB 文件超过 100 MiB 安全上限。',
  'archive.invalid-central-directory': 'ZIP 中央目录范围无效。',
  'archive.invalid-central-entry': 'ZIP 中央目录项损坏或越界。',
  'archive.header-mismatch': 'ZIP 本地文件头与中央目录不一致。',
  'archive.header-name-mismatch': 'ZIP 本地文件头与中央目录文件名不一致。',
  'archive.invalid-filename-encoding': 'ZIP 文件名不是有效 UTF-8。',
  'archive.invalid-local-filename': 'ZIP 本地文件头中的文件名不是有效 UTF-8。',
  'archive.invalid-local-header': 'ZIP 本地文件头无效。',
  'archive.invalid-mimetype': '根目录 mimetype 缺失或内容不正确。',
  'archive.multi-disk': '不支持分卷 ZIP。',
  'archive.missing-central-directory': '找不到 ZIP 中央目录。',
  'archive.nonconforming-mimetype-header':
    'mimetype 不是第一个未压缩条目，本书将保持只读。',
  'archive.overlapping-entry': 'ZIP 条目范围重叠或越界。',
  'archive.size-mismatch': 'ZIP 条目解压大小与目录声明不一致。',
  'archive.suspicious-compression-ratio': 'ZIP 条目压缩比异常。',
  'archive.total-too-large': 'ZIP 声明的总解压大小超过安全上限。',
  'archive.too-many-entries': 'ZIP 条目数量超过安全上限。',
  'archive.truncated': '文件不完整，不是有效 ZIP。',
  'archive.unsafe-path': 'ZIP 包含不安全路径。',
  'archive.unsupported-compression': 'ZIP 使用了不支持的压缩方式。',
  'archive.zip64-unsupported': '当前不支持 ZIP64 EPUB。',
  'chapter.encrypted': '该章节受到保护，不能预览或修改。',
  'chapter.invalid-encoding': '该章节不是有效 UTF-8，无法预览。',
  'chapter.invalid-xhtml': '该章节不是合法 XML，已降级且不生成预览。',
  'chapter.unexpected-media-type': '该 spine 条目不是 XHTML，已跳过预览。',
  'chapter.visual-edit-readonly': '该章节包含复杂内容，只允许源码编辑。',
  'container.multiple-rootfiles':
    'container.xml 包含多个 rootfile，已选择第一个 EPUB package。',
  'encryption.invalid': 'encryption.xml 无法安全解析。',
  'encryption.present': '本书包含受保护内容；不会尝试解密或修改。',
  'encryption.unsafe-reference': 'encryption.xml 包含不安全的资源路径。',
  'export.download-created': '已生成新 EPUB，原文件未被覆盖。',
  'export.failed': '导出失败，没有生成下载文件。',
  'export.dirty-without-transaction': '修改条目没有对应的编辑记录。',
  'export.encrypted-dirty-entry': '受保护章节不能作为修改条目导出。',
  'export.invalid-dirty-xhtml': '修改后的 XHTML 不是合法 XML。',
  'export.invalid-dirty-xml': '修改后的 NAV 或 NCX 不是合法 XML。',
  'export.missing-container': '缺少 META-INF/container.xml。',
  'export.missing-linked-resource': '章节引用的本地资源不存在。',
  'export.missing-manifest-resource': 'manifest 声明的资源不存在。',
  'export.missing-modified-bytes': '修改条目没有经过验证的字节内容。',
  'export.missing-package': 'package document 不存在。',
  'export.ready': '轻量检查通过，可以导出新的 EPUB。',
  'export.unknown-dirty-entry': '修改条目不属于原始 EPUB。',
  'export.unsafe-linked-resource': '章节包含不安全的本地引用。',
  'manifest.duplicate-id': 'manifest 中存在重复 id。',
  'manifest.incomplete-item': 'manifest item 缺少必要属性。',
  'manifest.missing-resource': 'manifest 声明的资源不存在。',
  'manifest.unsafe-href': 'manifest item 包含不安全路径。',
  'navigation.external-target': '目录项指向外部资源，已禁用。',
  'navigation.sources-differ':
    'NAV 与 NCX 目标不完全一致，阅读目录优先采用 NAV。',
  'navigation.spine-fallback': '未发现标准目录，当前按阅读顺序显示。',
  'open.unexpected': '无法打开这个 EPUB。',
  'package.fixed-layout': '本书声明为固定版式，仅提供降级只读浏览。',
  'package.unknown-version': '无法识别 EPUB 版本。',
  'spine.missing-manifest-item': 'spine 条目没有对应的 manifest item。',
  'toc.label-not-unique': '无法唯一定位该目录文字，未修改此目录来源。',
  'toc.sync-ambiguous': 'NAV 与 NCX 无法可靠同步，只修改了选定目录来源。',
}

export function localizeIssueMessage(issue: EpubIssue, locale: Locale): string {
  if (locale === 'en') return issue.message
  return CHINESE_ISSUE_MESSAGES[issue.code] ?? issue.message
}

function readSavedLocale(): Locale {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'zh' ? 'zh' : 'en'
  } catch {
    return 'en'
  }
}
