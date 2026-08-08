# Ajia EPUB Editor 开发任务书

**文档状态：** 正式开发基线

**目标版本：** V0.1 / First Usable Release

**部署目标：** `https://ajia.site/tools/epub-editor/`

**代码仓库建议：** `AjiaijA/ajia-epub-editor`

**产品类型：** 纯浏览器端、Local-first、Preserve-first 的轻量级 EPUB 修订工具

**规范基线：** EPUB 2.0.1（兼容读取）与 W3C EPUB 3.3（主要标准）

**验证基线：** EPUBCheck 5.3.0 或开发时最新稳定版本
**文档版本：** 1.0（2026-08-08）

---

## 0. 给 Codex 的任务指令

把本文视为本项目的产品需求、技术约束、实施顺序和验收标准。除非用户明确修改范围，不得擅自扩大 V0.1。

执行优先级从高到低如下：

1. 不破坏用户原 EPUB；
2. 不执行、不上传、不泄露 EPUB 中的任何内容；
3. 导出文件合法并能被常见阅读器打开；
4. 文字修订、目录改名、查找替换足够可靠；
5. 代码边界清晰、可测试、便于后续扩展；
6. UI 清楚、安静、易学；
7. 高级功能和视觉装饰。

不要为了快速展示“所见即所得”而让浏览器、富文本编辑器或 XML serializer 重建整章 XHTML。遇到无法保证结构安全的章节，应降级为只读预览或源码模式，并向用户说明原因。

本项目不是网页版 Sigil，不是 EPUB 制作器，也不是 Word 式富文本编辑器。它首先是一把：

> 安全修改一本现有 EPUB 中少量文字的工具。

Codex 在每个里程碑中应遵循：先检查现状与测试夹具，再实施；修改后运行对应测试；记录已知限制；未经请求不部署生产环境、不覆盖原文件、不处理 DRM。

---

## 1. 产品定义

### 1.1 目标用户

- 网站作者本人；
- 编辑、译者和校对者；
- 少量需要快速修订 EPUB 的朋友。

### 1.2 典型场景

1. 打开一本本地 EPUB；
2. 找到含错字或待修订句子的章节；
3. 在安全可视模式中修改文字，或在必要时切换到源码模式；
4. 将全书某个名字或术语统一替换；
5. 修改目录中显示的章节名称；
6. 查看修改摘要并执行导出前检查；
7. 下载一个新 EPUB，原文件保持不变。

理想路径只有：

> 打开 EPUB → 找到章节 → 修改 → 检查 → 导出

用户不应被迫理解 ZIP、OPF、manifest、spine、NAV、NCX 或 XHTML。

### 1.3 成功标准

V0.1 成功不是“支持尽可能多的排版操作”，而是以下闭环稳定成立：

- 常见 EPUB 2/3 能打开并显示正确阅读顺序；
- 用户能安全修改单个文本片段；
- 查找替换不会误伤标签、属性、URL、CSS 或脚本；
- 目录文字可改，链接和章节顺序不变；
- 未修改资源的解压后字节保持一致；
- 导出的 EPUB 通过项目轻量检查，项目提供的合规测试书通过 EPUBCheck；
- Apple Books、Calibre 与至少一个基于浏览器内核的阅读器完成手工冒烟测试。

---

## 2. 核心原则

### 2.1 Local-first

V0.1 所有书籍处理均在浏览器本地完成：

- 不上传服务器；
- 不需要 PHP、Node 后端或数据库；
- 不需要账户和云存储；
- 不发送正文、文件名、书名、图片或统计信息；
- 不引入会把内容发送到第三方的分析、错误追踪或 AI 服务。

页面固定显示：

> 文件只在您的浏览器中处理，不会上传到服务器。

如果未来加入遥测，必须默认不包含书籍内容，并另行取得明确同意；不属于 V0.1。

### 2.2 Preserve-first

禁止采用“导入 → 规范化 → 套模板重建 EPUB”的架构。必须采用：

> 读取原 archive → 保存全部原始 entry → 只修改 dirty entry → 重新打包

未修改的 XHTML、OPF、NAV、NCX、CSS、图片、字体和其他资源，解压后的字节必须保持一致。重新打包导致的压缩流、时间戳、entry 顺序（`mimetype` 除外）或 ZIP metadata 差异可以接受，但必须在测试和文档中明确。

