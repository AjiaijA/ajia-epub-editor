# AGENTS.md

## Objective

Implement Ajia EPUB Editor according to `docs/product-requirements.md`.

## Current milestone

Phases 0 and 1 are complete. The user authorized Phase 2 on 2026-08-08. Work
only on Phase 2 until the user explicitly authorizes the next phase:

1. Add CodeMirror 6 XHTML source editing with explicit XML validation.
2. Track source-edit transactions as modified bytes and dirty archive entries without mutating original bytes.
3. Add lightweight pre-export validation and block structural/archive errors.
4. Export a new preserve-first EPUB, then verify mimetype headers, clean payload bytes, and reopenability.
5. Add fixture export and EPUBCheck 5.3.0 CI validation.
6. Add no-op and source-edit export integration tests and write a Phase 2 report.

Do not add safe visual text editing, search/replace, navigation editing,
application Undo/Redo, deployment, backend, telemetry, or AI during Phase 2.

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
