# AGENTS.md

## Objective

Implement Ajia EPUB Editor according to `docs/product-requirements.md`.

## Current milestone

Phases 0 through 3 are complete. The user authorized Phase 4 on 2026-08-08.
Work only on Phase 4 until the user explicitly authorizes the next phase:

1. Add current-chapter and whole-book body-text search with stale-result protection.
2. Add replace-current and atomic Replace All using only verified text segments.
3. Add application Undo/Redo for source, visual, replace, and toc-label transactions.
4. Add minimal-patch NAV/NCX label editing with target-based synchronization and warnings.
5. Add UI for search results, replacement previews, toc labels, history availability, and summaries.
6. Run full preservation/export/EPUBCheck regressions and write a Phase 4 report.

Do not add public deployment, release packaging, backend, telemetry, or AI
during Phase 4.

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