对于已修改的 XHTML，也只允许改动用户授权的文本 token 或源码内容；不得顺手格式化、统一换行、重排属性、改变 namespace prefix 或替换整个文件外壳。

### 2.3 Text-focused

V0.1 只聚焦：

- 修改字词和句子；
- 当前章节与全书查找；
- 当前匹配与全部替换；
- 修改目录显示文字；
- 查看源码并由高级用户主动修改。

### 2.4 EPUB-safe

功能便利必须服从 EPUB 安全。禁止：

- 对完整 XHTML 使用普通字符串 `replaceAll()`；
- 将 `contenteditable.innerHTML` 写回 EPUB；
- 用富文本编辑器 schema 重新生成原 HTML；
- 将解析后的整棵 DOM 经 `XMLSerializer` 写回，仅因用户改了几个字；
- 自动格式化 XML、统一 CSS、重命名章节或删除“未使用”资源；
- 重编码图片、字体或媒体；
- 自动修复用户的源码而不展示差异；
- 以任何方式绕过 DRM 或解密受保护内容。

### 2.5 Progressive enhancement

能可靠编辑的章节进入安全可视模式；结构复杂、无法稳定映射或解析失败的章节，仍可只读查看，并建议使用源码模式。功能覆盖率不能以破坏文件为代价。

---

## 3. V0.1 范围

### 3.1 P0 必须实现

1. 选择或拖入本地 EPUB；
2. 基础 ZIP 安全检查与容量限制；
3. 解析 `container.xml`、OPF、manifest、spine；
4. 解析 EPUB 3 NAV 与 EPUB 2 NCX；
5. 目录树和 spine fallback；
6. 沙箱化章节预览；
7. 安全文字编辑模式；
8. CodeMirror 6 XHTML 源码模式；
9. 当前章节和全书查找；
10. 替换当前与全部替换；
11. 修改目录显示名称，并在可匹配时同步 NAV/NCX；
12. 应用级 Undo/Redo；
13. dirty 状态、修改数量和修改摘要；
14. 导出前轻量检查；
15. 正确重新打包和下载 `原文件名-edited.epub`；
16. 错误、警告和兼容性降级提示；
17. 单元测试、集成测试、端到端测试与 EPUBCheck CI。

### 3.2 P1：V0.1 完成后再考虑

- 最近打开的文件与 IndexedDB 本地草稿；
- 修改前后差异浏览；
- 自动恢复崩溃前状态；
- 更完善的跨文本节点搜索；
- 正则表达式和大小写/全词匹配的高级选项；
- 元数据、封面、CSS 与图片的有限编辑。

### 3.3 明确不做

- 新建 EPUB；
- 新建、删除、合并、拆分或拖动章节；
- 修改 spine 顺序；
- 完整 metadata 编辑器；
- 图片编辑、压缩和封面替换；
- 字体或 CSS 编辑；
- 繁简转换、标点清洗、AI 校对或 AI 改写；
- 用户账号、云同步、多人协作；
- PWA 和完整移动端适配；
- DRM 解密；
- 固定版式 EPUB 的可视排版编辑；
- 媒体叠加、朗读音频或脚本内容编辑。

---

## 4. 支持边界与降级策略

### 4.1 目标支持

- 无 DRM 的 EPUB 2.0.1 和 EPUB 3.x；
- reflowable XHTML 内容；
- EPUB 3 NAV、EPUB 2 NCX，以及两者并存；
- 相对路径、片段标识符、多级目录、Unicode 文件名；
- CSS、图片、字体、SVG 等资源的只读保留。

### 4.2 可打开但可能降级

- fixed-layout：显示警告，原则上只允许源码模式；
- SVG-heavy、MathML、ruby、脚注、页面断点、复杂嵌套：可预览，只有文本映射通过结构检查时才开放安全编辑；
- malformed 但仍可定位 OPF 的书：显示问题清单，尽量只读打开；
- 同时存在 NAV 与 NCX 但条目无法一一匹配：只修改用户选中的权威导航，提示未同步项；
- 外部远程资源：不请求网络，以占位说明替代。

