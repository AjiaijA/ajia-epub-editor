# AGENTS.md

## Objective

Implement Ajia EPUB Editor according to `docs/product-requirements.md`.

## Current milestone

Phases 0 through 4 are complete. The user authorized Phase 5 on 2026-08-08.
The user later authorized an unlinked online test deployment at the product
requirements URL and Thorium installation/testing. Calibre and Thorium are
recorded as passed; Apple Books opens the edited fixture but remains a
human-assisted detailed release gate. RC2 fixes safe external-only XHTML
`DOCTYPE` compatibility found during real-book online testing.
Work only on Phase 5 until the release candidate is reviewed:

1. Finish plain-language errors, progress/cancellation, accessibility, and narrow-screen behavior.
2. Add real-browser smoke coverage and release-candidate packaging.
3. Complete README, DEPLOY, compatibility, and Phase 5 release documentation.
4. Exercise all locally available reader/browser gates and record unavailable platform gates honestly.
5. Run full preservation/export/EPUBCheck regressions and private CI.
6. Produce a reversible, testable V0.1 release candidate for user review.

Do not publicly deploy, publish a release, merge to main, add backend,
telemetry, accounts, or AI without explicit user approval.

## Non-negotiable constraints

- Local-only processing; never upload EPUB content.
- Preserve the original archive structure and clean entry payload bytes.
- Never save preview DOM or `contenteditable.innerHTML` as authoritative XHTML.
- Never use whole-source `replaceAll()` for body text replacement.
- Do not serialize an entire XHTML/NAV/NCX document merely to save a text edit.
- Do not rename files, normalize XML/CSS, re-encode media, or rebuild the EPUB from templates.
- Do not execute EPUB scripts or request remote EPUB resources.
- Do not bypass DRM or modify encrypted content.
- Do not deploy, create a public repository, add telemetry, or expand product scope without explicit user approval.

## Engineering boundaries

- Keep EPUB core logic independent from React components.
- Use TypeScript strict mode.
- Prefer small, testable modules.
- Treat EPUB input as untrusted.
- Preserve user changes and avoid unrelated cleanup.
- If the selected ZIP writer cannot satisfy the binary `mimetype` acceptance test, change the writer rather than weakening the test.

## Verification

Before declaring a milestone complete, run every available relevant check: typecheck, lint, unit tests, integration tests, build, exported fixture validation, and EPUBCheck when applicable.

Do not delete tests, relax preservation assertions, or downgrade structural failures merely to make CI pass.

## Completion report

At the end of the current phase, report files and architecture added, commands
and evidence, preservation and validation proofs, unresolved risks, and the
recommended next action.
