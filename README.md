# Ajia EPUB Editor

Ajia EPUB Editor 是一个纯浏览器端、Local-first、Preserve-first 的轻量级 EPUB 修订工具。

它面向少量文字修订、目录文字调整和跨章节查找替换，不以创建或重新排版 EPUB 为目标。用户书籍默认只在浏览器本地处理，不上传服务器。

## 当前状态

项目处于 V0.1 的阶段 0：技术探针。

在开始完整 UI 开发前，必须先证明：

1. 导出的 EPUB 能保证根目录 `mimetype` 是 ZIP 中第一个 local file entry、内容严格正确并使用 STORE；
2. 安全文字编辑能够只修改目标 XHTML 文本 token，同时保持结构和所有非目标源码不变。

完整需求见 [docs/product-requirements.md](docs/product-requirements.md)。

## 开发原则

- Local-first
- Preserve-first
- Text-focused
- EPUB-safe
- 原 EPUB 永不被覆盖
- 不上传书籍内容
- 不处理或绕过 DRM

## 开发状态说明

项目骨架、工具链与测试命令将在阶段 0 建立。未经确认，不部署到 `ajia.site`，不加入后端、遥测、账户或 AI 功能。