### 4.3 拒绝或只读

- ZIP 无法解析；
- 缺失 `META-INF/container.xml` 或无法定位 package document；
- 加密正文或 DRM 保护资源；
- 超出安全限额；
- 路径穿越、绝对路径、重复危险路径或其他 archive 异常；
- 源码存在 XML 错误且用户拒绝修正。

拒绝时不得崩溃，必须给出用户能理解的原因。

---

## 5. 推荐技术栈与仓库结构

### 5.1 技术栈

建议使用：

```text
Vite
React
TypeScript（strict）
CodeMirror 6
DOMParser（application/xml / application/xhtml+xml）
XML tokenizer / lossless text patch layer
JSZip（读取；导出须经规范测试验证）
Vitest
React Testing Library
Playwright
ESLint + Prettier
GitHub Actions
EPUBCheck 5.3.0 或最新稳定版
```

不要盲目锁死 ZIP 实现。先用自动测试确认所选 writer 能保证：`mimetype` 是第一个 local file entry、内容严格正确、使用 STORE。若 JSZip 无法稳定满足二进制验收，保留其读取能力并改用 `zip.js`、`fflate` 或小型专用 writer。规范要求高于库选择。

不得因参考 EPubBuilder 而引入 jQuery、Backbone、RequireJS、UMEditor、UEditor、Handlebars、Express、Qiniu 或旧版 JSZip API。

### 5.2 建议目录

```text
src/
  app/
  components/
  epub/
    archive/
    parser/
    navigation/
    text/
    preview/
    search/
    history/
    validator/
    exporter/
  models/
  workers/
  utils/
  styles/

tests/
  fixtures/
    epub2/
    epub3/
    edge-cases/
    invalid/
  unit/
  integration/
  e2e/

docs/
  architecture.md
  security.md
  compatibility.md
  references/EPubBuilder.md

.github/workflows/ci.yml
AGENTS.md
README.md
DEPLOY.md
```

EPUB 核心不得写进 React component。解析、文本补丁、查找、事务、验证和导出应能在无 UI 环境中测试。

---

## 6. 内部数据模型

至少建立以下概念边界：

```ts
interface EpubPublication {
  fileName: string
  epubVersion: '2' | '3' | 'unknown'
  archive: EpubArchive
  packagePath: string
  packageDocument: PackageDocument
  manifest: Map<string, ManifestItem>
  spine: SpineItem[]
  navigation: NavigationModel | null
  chapters: ChapterDocument[]
  dirtyEntries: Set<string>
  issues: EpubIssue[]
}

interface EpubArchiveEntry {
  path: string
  originalData: Uint8Array
  modifiedData?: Uint8Array
  dirty: boolean
  mediaType?: string
}

interface ChapterDocument {
  idref: string
  href: string
  archivePath: string
  originalBytes: Uint8Array
  sourceEncoding: 'utf-8' | 'utf-8-bom' | 'unknown'
  originalSource: string
  currentSource: string
  textSegments: TextSegment[]
  title: string
  dirty: boolean
  visualEditCapability: 'safe' | 'readonly' | 'source-only'
}

interface TextSegment {
  id: string
  chapterPath: string
  sourceStart: number
  sourceEnd: number
  rawSource: string
  decodedText: string
  currentText: string
  nodePath?: number[]
}

interface NavigationItem {
  id: string
  label: string
  href: string
  normalizedTarget: string
  children: NavigationItem[]
  sources: NavigationSourceRef[]
}

interface EditTransaction {
  id: string
  type: 'text-edit' | 'replace' | 'replace-all' | 'toc-label' | 'source-edit'
  timestamp: number
  changes: EditChange[]
  summary: string
}
```

UI 只面对统一模型，不直接依赖 NCX 或 NAV 的节点形态。

---

## 7. 打开与解析流程

### 7.1 文件读取

- `<input type="file" accept=".epub,application/epub+zip">`；
- 支持拖放；
- 读取为 `ArrayBuffer`；
- 保留原文件对象只用于本次会话，不上传。

### 7.2 Archive 预检

在完整解压前尽可能检查 central directory。默认限额集中在一个可配置模块中，并在 README 说明：

