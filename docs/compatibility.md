# Compatibility

Status: V0.1 RC3 deployed and verified online on 2026-08-09. Calibre 9.11 and
Thorium 3.4.0 passed, and Apple Books opens the RC1 edited smoke fixture.

## V0.1 RC3 application matrix

| Surface                  | Evidence                                                   | Result       |
| ------------------------ | ---------------------------------------------------------- | ------------ |
| Chrome 151 desktop       | Full Playwright open/edit/search/Undo/export/reopen flow   | Pass         |
| Chromium 390 px viewport | Export remains visible; no horizontal document overflow    | Pass         |
| Runtime network boundary | Every observed request remains on the local test origin    | Pass         |
| Search responsiveness    | Dedicated cancellable Worker with fallback unit tests      | Pass         |
| Release package          | Versioned static ZIP plus SHA-256 sidecar                  | Pass         |
| ajia.site online flow    | Open/edit/export/reopen; every request stays on site       | Pass         |
| Apple Books              | User confirms edited fixture opens; detailed check pending | Partial pass |
| Calibre 9.11 Viewer      | Viewer load plus user-confirmed NCX label and edited body  | Pass         |
| Thorium Reader 3.4.0     | Edited fixture opened; user confirmed reader smoke test    | Pass         |

## Phase 4 search, history, and TOC matrix

| Behavior                   | Evidence                                                        | Result |
| -------------------------- | --------------------------------------------------------------- | ------ |
| Body-only search           | Attributes and head content excluded                            | Pass   |
| Inline boundary            | Query is not guessed across separate text nodes                 | Pass   |
| Replace current            | Exact revision-bound result patched                             | Pass   |
| Stale result               | Intervening edit rejects replacement                            | Pass   |
| Atomic Replace All         | Multi-chapter change commits as one transaction or none         | Pass   |
| Undo/Redo                  | Multi-entry replacement restores and reapplies in one action    | Pass   |
| EPUB 2 NCX label           | One label token changes; target is retained                     | Pass   |
| EPUB 3 NAV + NCX           | Unique normalized target synchronizes both sources              | Pass   |
| Repeated TOC rename        | Current overlay is reparsed and both sources resynchronize      | Pass   |
| Phase 4 export             | Chapters/NAV/NCX reopen; every clean payload is byte-identical  | Pass   |
| UI controls                | Search scopes/results/navigation, history, and TOC label editor | Pass   |
| Chromium local interaction | NCX rename → Undo/Redo → special-character Replace All → export | Pass   |

## Phase 3 safe visual-edit matrix

| Behavior                   | Evidence                                                         | Result |
| -------------------------- | ---------------------------------------------------------------- | ------ |
| Inline text mapping        | Text before, inside, and after an inline element maps separately | Pass   |
| Single sentence patch      | Only one exact source slice changes                              | Pass   |
| XML special characters     | `& < >` become XML text escapes                                  | Pass   |
| Structure fingerprint      | Elements, attributes, text positions, comment/PI/CDATA unchanged | Pass   |
| Stale segment              | Old revision-bound ID is rejected                                | Pass   |
| Source re-tokenization     | Accepted edit generates new segment IDs                          | Pass   |
| Chinese IME input type     | Composition text is permitted and committed at composition end   | Pass   |
| Plain-text paste           | Inserted as a text node; rich/structural paste cannot enter      | Pass   |
| Enter, formatting and drop | Input policy blocks structural operations                        | Pass   |
| Complex script/SVG/MathML  | Downgrades to preview/source editing                             | Pass   |
| Visual export round trip   | Edited XHTML reopens; every clean entry remains byte-identical   | Pass   |
| Chromium local interaction | Edit → preview → source shows escaped text and one dirty entry   | Pass   |
| Isolated token deletion    | Empty `J` token removes no markup; a later edit remains usable   | Pass   |
| Commit rejection recovery  | Rejected draft restores authoritative text immediately           | Pass   |

