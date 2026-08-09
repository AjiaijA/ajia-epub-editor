# Phase 5 / V0.1 RC3 Report

Date: 2026-08-09
Branch: `agent/phase-5-v0.1-rc`
Version: `0.1.0-rc.3`

> Historical RC report. The international English-default/Chinese-optional
> V0.1 release was published on 2026-08-09 from commit `f0e501e`, tag `v0.1.0`.
> The public release archive SHA-256 is
> `5c0d94aafd5dac212b8d4ca7a12377e5dcf69f98b801d9836cbee83a1e2c45b4`.

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

RC2 responds to real-book online testing with a Calibre-generated EPUB 2. Its
48 XHTML chapters use the standard external XHTML 1.1 `DOCTYPE`. RC1 rejected
all such chapters; RC2 masks the declaration only in the in-memory parse copy,
never loads the external DTD, retains the exact authoritative source, and still
rejects internal subsets and custom entity declarations.

RC3 responds to the subsequent safe-editor report. A whole isolated text token
may now be deleted to empty when the exact non-target source and complete XML
markup fingerprint remain unchanged. If any visual commit is rejected, the
draft is discarded, authoritative text is restored immediately, navigation is
left usable, and a dismissible Chinese recovery message replaces the internal
English exception.

## Verification evidence

- 17 Vitest files and 60 tests pass locally. Statement coverage is 72.73%,
  branch coverage 64.33%, function coverage 74.91%, and line coverage 75.44%.
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
- `npm run release:rc` and repeat packaging pass locally. Two consecutive RC2
  package runs produced the same SHA-256:
  `627cec14dbe9eb827b16d0688da45ed9234f019a904e96b1f208d7f1697aabe9`.
- A read-only test with the user-provided `龙之雷.epub` opened all 48 chapters
  with zero invalid-XHTML issues. Forty-seven chapters support safe visual
  editing and the SVG cover remains previewable/read-only. The UI displayed
  chapter 006, whole-book search found its text, and an in-memory edit/export
  changed only that chapter before reopening successfully.
- The RC3 real-book regression deleted the isolated `J` token in
  `Dragon_Thunder_split_010.html`, then changed a later “叔叔” token to “姨父”.
  The `J` stayed deleted and the 903,633-byte in-memory export reopened with the
  edited source exact; the original book was not written or uploaded.
- Private CI run `31257502823` passed the committed candidate in 1m43s,
  including Linux Chromium E2E, release packaging, pinned EPUBCheck 5.3.0, and
  the zero-vulnerability audit.
- The same Playwright flow passed against
  `https://ajia.site/tools/epub-editor/`, including export/reopen and a check
  that every observed request remained on the application origin.
- Post-deployment private CI run `31288682223` passed in 1m36s, repeating the
  Linux Chromium, RC packaging, pinned EPUBCheck 5.3.0, and zero-vulnerability
  gates after the reusable online-test configuration was committed.
- RC2 private CI run `31289984311` passed in 1m45s with 55 tests, Linux
  Chromium, deterministic packaging, pinned EPUBCheck 5.3.0, and the
  zero-vulnerability audit.
- The stable online path now points atomically to
  `v0.1.0-rc.3-c03aef5`. Both the self-authored full flow and a read-only
  `龙之雷.epub` online preview passed after the switch; the real-book run made
  no POST or off-origin request.
- The RC3 stable-route browser regression deleted the real-book `J`, switched
  views, applied a later edit, and confirmed the deletion persisted with no raw
  English structure error. The deployment artifact SHA-256 is
  `ddd3c8bda5783a6c0b0031104a0fde5bc78ae3653c2338c16501794eafda6325`;
  the RC2 version directory remains the immediate rollback target.

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

On 2026-08-09 the user confirmed that Apple Books opens the edited fixture.
The detailed title, TOC, edited-body, and close/reopen confirmation is still
pending, so Apple Books remains a partial pass.

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