- 原始文件大小：100 MiB；
- entry 数量：10,000；
- 声明的总解压大小：512 MiB；
- 单 entry 解压大小：128 MiB；
- 可疑压缩比：大于 200:1 时拒绝或强警告；
- 规范化后不得出现 `..`、绝对路径、盘符路径、NUL 或重复冲突路径。

这些值是 V0.1 的浏览器安全默认值，可根据真实样本调整，但不得无上限。

### 7.3 `mimetype`

打开时检查根目录 `mimetype` 内容是否严格为 `application/epub+zip`。异常记为 warning 并尽量继续解析。导出时必须修正打包规则，但不能无提示篡改其他内容。

### 7.4 `container.xml`

读取 `META-INF/container.xml`，通过 `rootfile full-path` 定位 package document。不能假设 OPF 文件名或目录固定。若有多个 rootfile，优先选择可识别 EPUB media type 的第一个，并记录提示。

### 7.5 OPF

以 XML 方式解析并处理 BOM。不要依赖固定 prefix，优先根据 `localName` 与 `namespaceURI` 识别。解析：

- package version 与 unique-identifier；
- metadata；
- manifest id、href、media-type、properties；
- spine idref、linear、toc；
- rendition/fixed-layout 相关属性；
- 加密和受保护资源线索。

所有 href 以 OPF 所在目录为基准规范化；保留原始字符串用于写回。

### 7.6 章节

按 spine 顺序建立章节。manifest 缺项、文件缺失或 media type 异常时记录 issue，不因单个资源让整个应用崩溃。非线性章节可显示但应标记。

---

## 8. 导航模型

### 8.1 EPUB 3 NAV

寻找 manifest 中 `properties` 包含 `nav` 的 XHTML，识别 `nav` 的 `epub:type="toc"`，递归解析 `ol/li/a`。保留 href、fragment、层级和来源节点引用。

### 8.2 EPUB 2 NCX

通过 `spine toc` 定位 NCX，递归解析 `navMap/navPoint/navLabel/text/content@src`。

### 8.3 两者并存

阅读目录优先使用 NAV。目录改名时以 `normalized path + fragment` 匹配 NAV 与 NCX，不以数组下标匹配。歧义或重复目标必须提示，不能猜测后静默修改。

### 8.4 无标准目录

以 spine 顺序 fallback，并显示文件名或从章节首个可用标题推断的只读标签，同时提示：

> 本书没有可识别的标准目录，当前按阅读顺序显示。

---

## 9. 安全文字编辑核心

### 9.1 权威数据

预览 DOM 永远不是 authoritative source。禁止把 iframe 或 `contenteditable` 的 `innerHTML` 写回。

安全编辑必须建立在“保留原源码的 token/offset 补丁层”上：

1. 对 XHTML 源码做 XML-aware tokenization；
2. 只将 body 内可编辑文本 token 映射为 `TextSegment`；
3. 预览层只编辑 `currentText`；
4. 提交时重新验证 segment 身份、边界和章节版本；
5. 对该文本 token 做必要的 XML 转义并生成最小 source patch；
6. 结构 token、标签、属性、注释、处理指令及其他文本 token 保持原样；
7. 补丁后以 XML parser 验证完整章节；
8. 若结构指纹改变，拒绝提交并回滚 transaction。

允许一个被编辑的文本 token 内实体表示或转义方式发生必要变化；该 token 之外的源码不得变化。

### 9.2 结构指纹

安全编辑前后计算不含文本值的结构指纹，至少覆盖：

- 元素层级和 namespace URI/localName；
- 属性名与属性值；
- id、class、href、src；
- 注释、处理指令和 CDATA 的存在位置；
- 非目标文本 token 数量和位置。

结构指纹不一致时，不得保存为安全编辑；提示切换源码模式。

### 9.3 允许和禁止的操作

允许：输入、删除、修改文字，粘贴纯文本，以及在同一 text segment 内换字改句。

禁止：创建/删除标签、富文本粘贴、拖动图片、改变链接、插入对象、通过 Enter 创建段落、跨 segment 合并内容。拦截 `beforeinput`、paste、drop 和 composition 事件；中文输入法必须有专项测试。

### 9.4 复杂章节降级