## Phase 2 source and export matrix

| Behavior                   | Evidence                                                       | Result |
| -------------------------- | -------------------------------------------------------------- | ------ |
| Valid XHTML source edit    | Immutable commit creates one dirty entry and transaction       | Pass   |
| Invalid XHTML source edit  | Atomic rejection; authoritative source remains unchanged       | Pass   |
| Restore original source    | Dirty and modified-byte state return to empty                  | Pass   |
| UTF-8 BOM source           | Edited byte payload retains the three-byte BOM                 | Pass   |
| No-op export               | Every extracted non-mimetype payload equals its input bytes    | Pass   |
| One-entry source export    | Only the selected XHTML differs; all clean payloads match      | Pass   |
| Export archive contract    | First `mimetype` local entry is exact and STORE-compressed     | Pass   |
| Export reopenability       | Result reopens through the full archive/publication parser     | Pass   |
| Fragment-only XHTML link   | Resolves to the current chapter rather than an empty path      | Pass   |
| Browser source surface     | CodeMirror XML mode, preview/source tabs, check/export UI      | Pass   |
| Background export fallback | Worker path in browser; deterministic in-process test fallback | Pass   |

## Phase 1 fixture matrix

All fixtures are self-authored, source-visible, and redistributable.

| Fixture / behavior        | Evidence                                                       | Result |
| ------------------------- | -------------------------------------------------------------- | ------ |
| EPUB 3 + nested NAV       | Unicode OPF path, encoded Unicode chapter href, nested toc     | Pass   |
| EPUB 3 NAV + NCX          | NAV selected as authority, matching NCX retained as alternate  | Pass   |
| EPUB 2 + NCX              | OPF 2.0 spine `toc` resolves NCX navigation                    | Pass   |
| No standard navigation    | Chapter title and spine order fallback with warning            | Pass   |
| Non-linear spine item     | Retained and marked `linear: false`                            | Pass   |
| Local CSS and SVG         | Embedded into isolated preview without network access          | Pass   |
| Active/remote XHTML       | Script, iframe, refresh, events and live URLs removed          | Pass   |
| Missing manifest resource | Issue recorded; other readable chapter remains available       | Pass   |
| `encryption.xml` chapter  | Protected chapter downgraded and not visually previewed        | Pass   |
| Unsafe ZIP paths          | Parent, absolute, drive and backslash paths rejected           | Pass   |
| Normalized duplicates     | Colliding paths rejected before extraction                     | Pass   |
| Suspicious ratio/limits   | Metadata limits enforced before extraction                     | Pass   |
| Header disagreement       | Central/local name mismatch and aliased local offsets rejected | Pass   |
| UI read flow              | File open, directory tree, sandbox iframe and chapter switch   | Pass   |

The Phase 0 ZIP and safe-text-patch preservation tests remain active alongside
this matrix.

## Automated evidence

The current self-authored fixture is a minimal EPUB 3 payload with `mimetype`,
`META-INF/container.xml`, an OPF package, and one XHTML chapter. It is designed
to test preservation seams, not to represent the full conformance matrix.

| Area                    | Phase 0 evidence                                                               | Result |
| ----------------------- | ------------------------------------------------------------------------------ | ------ |
| ZIP local header        | `mimetype` is first at byte 0, STORE, no local extra field                     | Pass   |
| Mimetype payload        | Exact `application/epub+zip` bytes, no BOM/newline                             | Pass   |
| Clean payloads          | container, OPF, and XHTML equal their source bytes after round-trip extraction | Pass   |
| XHTML inline content    | Target text follows an `<em>` element; inline markup remains exact             | Pass   |
| XML entities            | Existing `&amp;` decodes for editing; replacement `& < >` is safely escaped    | Pass   |
| Structural preservation | Element/namespace/attribute/comment/PI/CDATA fingerprint unchanged             | Pass   |
| Stale mapping           | Source-revision mismatch is rejected                                           | Pass   |
| DTD/entity boundary     | External-only declaration is masked; internal subset/entity remains rejected   | Pass   |

