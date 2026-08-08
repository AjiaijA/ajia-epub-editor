# Compatibility

Status: Phase 4 automated, Chromium interaction, and private CI evidence recorded on 2026-08-08.

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
| DTD/entity boundary     | `DOCTYPE` input is rejected from safe text edit                                | Pass   |

These assertions run under Node.js 24.16.0 with the locked dependency versions.
The same core modules are TypeScript-checked and built as ES modules.

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

## Not yet claimed

Phase 4 does not yet claim full coverage for BOM package fixtures, ZIP64,
legacy CP437 filename encoding, all EPUB namespace variants, deeply malformed
but recoverable books, media overlays, fixed-layout visual fidelity, SVG/MathML/
ruby editing, obfuscated fonts, large-book performance, or every CSS construct.
Fixed layout is detected and warned but not visually certified.

Apple Books, Calibre and a browser-engine reader smoke test remain release
requirements. Phase 4 also does not certify fixed-layout fidelity, SVG/MathML
visual editing, large-book search responsiveness, or ambiguous/structurally
complex navigation label rewrites. Those cases intentionally remain read-only
or warning paths.

The broader fixture matrix in `product-requirements.md` remains the acceptance
target and must not be inferred from this single passing fixture.
