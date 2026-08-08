# AGENTS.md

## Objective

Implement Ajia EPUB Editor according to `docs/product-requirements.md`.

## Current milestone

Phases 0 through 2 are complete. The user authorized Phase 3 on 2026-08-08.
Work only on Phase 3 until the user explicitly authorizes the next phase:

1. Build XML-aware body text segments with revision-bound IDs and source offsets.
2. Apply visual edits only through minimal, XML-escaped source patches with structure fingerprints.
3. Add a safe visual-edit surface with composition, beforeinput, paste, and drop controls.
4. Re-tokenize after every accepted source or visual edit and invalidate stale segment IDs.
5. Cover single-character, sentence, special-character, complex inline, stale, paste, and Chinese IME cases.
6. Run the full export/EPUBCheck regression suite and write a Phase 3 report.

Do not add search/replace, navigation editing, application Undo/Redo, public
deployment, backend, telemetry, or AI during Phase 3.

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
