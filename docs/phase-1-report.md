# Phase 1 Report: Parsing and Read-only Browsing

Date: 2026-08-08

Branch: `agent/phase-1-readonly-browser`

## Delivered

- Central-directory-first ZIP safety gate with bounded limits, path
  normalization, duplicate detection, compression checks and central/local
  header cross-validation.
- UTF-8/BOM-aware container and OPF parsing, manifest/spine models, issue
  collection and readable-chapter degradation.
- EPUB 3 NAV, EPUB 2 NCX, dual-source comparison and spine fallback in one
  navigation model.
- Dedicated cancellable Worker for archive open and parsing.
- Local selection/drop, accessible directory tree, sandboxed read-only preview
  and structured issue panel.
- Preview removal of active and remote content, controlled local-resource
  embedding, empty-permission iframe sandbox and restrictive CSP.
- Transparent self-authored EPUB 2 and EPUB 3 fixtures plus malicious archive
  cases.

## Verification evidence

`npm run check` passes formatting, ESLint, strict TypeScript, 25 automated tests
across 8 files, and the Vite production build. `npm run test:coverage` reports
78.89% statements, 66.06% branches, 83.01% functions and 80.71% lines across
the complete application surface, including intentionally unexecuted Worker
entry code. `npm audit --audit-level=low` reports zero known vulnerabilities.

The tests prove EPUB 2/3 reading order, nested and combined navigation, Unicode
and encoded paths, spine fallback, resource degradation, DRM boundary,
malicious path rejection, size/ratio enforcement, local-header disagreement
rejection, preview sanitization and the user-level local open/chapter switch
flow. Phase 0 preservation tests remain green.

## Library decisions

- Continue `fflate` for extraction after independent preflight and for the
  already-proven writer seam.
- Continue `@xmldom/xmldom` for namespace-aware XML validation and read models;
  no parsed source is serialized for saving.
- Add React and Vite for the local static UI, with no router, state library,
  backend SDK, telemetry or remote service.

## Residual risks

- Extraction is bounded by central metadata and verified afterward, but not yet
  streamed with a live decompressed-byte abort. Peak Worker memory needs future
  large-fixture measurement.
- ZIP64 and legacy non-UTF-8 filenames are deliberately rejected.
- CSS/resource sanitization favors containment and may remove legitimate complex
  presentation.
- The full edge-case matrix, EPUBCheck, reader smoke tests and fixed-layout
  fidelity remain incomplete.
- No editing or export exists in this milestone.

## Recommendation

Phase 1 acceptance is met for the current basic fixture matrix and malicious
archive cases. Proceed to Phase 2 only after user review; Phase 2 should retain
this read pipeline and add source editing, dirty-entry state, validation and
reliable export without weakening any Phase 0/1 tests.
