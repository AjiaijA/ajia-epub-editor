# AGENTS.md

## Objective

Implement Ajia EPUB Editor according to `docs/product-requirements.md`.

## Current milestone

Work only on Phase 0 unless the user explicitly authorizes the next phase:

1. Create the minimal TypeScript project and test harness.
2. Build a ZIP round-trip spike proving EPUB `mimetype` ordering and STORE behavior at the binary local-header level, while clean entry payload bytes remain unchanged after extraction.
3. Build a safe text-patch spike proving that editing one XHTML text token preserves the XML structure and all non-target source text.
4. Convert both spikes into permanent regression tests.
5. Run the tests and write a short phase report with evidence, limitations, and remaining risks.

Do not build the complete UI during Phase 0.

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

At the end of Phase 0, report:

- files and architecture added;
- commands run and results;
- proof of ZIP local-header ordering and STORE method;
- proof of safe text-patch preservation;
- unresolved risks and recommended next action.
