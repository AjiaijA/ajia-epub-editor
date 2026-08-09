# Ajia EPUB Editor

Ajia EPUB Editor 是一个纯浏览器端、Local-first、Preserve-first 的轻量级 EPUB 修订工具。

它面向少量文字修订、目录文字调整和跨章节查找替换，不以创建或重新排版 EPUB 为目标。用户书籍默认只在浏览器本地处理，不上传服务器。

## 当前状态

阶段 0 至阶段 5 的代码与自动化门禁已经完成。当前候选版本为 **V0.1 RC3**（`0.1.0-rc.3`），用于在线测试和真实 EPUB 兼容性确认，尚未正式公开发布。RC2 增加了对无内部子集的标准 XHTML `DOCTYPE` 的安全兼容；RC3 允许安全删除完整的独立文字 token，并在修改被拒绝时立即恢复原文、解除界面阻塞。

当前可以：

1. 从本地选择或拖入无 DRM 的 EPUB；
2. 在解压前检查 ZIP central directory、路径、容量、压缩比与 header 一致性；
3. 读取 `container.xml`、OPF、manifest、spine、EPUB 3 NAV 与 EPUB 2 NCX；
4. 以统一目录树浏览章节，并在无标准目录时使用 spine fallback；
5. 在无脚本权限、带严格 CSP 的 iframe 中显示净化后的只读章节；
6. 在 CodeMirror XML 模式中编辑 XHTML 源码，并在应用前进行原子 XML 验证；
7. 查看 dirty entry、事务、安全、结构与兼容性问题；
8. 生成新的 `-edited.epub`，并在下载前检查 mimetype、payload 字节与重新打开结果。
9. 在隔离阅读视图中直接修改虚线标出的正文文字，所有修改仍通过最小源码补丁写入。
10. 在当前章节或全书正文中查找，逐项替换或用一笔原子事务全部替换；
11. 对源码、可视文字、替换和目录改名执行 Undo/Redo；
12. 只改 NAV/NCX 目录标签文字，并在唯一目标匹配时同步两种目录。

打开、解析、全书搜索和导出均在浏览器 Worker 中运行，并显示可访问的任务状态；打开和搜索支持取消。应用没有后端、账户、遥测或 AI，也不会主动发送书籍内容。

完整需求见 [docs/product-requirements.md](docs/product-requirements.md)。

## 开发原则

- Local-first
- Preserve-first
- Text-focused
- EPUB-safe
- 原 EPUB 永不被覆盖
- 不上传书籍内容
- 不处理或绕过 DRM

## 阶段 0 保留的回归边界

两个技术探针已经实现为永久回归测试：

- `fflate` 导出结果的首个 ZIP local file entry 是 byte-exact 的 `mimetype`，使用 STORE 且没有 local extra field；
- clean entry 重新打包再解压后的 payload 字节不变；
- XML-aware 文本补丁只替换选定的 XHTML 文本 token，结构指纹与目标以外的源码保持不变；
- 特殊字符 `& < >` 会按 XML 文本规则转义，inline 标签保持原样。

阶段 0 的 ZIP 与最小文本补丁断言继续作为永久回归测试运行。

## 阶段 1 安全限额

- 原始文件：100 MiB；
- entry 数量：10,000；
- 声明总解压大小：512 MiB；
- 单 entry 声明解压大小：128 MiB；
- 最大压缩比：200:1；
- 拒绝路径穿越、绝对/盘符/反斜杠路径、NUL、规范化后重复路径、ZIP 加密 entry、分卷 ZIP、ZIP64 和不支持的压缩方式。

当前 ZIP64 与传统非 UTF-8 ZIP 文件名会拒绝打开。完整兼容性边界见 [docs/compatibility.md](docs/compatibility.md)。

## 本地检查

```text
npm install
npm run spike:zip
npm run spike:text
npm run check
npm run test:coverage
npm run test:e2e
npm run build
npm run release:package
npm audit
```

`npm run test:e2e` 使用自建 EPUB 在 Chromium 中完成打开、目录改名、Undo/Redo、全书替换、导出、重新解析和窄屏检查。CI 使用固定版本和 SHA-256 的 EPUBCheck 5.3.0 校验自建导出 fixture。

## 测试候选版本

运行 `npm run build && npm run release:package` 后，会在 `artifacts/` 生成：

- `ajia-epub-editor-v0.1.0-rc.3.zip`：可放入任意静态网站目录的版本包；
- 同名 `.sha256`：包体完整性校验；
- `epub2-reader-smoke.epub`：自建、可再分发的阅读器冒烟样本。
- `epub2-reader-smoke-edited.epub`：带固定目录与正文修订的结果样本。

在线测试版位于 [https://ajia.site/tools/epub-editor/](https://ajia.site/tools/epub-editor/)，当前没有从网站工具页挂出入口，但知道网址即可访问。在仓库中运行 `npm run preview` 仍可本地预览刚构建的 `dist/`。部署和回滚步骤见 [DEPLOY.md](DEPLOY.md)，兼容性实测状态见 [docs/compatibility.md](docs/compatibility.md)。Calibre 9.11 与 Thorium 3.4.0 已通过实测；Apple Books 是从 RC 升为正式 V0.1 前剩余的人工阅读器门禁。

当前 `ajia.site` 测试部署已经用户授权。未经后续确认，不创建公开 release，也不加入后端、遥测、账户或 AI 功能。