下列情况可降级为源码模式：tokenizer 与 XML parser 结果不一致、DTD/entity 无法可靠映射、非法嵌套、脚本驱动内容、复杂 SVG/MathML 映射不稳定、源码被外部操作改变导致 offset 失效。

---

## 10. 预览与安全

EPUB 是不可信输入。预览必须：

- 使用隔离 iframe 或等价隔离容器；
- iframe 不含 `allow-scripts`；
- 若因父页面访问需要使用 `sandbox="allow-same-origin"`，必须同时注入严格 CSP；
- CSP 默认 `default-src 'none'`，只允许明确生成的 `blob:`/`data:` 图片与必要内联样式；
- 删除或禁用 script、iframe、object、embed、form、meta refresh、事件处理属性；
- 不加载 HTTP/HTTPS 远程资源；
- 将书内相对 CSS、图片和字体解析为受控 Blob URL，并在关闭书籍时 revoke；
- 禁止 top navigation、弹窗、下载和表单提交；
- 外部链接只显示为不可自动访问的链接，用户主动点击时给出确认。

不要记录章节正文到 console、错误监控或 URL。

---

## 11. 源码模式

- 使用 CodeMirror 6 编辑当前 XHTML 完整源码；
- 进入源码模式前提交或取消安全编辑中的未完成 composition；
- 离开源码模式或切换章节前，用 `DOMParser(application/xhtml+xml)` 检查 `parsererror`；
- 错误时保留编辑内容和光标，显示明确错误，不偷偷修复；
- 源码模式修改视为一个或多个独立 transaction；
- 源码修改成功后必须重新 tokenize、重建 text segment、刷新预览并使旧 segment ID 失效；
- 提供“恢复为本章打开时内容”，但必须经确认且可 Undo。

源码模式是用户主动承担结构修改的高级入口；导出前仍需验证 XML 合法性。

---

## 12. 查找与替换

### 12.1 查找

提供当前章节和全书范围，显示总数、每章数量、上下文、上一处/下一处与当前高亮。默认按 Unicode 代码点精确匹配，不自动做 Unicode normalization，不搜索属性、CSS、script、style、head 或不可见结构文本。

V0.1 允许搜索词跨两个不同 text segment 时不匹配，例如 `爱<em>丽</em>丝`。UI 帮助和测试必须明确这一限制。

### 12.2 替换

替换只作用于已索引的正文 `TextSegment`。不得对完整 source 做字符串替换。替换文本必须经过 XML 文本转义，替换前后执行结构指纹检查。

提供：

- 替换当前；
- 全部替换；
- 替换前匹配数与受影响章节数；
- 空查找词禁用；
- “全部替换”为一个原子 transaction。

如果某章在建立结果后被修改，旧搜索结果必须失效或重新计算，不能使用过期 offset。

---

## 13. 目录名称编辑

V0.1 只允许修改目录显示文字，不得改变 href、fragment、spine 或章节顺序。

- EPUB 3：修改 NAV 对应 label 文本；
- EPUB 2：修改 NCX `navLabel/text`；
- 两者并存：按规范化目标同步；
- 多个目录项指向同一目标时，用户修改的是选定条目，不默认改全部；
- 无法可靠同步时列出 warning；
- 修改必须进入 Undo/Redo 历史。

目录文件同样使用最小文本 token patch；不要 serialize 整份 NAV/NCX。

---

## 14. Undo、Redo 与修改摘要

应用级历史至少覆盖：单次文字修改、替换当前、全部替换、目录改名、源码提交。

一次 Replace All 无论跨多少章节，Undo 一次应全部恢复。transaction 应先完整验证再统一提交；任一 change 失败则全部回滚。

UI 显示：

- 当前 dirty entry 数；
- 修改 transaction 数；
- 涉及章节数；
- 最近操作摘要；
- Undo/Redo 是否可用。

打开新书、关闭书籍或清空历史前需要处理未导出修改提示。

---

## 15. 导出与 archive preservation

### 15.1 导出流程

```text
冻结当前编辑状态
→ 验证所有 dirty XHTML/NAV/NCX
→ 运行轻量结构检查
→ 建立新 ZIP
→ 第一个写入 mimetype（STORE）
→ dirty entry 写 modifiedData
→ clean entry 写 originalData
→ 二进制检查 ZIP 头与 entry
→ 生成 Blob 并下载
```

