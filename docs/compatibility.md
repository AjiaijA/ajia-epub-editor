# Compatibility

Status: Phase 0 technical spike evidence recorded on 2026-08-08.

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

Phase 0 does not claim compatibility with EPUB 2, NAV/NCX, nested navigation,
BOM-bearing package documents, unusual or percent-encoded paths, fixed layout,
SVG/MathML/ruby, encrypted content, malformed archives, ZIP attack fixtures,
large books, browser memory limits, or any reading application.

EPUBCheck has not been run in Phase 0: the spike writes an archive from a minimal
preservation fixture but does not yet implement the complete exported-fixture
pipeline or EPUB validation stage. EPUBCheck integration and fully compliant
fixtures remain required before the later export milestone. Apple Books,
Calibre, and a browser-engine reader smoke test also remain required before
V0.1.

The broader fixture matrix in `product-requirements.md` remains the acceptance
target and must not be inferred from this single passing fixture.
