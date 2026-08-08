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

## 阶段 0 验证结果

两个技术探针已经实现为永久回归测试：

- `fflate` 导出结果的首个 ZIP local file entry 是 byte-exact 的 `mimetype`，使用 STORE 且没有 local extra field；
- clean entry 重新打包再解压后的 payload 字节不变；
- XML-aware 文本补丁只替换选定的 XHTML 文本 token，结构指纹与目标以外的源码保持不变；
- 特殊字符 `& < >` 会按 XML 文本规则转义，inline 标签保持原样。

本阶段仍不是完整 EPUB 打开或导出实现。ZIP 安全预检、完整 fixture 矩阵、EPUBCheck、浏览器集成和 UI 属于后续阶段，需经阶段报告审阅后才能开始。

## 本地检查

```text
npm install
npm run spike:zip
npm run spike:text
npm run check
npm run test:coverage
```

未经确认，不部署到 `ajia.site`，不加入后端、遥测、账户或 AI 功能。