导出不会覆盖原文件，文件名为 `原文件名-edited.epub`；若原名已含 `.epub`，只替换最后一个扩展名。

### 15.2 `mimetype` 硬性要求

- 根目录文件名严格为 `mimetype`；
- ZIP 第一个 local file entry；
- 内容严格为 `application/epub+zip`；
- 无 BOM、无换行；
- compression method 为 STORE；
- 不附加额外字段导致实现不兼容。

必须用二进制级测试检查 local file header，不能只依赖 ZIP 库 API 返回值。

### 15.3 未修改资源

对所有 clean entry 计算并比较 SHA-256（或测试环境等价哈希），确认解压后字节与原文件一致。图片、字体、CSS、媒体和不相关 XML 必须纳入。

---

## 16. 导出前轻量检查

浏览器内检查不是 EPUBCheck 的替代品。至少检查：

- `mimetype` 规则；
- `container.xml` 可解析，rootfile 存在；
- OPF 可解析；
- manifest id 唯一且引用资源存在；
- spine idref 指向 manifest；
- dirty XHTML/NAV/NCX 为合法 XML；
- NAV/NCX 基础结构可解析；
- 章节中的本地 `href/src` 解析后资源存在；
- 路径无穿越；
- 加密资源未被修改；
- dirty entry 都来自明确 transaction。

结果分为 Error、Warning、Info。Error 默认阻止导出；若提供“仍然导出”，只能针对文档化的非致命规则，XML 破损、mimetype 错误和 archive 安全错误不得绕过。

---

## 17. UI 与交互

桌面优先布局：

```text
┌──────────────────────────────────────────────────────────┐
│ Ajia EPUB Editor     查找替换   检查   导出 EPUB        │
├────────────────┬─────────────────────────────────────────┤
│ 书名 / 状态     │ 当前章节                                │
│ 目录树          │ 可视安全编辑 / XHTML 源码              │
│ ├ 前言          │                                         │
│ ├ 第一章        │ 编辑或预览区域                          │
│ │ ├ 1.1        │                                         │
│ │ └ 1.2        │                                         │
│ └ 后记          │                                         │
├────────────────┴─────────────────────────────────────────┤
│ 本地处理 · 已修改 3 项 · Undo · Redo                    │
└──────────────────────────────────────────────────────────┘
```

首次打开页应包含拖放区、选择文件按钮、隐私说明和支持范围。错误提示用普通语言，同时提供可展开的技术详情。长任务显示进度和取消入口；导出期间防止重复点击。

无障碍要求：键盘可达、清晰 focus、目录树使用合适 ARIA、状态不只依赖颜色、表单有 label、弹窗管理焦点、支持系统缩放。V0.1 桌面优先，但窄屏至少不丢失文件和修改。

---

## 18. 性能与 Worker

ZIP 解压、全书索引、哈希和导出优先放入 Web Worker，避免冻结 UI。大书处理应分阶段报告进度，并能取消。

性能不是以牺牲安全检查为代价。建立基准夹具：5 MiB/50 章、30 MiB/300 章、接近上限的图片型 EPUB。记录打开、索引、全书替换和导出时间；不规定脱离硬件的绝对秒数，但 UI 主线程不得出现持续不可交互状态。

---

## 19. 测试策略

### 19.1 测试金字塔

- 单元：路径、namespace、tokenizer、转义、结构指纹、搜索、transaction、ZIP header；
- 集成：打开 → 修改 → 验证 → 导出 → 重新打开；
- 端到端：用户选择书、改字、替换、改目录、Undo、导出；
- 外部验证：EPUBCheck；
- 手工冒烟：Apple Books、Calibre、Thorium 或同类阅读器。

### 19.2 必备 fixture 矩阵

自建最小、可再分发的 fixture，至少覆盖：

