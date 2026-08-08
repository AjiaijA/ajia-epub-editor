# Compatibility

Status: Phase 1 automated compatibility evidence recorded on 2026-08-08.

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

## Not yet claimed

Phase 1 does not yet claim full coverage for BOM package fixtures, ZIP64,
legacy CP437 filename encoding, all EPUB namespace variants, deeply malformed
but recoverable books, media overlays, fixed-layout visual fidelity, SVG/MathML/
ruby editing, obfuscated fonts, large-book performance, or every CSS construct.
Fixed layout is detected and warned but not visually certified.

EPUBCheck is still outside Phase 1 because no export pipeline exists yet.
EPUBCheck integration begins with the reliable export milestone. Apple Books,
Calibre and a browser-engine reader smoke test also remain release requirements.

The broader fixture matrix in `product-requirements.md` remains the acceptance
target and must not be inferred from this single passing fixture.
