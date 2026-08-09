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
deployment guidance, and explicit rollback instructions. A later user-approved,
unlinked online test deployment was added at `ajia.site`; no backend, upload,
telemetry, account, AI, public release, PR, or merge was added.

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
- The same Playwright flow passed against
  `https://ajia.site/tools/epub-editor/`, including export/reopen and a check
  that every observed request remained on the application origin.
- Post-deployment private CI run `31288682223` passed in 1m36s, repeating the
  Linux Chromium, RC packaging, pinned EPUBCheck 5.3.0, and zero-vulnerability
  gates after the reusable online-test configuration was committed.

## Reader compatibility status

Chromium application testing is green. Apple Books cannot run on this Windows
host. Calibre 9.11 is installed: its viewer opened the edited fixture, metadata
parsing passed, and its conversion engine extracted the edited Chinese body
text. The user visually confirmed the expected NCX label and edited sentence on
2026-08-08, so the Calibre gate is recorded as passed; no separate automated
close/reopen capture was produced. Thorium Reader 3.4.0 opened the edited
fixture in a responsive window, and the user completed the reader check and
reported success on 2026-08-08. Apple Books is now the only remaining native
reader promotion gate; the self-authored `epub2-reader-smoke.epub` and a fixed
`epub2-reader-smoke-edited.epub` are provided for that test. This RC is testable
online but is not represented as the final public V0.1 release.

## Residual risks

- Native Apple Books results are pending and require the user's macOS/iOS
  device.
- The unlinked online test route is reachable by anyone who knows its URL. The
  recommended outer-page Nginx response headers require an administrator
  password and are not yet active.
- Large archives remain bounded but fully materialized in Worker memory rather
  than streamed.
- The main JavaScript bundle triggers Vite's 500 kB advisory; it is functional,
  but later code splitting can improve first load.
- ZIP64, legacy filename encodings, fixed-layout fidelity, and complex
  SVG/MathML/ruby editing remain outside the supported V0.1 edit surface.

## Recommendation

Complete the Apple Books check with the user. Promote to V0.1 only after that
result is recorded and the user explicitly approves release publication.