1. EPUB 2 + NCX；
2. EPUB 3 + NAV；
3. EPUB 3 同时含 NAV/NCX；
4. 二级以上目录；
5. OPF/XML 带 UTF-8 BOM；
6. OPF 不在常见目录；
7. 相对路径含 `..` 的合法规范化；
8. 文件名含空格、中文、百分号编码；
9. 缺失 manifest 资源；
10. 缺失封面 meta；
11. `br`/`img` 等 XML 自闭合；
12. ruby、SVG、MathML、pagebreak；
13. 同一目标多个目录项；
14. 搜索词出现在 class、href、src 和正文中；
15. 搜索词跨 text node；
16. XML 特殊字符 `& < >`；
17. 中文输入法 composition；
18. fixed-layout；
19. `encryption.xml` 与字体混淆；
20. 远程图片/CSS；
21. ZIP bomb 元数据、路径穿越和重复路径；
22. 非法 XHTML；
23. 大型但合规 EPUB。

### 19.3 关键断言

#### No-op round trip

打开后不修改直接导出：所有 entry 路径相同；所有解压后内容相同；OPF、NAV、NCX、XHTML、CSS、图片、字体哈希相同；导出书可重新打开；`mimetype` 合规。ZIP 压缩流和 metadata 可以不同。

#### 单字修改

只允许目标 XHTML 的目标文本 token 变化；其余 token 与所有其他 entry 字节不变；结构指纹相同；导出后重新解析能看到新文字。

#### Replace All

只修改正文 text segment，不改变属性；匹配数正确；一次 Undo 全部恢复；失败时无部分提交。

#### 目录改名

只改 label，href/fragment/spine 不变；NAV/NCX 能可靠匹配时同步；无法匹配时产生 warning。

#### 安全

脚本不执行；远程请求为零；路径穿越被拒绝；超过限额被拒绝；加密内容不被编辑；敏感正文不写入日志。

---

## 20. CI 与质量门

每个 pull request 必须运行：

```text
typecheck
lint
unit tests
integration tests
Playwright smoke tests
build
fixture export
EPUBCheck on exported compliant fixtures
dependency audit（报告级，不自动大版本升级）
```

主分支保护建议：CI 通过后合并；开发使用短分支和 draft PR；依赖由 lockfile 固定；自动更新依赖的 PR 必须运行完整测试。

测试失败不得通过删测试、放宽关键断言或把错误降为 warning 来掩盖。若规范与库行为冲突，修改实现或替换库。

---

## 21. 分阶段实施计划

### 阶段 0：技术探针（必须先做）

交付两个可独立运行的 spike：

1. ZIP round-trip：证明 `mimetype` 首位+STORE、clean entry 解压字节不变；
2. Safe text patch：证明修改含实体和嵌套 inline 标签的一个 text token 时，结构与其他源码完全不变。

若任一探针失败，先调整架构，不进入 UI 大开发。

### 阶段 1：解析与只读浏览

实现安全预检、container/OPF/spine、NAV/NCX、目录 UI、沙箱预览、issue 面板。验收：fixture 矩阵中的基础 EPUB 可浏览，恶意输入被拦截。

### 阶段 2：源码编辑与可靠导出

实现 CodeMirror、XML 验证、dirty entry、轻量检查、ZIP 导出和 EPUBCheck CI。验收：源码改字后导出闭环成立，no-op 断言通过。

### 阶段 3：安全可视编辑

实现 tokenizer/segment、最小 source patch、结构指纹、输入法和粘贴控制。验收：单字、句子、特殊字符和复杂 inline fixture 全部通过。

### 阶段 4：查找替换、事务和目录改名

实现索引、结果 UI、Replace All 原子事务、Undo/Redo、NAV/NCX 同步。验收：关键断言全部通过。

### 阶段 5：完成首个可用版本

完善错误文案、进度、无障碍、兼容性说明、README/DEPLOY；完成三类阅读器手工冒烟；生成 release candidate。

每阶段结束均提交一份简短报告：完成项、测试证据、遗留问题、下一阶段风险。不得在阶段 0 未通过时用漂亮 UI 掩盖核心不确定性。

---

## 22. Definition of Done

V0.1 只有同时满足以下条件才算完成：