These assertions run under Node.js 24.16.0 with the locked dependency versions.
The same core modules are TypeScript-checked and built as ES modules.

## Real-book XHTML 1.1 compatibility evidence

The user-reported `龙之雷.epub` was inspected and exercised locally without
changing or uploading it. All 48 XHTML spine entries contain the standard
external XHTML 1.1 `DOCTYPE`, with no internal subset or non-XML named entity.
RC2 opens all 48 with zero `chapter.invalid-xhtml` issues: 47 are safe visual
edit chapters, while the SVG cover is previewable/read-only.

The Chromium UI displayed chapter 006 and its Chinese body text with zero
invalid-XML warnings. Whole-book search found “生命故事”. A separate in-memory
replacement/export/reopen test changed only
`OEBPS/Text/Dragon_Thunder_split_006.html`; every clean payload remained exact,
the exported book reopened with zero invalid-XHTML issues, and no copy of the
user book was written or uploaded.

RC3 additionally reproduces the reported chapter-five edge case at
`OEBPS/Text/Dragon_Thunder_split_010.html`: the isolated `<span>J</span>` text
token was deleted to an empty span, a later “叔叔” token was changed to “姨父”,
the `J` did not reappear, and the 903,633-byte in-memory export reopened with
the edited chapter source exact. The original user file was neither changed
nor uploaded.

## EPUBCheck gate

`npm run fixture:export` generates a self-authored EPUB 2 result from the real
exporter. CI pins EPUBCheck 5.3.0, verifies the downloaded ZIP SHA-256, and runs
the official JAR against that artifact. Private CI run `31252143276` passed this
gate on 2026-08-08. Internal export, reopen, header, and byte-preservation checks
also passed locally.

Phase 3 private CI run `31252858027` repeated the complete gate with the visual
editing implementation and passed EPUBCheck 5.3.0.

Phase 4 private CI run `31253993587` passed all checks, including the search,
history, synchronized navigation export regressions, zero-vulnerability audit,
and pinned EPUBCheck 5.3.0 gate.

V0.1 RC1 private CI run `31257502823` passed in 1m43s. It added Linux Chromium
installation, the real-browser release flow, deterministic RC packaging, and
then repeated the pinned EPUBCheck 5.3.0 and zero-vulnerability gates.

Post-deployment private CI run `31288682223` passed in 1m36s after the
configurable online Playwright target and deployment evidence were committed.
It repeated the Linux Chromium, packaging, EPUBCheck 5.3.0, and dependency
audit gates successfully.

RC2 private CI run `31289984311` passed in 1m45s, including 55 tests, Linux
Chromium, deterministic RC2 packaging, EPUBCheck 5.3.0, and the
zero-vulnerability audit.

## Calibre 9.11 smoke evidence

The installed `C:\Program Files\Calibre2\ebook-viewer.exe` opened
`epub2-reader-smoke-edited.epub` in a responsive window titled
“阶段一 EPUB 2 测试书 [EPUB] — 电子书阅读器”. Calibre's `ebook-meta` read the
Chinese title and language, and `ebook-convert` parsed the EPUB input and
extracted “这是自建的 EPUB 2 RC 阅读器测试文字。” without error.

The Windows UI control bridge failed while requesting a screenshot, but the
user completed the human visual check and confirmed both “RC 阅读器测试目录” and
the edited sentence on 2026-08-08. Together with the successful viewer load and
Calibre parser evidence, the Calibre reader gate is recorded as a pass. A
separate automated close/reopen capture was not produced.

## Online deployment evidence

