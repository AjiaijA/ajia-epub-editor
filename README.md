# Ajia EPUB Editor

Ajia EPUB Editor 是一个纯浏览器端、Local-first、Preserve-first 的轻量级 EPUB 修订工具。

它面向少量文字修订、目录文字调整和跨章节查找替换，不以创建或重新排版 EPUB 为目标。用户书籍默认只在浏览器本地处理，不上传服务器。

## 当前状态

阶段 0 技术探针与阶段 1 只读浏览已经通过。项目现已完成 V0.1 阶段 2：源码编辑与可靠导出。

当前可以：

1. 从本地选择或拖入无 DRM 的 EPUB；
2. 在解压前检查 ZIP central directory、路径、容量、压缩比与 header 一致性；
3. 读取 `container.xml`、OPF、manifest、spine、EPUB 3 NAV 与 EPUB 2 NCX；
4. 以统一目录树浏览章节，并在无标准目录时使用 spine fallback；
5. 在无脚本权限、带严格 CSP 的 iframe 中显示净化后的只读章节；
6. 在 CodeMirror XML 模式中编辑 XHTML 源码，并在应用前进行原子 XML 验证；
7. 查看 dirty entry、事务、安全、结构与兼容性问题；
8. 生成新的 `-edited.epub`，并在下载前检查 mimetype、payload 字节与重新打开结果。

打开、解析和导出在浏览器 Worker 中运行。当前不提供安全可视编辑、查找替换、目录编辑或应用 Undo/Redo；这些功能必须按后续阶段逐步实现。

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
npm run fixture:export
npm audit
```

CI 使用固定版本和 SHA-256 的 EPUBCheck 5.3.0 校验自建导出 fixture。

未经确认，不部署到 `ajia.site`，不加入后端、遥测、账户或 AI 功能。
