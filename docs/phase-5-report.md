# Phase 5 / V0.1 RC1 Report

Date: 2026-08-08
Branch: `agent/phase-5-v0.1-rc`
Version: `0.1.0-rc.1`

## Outcome

Phase 5 produces a private, testable V0.1 release candidate. Whole-book search
now runs in a cancellable Worker. Opening, indexing, and export expose live task
status; search can be cancelled; search focus opens predictably and returns to
its trigger; duplicate issue heading IDs were removed; the current navigation
item is unique; focus indicators and 390 px layout behavior were strengthened.

The release toolchain adds a real Chromium end-to-end test, a versioned static
ZIP, fixed entry timestamps, SHA-256 sidecar, reader-smoke EPUB, private static
deployment guidance, and explicit rollback instructions. No backend, upload,
telemetry, account, AI, public deployment, PR, merge, or public release was
added.

## Verification evidence

- 17 Vitest files and 54 tests pass locally. Statement coverage is 72.27%,
  branch coverage 63.43%, function coverage 74.74%, and line coverage 75%.
- The Playwright Chromium flow opens a self-authored EPUB 2, renames NCX with a
  special character, performs Undo/Redo, builds a background whole-book index,
  replaces XML-special text, exports, checks the binary mimetype header,
  reopens the download, checks navigation/source results, verifies all observed
  requests remain local, checks duplicate IDs, and repeats layout checks at
  390 px.
- Production build includes dedicated open, search, and export Workers.
- The generated RC archive has an adjacent SHA-256 checksum and contains only
  static deployable files plus release metadata.
- Chrome 151 passed the Playwright flow and an independent in-app browser
  visual inspection of the built static release.
- `npm run release:rc`, dependency audit, and repeat packaging pass locally.
  The dependency audit reports zero vulnerabilities. Two consecutive package
  runs produced the same SHA-256:
  `2a48d2778430041b86604d4c860443992babdc6d4a9cf2830a4ffb1a303e50e5`.
- Private CI run `31257502823` passed the committed candidate in 1m43s,
  including Linux Chromium E2E, release packaging, pinned EPUBCheck 5.3.0, and
  the zero-vulnerability audit.

## Reader compatibility status

Chromium application testing is green. Apple Books cannot run on this Windows
host. Calibre and Thorium are not installed here. Their manual import,
navigation, edited-text, and reopen checks remain explicit promotion gates;
the self-authored `epub2-reader-smoke.epub` is provided for those tests. This RC
is testable but is not represented as the final public V0.1 release.

## Residual risks

- Native Apple Books, Calibre, and Thorium results are pending.
- Large archives remain bounded but fully materialized in Worker memory rather
  than streamed.
- The main JavaScript bundle triggers Vite's 500 kB advisory; it is functional,
  but later code splitting can improve first load.
- ZIP64, legacy filename encodings, fixed-layout fidelity, and complex
  SVG/MathML/ruby editing remain outside the supported V0.1 edit surface.

## Recommendation

Distribute RC1 privately for the three reader smoke tests. Promote to V0.1 only
after those results are recorded and the user explicitly approves deployment
or release publication.
