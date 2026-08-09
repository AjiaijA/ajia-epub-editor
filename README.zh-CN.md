# Ajia EPUB Editor

Ajia EPUB Editor 是一个纯浏览器端、Local-first、Preserve-first 的轻量级
EPUB 文字修订工具。

**[打开在线版本](https://ajia.site/tools/epub-editor/)** ·
**[English README](README.md)** · **[中文使用手册](docs/user-guide.zh-CN.md)**

## 为什么做这个编辑器

许多 EPUB 编辑器在保存时会重建或规范化整本书。本工具采用更克制的方式：
保留原始压缩包中的所有条目，只修改用户明确编辑的 XML 文字片段，并导出一份
新文件，不覆盖原文件。

- 全部处理在浏览器本地完成，书籍内容不会上传；
- 支持无 DRM 的 EPUB 2 与 EPUB 3；
- 提供隔离预览、安全文字编辑和高级 XHTML 源码模式；
- 可以在当前章节或全书正文中查找替换；
- 在能够可靠映射时修改 EPUB 3 NAV 与 EPUB 2 NCX 目录文字；
- 支持 Undo/Redo 和导出前检查；
- 未修改条目在解压后保持逐字节一致；
- 导出的 EPUB 满足 `mimetype` 必须位于 ZIP 首项并采用 STORE 的要求。

界面首次打开默认为英文。可以切换为简体中文，选择结果只保存在当前浏览器的
本地存储中。

## 快速使用

1. 打开[在线编辑器](https://ajia.site/tools/epub-editor/)，或在本地运行；
2. 选择一本无 DRM 的 `.epub`；
3. 选择章节，使用“安全编辑”进行纯文字修订；
4. 只有在必须修改标签结构时才使用“XHTML 源码”；
5. 点击“检查”，然后“导出 EPUB”；
6. 在常用阅读器中打开新文件确认。原文件始终不变。

完整操作与限制见[中文使用手册](docs/user-guide.zh-CN.md)。

## 本地开发

需要 Node.js 24 或其他兼容的当前版本。

```text
npm ci
npm run dev
```

完整检查：

```text
npm run check
npm run test:coverage
npm run test:e2e
npm run release:package
npm audit
```

端到端测试只使用自建、可再分发的测试 EPUB。CI 还会使用 EPUBCheck 5.3.0
校验导出结果。

## 安全边界

应用没有后端、账号、分析、遥测、AI 或书籍内容联网功能。EPUB 始终作为不可信
输入处理：

- 解压前检查 ZIP 路径、数量、大小、压缩比和本地文件头；
- 预览在沙箱中运行，脚本、远程资源、表单、跳转和主动内容会被删除或阻止；
- 安全编辑只把转义后的文字写入精确、带版本约束的源码范围，不保存
  `contenteditable.innerHTML`，也不序列化预览 DOM；
- 修改后的 XHTML、NAV、NCX 必须通过 XML 解析才能导出；
- 不解密、不预览、不修改受保护内容。

完整说明见 [安全政策](SECURITY.md) 与[架构文档](docs/architecture.md)。

## 兼容性

V0.1 面向可重排、无 DRM 的 EPUB 2.0.1 与 EPUB 3.x。自动浏览器测试、ZIP
保留测试、导出重开和 EPUBCheck 均已通过；Calibre 9.11、Thorium Reader
3.4.0 与 Apple Books 打开测试已经完成。固定版式、SVG/MathML 密集章节、错误
XML、ZIP64 和旧式非 UTF-8 ZIP 文件名可能降级为只读或被拒绝。详见
[兼容性记录](docs/compatibility.md)。

## 参与项目

欢迎提交问题和范围清楚的 Pull Request。提交前请阅读
[CONTRIBUTING.md](CONTRIBUTING.md)。不得为了扩大格式覆盖而削弱保存与安全断言。

## 许可证

[MIT](LICENSE) © 2026 Ajia
