# Ajia EPUB Editor

Ajia EPUB Editor is a local-first, preserve-first browser tool for making small,
safe text corrections in existing EPUB books.

**[Open the web app](https://ajia.site/tools/epub-editor/)** ·
**[中文说明](README.zh-CN.md)** · **[User guide](docs/user-guide.md)**

## Why this editor

Most EPUB editors rebuild or normalize a book when saving. Ajia EPUB Editor
takes a narrower approach: it keeps the original archive entries, modifies only
the explicitly edited XML text slices, and exports a new file without
overwriting the original.

- Works entirely in your browser; book content is never uploaded.
- Opens DRM-free EPUB 2 and EPUB 3 publications.
- Provides isolated preview, safe text editing, and advanced XHTML source mode.
- Searches and replaces body text across one chapter or the whole book.
- Renames EPUB 3 NAV and EPUB 2 NCX labels when they can be mapped safely.
- Supports Undo/Redo and pre-export validation.
- Preserves every unmodified entry payload byte-for-byte after extraction.
- Exports a new `-edited.epub` with the required EPUB ZIP `mimetype` layout.

The interface defaults to English. Simplified Chinese can be selected with the
language switch and is remembered only in local browser storage.

## Quick start

1. Open the [hosted editor](https://ajia.site/tools/epub-editor/) or run it
   locally.
2. Choose a DRM-free `.epub` file.
3. Select a chapter and use **Safe edit** for text-only corrections.
4. Use **XHTML Source** only when markup itself must change.
5. Select **Check**, then **Export EPUB**.
6. Open the new file in your usual reader. The original file is unchanged.

See the [English user guide](docs/user-guide.md) or
[中文使用手册](docs/user-guide.zh-CN.md) for the complete workflow and limits.

## Local development

Requires Node.js 24 or another compatible current Node.js release.

```text
npm ci
npm run dev
```

Production and verification commands:

```text
npm run check
npm run test:coverage
npm run test:e2e
npm run release:package
npm audit
```

The end-to-end test uses only self-authored, redistributable fixtures. CI also
validates the exported EPUB with EPUBCheck 5.3.0.

## Safety model

The application has no backend, account system, analytics, telemetry, AI, or
book-content network integration. EPUB content is treated as untrusted:

- ZIP paths, counts, sizes, compression ratios, and local headers are checked
  before extraction.
- Preview content runs in a sandbox with scripts, remote resources, forms,
  navigation, and active content removed or blocked.
- Safe editing writes escaped text to an exact revision-bound source range; it
  never saves `contenteditable.innerHTML` or serializes the preview DOM.
- Dirty XHTML/NAV/NCX must parse as XML before export.
- Encrypted content is not decrypted, previewed, or modified.

Read [Security](SECURITY.md) and [Architecture](docs/architecture.md) for the
full trust boundaries.

## Current compatibility

V0.1 targets reflowable, DRM-free EPUB 2.0.1 and EPUB 3.x. Automated browser,
ZIP preservation, export/reopen, and EPUBCheck gates pass. Calibre 9.11,
Thorium Reader 3.4.0, and Apple Books opening have been tested. Fixed-layout,
SVG/MathML-heavy chapters, malformed XML, ZIP64, and legacy non-UTF-8 ZIP names
may be read-only or rejected. See [Compatibility](docs/compatibility.md).

## Contributing

Bug reports and focused pull requests are welcome. Please read
[CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes. Preservation and
security assertions must not be weakened to add format coverage.

## License

[MIT](LICENSE) © 2026 Ajia