- P0 功能全部可操作；
- 阶段 0 两项技术探针通过并保留为回归测试；
- 所有自动测试和构建通过；
- 合规 fixture 导出后通过 EPUBCheck；
- no-op、单字修改、Replace All、目录改名、安全测试通过；
- Apple Books、Calibre、第三种阅读器冒烟通过；
- 没有会上传或外泄书籍内容的请求；
- README 写明隐私、支持范围、已知限制和本地开发命令；
- `docs/architecture.md` 解释权威数据与最小补丁设计；
- `docs/security.md` 解释 iframe/CSP、ZIP 安全与 DRM 边界；
- `docs/compatibility.md` 记录测试样本和阅读器结果；
- `DEPLOY.md` 给出 `ajia.site` 静态部署及回滚步骤；
- 原始 EPUB 永不被覆盖；
- 无未解释的 P0 blocker 或高危安全问题。

---

## 23. 参考 EPubBuilder 的边界

参考项目：`https://github.com/sqqihao/EPubBuilder`

应吸收并转为测试的经验：

- `container.xml → OPF → spine` 解析路线；
- BOM；
- manifest 资源缺失；
- 封面 metadata 缺失；
- XHTML/XML 合法性与自闭合；
- `mimetype` STORE；
- 相对路径与多级 NCX；
- XML 特殊字符；
- IndexedDB 最近文件思路（V0.2）。

不得 fork 作为本项目基础，不沿用其 RequireJS/jQuery/Backbone/UMEditor/Express/Qiniu 架构，也不得沿用其“抽取正文后用固定模板重建 EPUB”的导出模式。

如复制 MIT 许可代码片段，必须保留许可证和版权信息；优先理解思路后以 TypeScript 重写，并在 `docs/references/EPubBuilder.md` 记录来源与采用/不采用理由。

---

## 24. 仓库与部署建议

推荐开发方式：

```text
本地文件夹（Codex 工作区）
  ↕ git
GitHub 私有仓库 AjiaijA/ajia-epub-editor
  → GitHub Actions
  → 预览构建
  → 人工确认
  → ajia.site 静态目录
```

初期建议设为 private；确认不包含受版权保护的测试书、密钥、网站凭据或个人书稿后再决定是否公开。fixture 必须自建、使用公版/明确许可内容，或仅在本地私有测试目录中使用并由 `.gitignore` 排除。

不要把 GitHub 当作“在线运行的开发目录”。以本地 Git checkout 为权威工作副本，频繁 commit，按里程碑 push；GitHub 用于备份、版本历史、PR 审查、CI 和协作。生产部署与 main 分支合并分开，必须有人工确认和回滚版本。

建议首批仓库文件：

```text
README.md
LICENSE（公开前决定）
AGENTS.md
.gitignore
.editorconfig
.github/workflows/ci.yml
docs/product-requirements.md（本文副本）
docs/architecture.md
docs/security.md
docs/compatibility.md
```

`AGENTS.md` 应摘录本文中的：范围、非目标、禁止事项、分阶段顺序、验证命令和 Definition of Done。不要把整篇任务书重复塞进每次提示。

---

## 25. 给下一轮 Codex 的开工提示

可将以下内容与本文一起交给 Codex：

> 请在一个新的本地 Git 仓库中实施《Ajia EPUB Editor 开发任务书》。先只执行阶段 0：检查工作区与工具链，建立最小项目骨架、测试夹具和两个技术探针。不要提前开发完整 UI。完成后运行测试并提交阶段报告，说明 ZIP writer 是否满足 `mimetype` 二进制要求、安全文字补丁是否能保持结构与非目标源码不变、仍有哪些阻塞风险。未经我明确同意，不部署到 ajia.site，不创建公开仓库，不加入遥测、后端或 AI 功能。

阶段 0 获得确认后，再按阶段 1 至阶段 5 顺序继续。

---

## 26. 规范与资料

- W3C EPUB 3.3：`https://www.w3.org/TR/epub-33/`
- EPUBCheck：`https://github.com/w3c/epubcheck`
- JSZip：`https://stuk.github.io/jszip/`
- CodeMirror 6：`https://codemirror.net/`
- EPubBuilder（经验参考）：`https://github.com/sqqihao/EPubBuilder`
- OpenAI Codex 文档：`https://developers.openai.com/codex/`

若开发时规范、依赖或 EPUBCheck 版本更新，以官方最新稳定文档为准，并在 pull request 中记录改变，不得静默漂移。