The reviewed RC3 is available at
`https://ajia.site/tools/epub-editor/`. The route is an atomic symlink to the
versioned directory `v0.1.0-rc.3-c03aef5`; the uploaded archive SHA-256 matches
the local reviewed artifact exactly:
`ddd3c8bda5783a6c0b0031104a0fde5bc78ae3653c2338c16501794eafda6325`.
The complete RC2 directory remains available for immediate rollback.

The system-Chrome Playwright flow passed against the HTTPS URL. It opened the
self-authored EPUB, renamed the NCX label, exercised Undo/Redo, replaced text
containing XML-special characters, exported and reparsed the result, checked
the EPUB mimetype header, and verified that every observed request stayed on
`https://ajia.site`. The in-app browser independently loaded the application
and displayed the fixture's directory and isolated chapter preview.

After the RC2 switch, the full self-authored edit/export/reopen flow passed
again. A separate online Chrome run opened the user's `龙之雷.epub`, displayed
chapter 006 with zero invalid-XML warnings, and observed only four static GET
requests to `https://ajia.site`; there were no POST or off-origin requests.

After the RC3 switch, the stable HTTPS route passed the complete self-authored
Playwright flow. A second online Chrome run opened `龙之雷.epub`, deleted the
isolated `J`, switched views, changed a later “叔叔” token to “姨父”, and proved
that `J` did not return and the raw English structure error never appeared. It
observed four same-origin GET requests and no POST or off-origin request.

The test route is not linked from the site's tools page, but it is reachable by
anyone who knows the URL; it is not password protected. The current Nginx user
cannot add response headers without an interactive administrator password, so
the outer page's recommended CSP and related response headers remain a hosting
hardening task. EPUB preview content is still isolated by the application's
own CSP, and no upload or server-side book storage exists.

## Thorium 3.4.0 smoke evidence

Windows package inventory identifies `EDRLab.Thorium` 3.4.0 at
`C:\Program Files\Thorium`. The edited self-authored fixture opened in a
responsive window titled “Thorium - 阶段一 EPUB 2 测试书”. The user completed the
reader check and reported the Thorium test successful on 2026-08-08, so the
Thorium gate is recorded as a pass.

## Apple Books human-assisted check

The self-authored fixtures are available from unlinked HTTPS URLs for transfer
to the user's Apple device:

- `https://ajia.site/tools/epub-editor-test-fixtures/epub2-reader-smoke-rc2.epub`
- `https://ajia.site/tools/epub-editor-test-fixtures/epub2-reader-smoke-rc2-edited.epub`

On 2026-08-09 the user confirmed that Apple Books opens the earlier RC1 edited
fixture. The title/TOC/body and close/reopen observations, and the new RC2
fixture result, have not yet been reported, so this is recorded as a partial
pass rather than a completed gate.

Open the edited fixture in Apple Books and confirm the title “阶段一 EPUB 2
测试书”, TOC label “RC 阅读器测试目录”, and sentence “这是自建的 EPUB 2 RC
阅读器测试文字。”. Close the book, reopen it from the Apple Books library, and
confirm the same TOC destination and sentence. Record the Apple device/OS
version and pass/fail result; no user-owned EPUB is required for this gate.

## Not yet claimed

V0.1 RC2 does not yet claim full coverage for BOM package fixtures, ZIP64,
legacy CP437 filename encoding, all EPUB namespace variants, deeply malformed
but recoverable books, media overlays, fixed-layout visual fidelity, SVG/MathML/
ruby editing, obfuscated fonts, large-book performance, or every CSS construct.
Fixed layout is detected and warned but not visually certified.

Apple Books remains the final native-reader smoke requirement. V0.1 RC2 also
does not certify fixed-layout fidelity, SVG/MathML
visual editing, large-book search responsiveness, or ambiguous/structurally
complex navigation label rewrites. Those cases intentionally remain read-only
or warning paths.

The broader fixture matrix in `product-requirements.md` remains the acceptance
target and must not be inferred from this single passing fixture.
