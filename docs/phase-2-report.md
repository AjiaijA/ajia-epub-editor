# Phase 2 Report

Date: 2026-08-08
Branch: `agent/phase-2-source-export`

## Outcome

Phase 2 implements an advanced XHTML source editor and a preserve-first local
export loop without entering visual editing or later search/navigation work.
CodeMirror drafts become authoritative only after XML validation. Validated
changes are tracked as immutable transactions and per-entry bytes; original
publication bytes remain untouched.

Export performs lightweight structural checks, overlays only dirty payloads,
writes a new EPUB, proves the binary mimetype contract, byte-compares extracted
entries, and reopens the result before download. Open and export work are moved
off the browser UI thread.

## Verification evidence

- Strict TypeScript, ESLint, Prettier, Vitest, production Vite build, coverage,
  core declaration build, and dependency audit are milestone gates.
- Unit/integration coverage includes atomic invalid-XML rejection, original
  restoration, UTF-8 BOM retention, no-op export, single-entry export,
  clean-payload identity, correct mimetype header, and exported-book reopen.
- `npm run fixture:export` produces the self-authored EPUB 2 CI artifact.
- CI pins EPUBCheck 5.3.0 and its release ZIP SHA-256 before validating the
  artifact. Java was unavailable locally and the shell could not fetch that
  GitHub asset, so the official EPUBCheck execution must be confirmed by the
  first CI run; this is the one unresolved verification item.

## Library decisions

- CodeMirror 6 with `@codemirror/lang-xml`: editor state, XML syntax support,
  accessibility, and a maintained extension boundary without making editor DOM
  authoritative.
- `fflate`: retained because independent binary/payload assertions continue to
  prove the preservation contract.
- `@xmldom/xmldom`: retained for XML validation only; it is never used to
  serialize saved source.
- `tsx`: used only to generate a transparent CI fixture with production core
  modules.

## Residual risks and recommendation

Large archives still have bounded but material Worker memory cost; ZIP64 and
legacy filename encodings remain rejected; lightweight checks are not a
replacement for EPUBCheck; and reading-system smoke tests are still deferred.
Source editing is intentionally expert-facing and does not yet provide product
Undo/Redo.

Recommendation: do not enter Phase 3 until the pinned EPUBCheck CI job passes
the generated artifact. Once that external gate is green, the Phase 2
architecture is suitable for the safe visual-editing work in Phase 3.
