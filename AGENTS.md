# AGENTS.md

## Objective

Implement Ajia EPUB Editor according to `docs/product-requirements.md`.

## Current milestone

Phase 0 is complete. The user authorized Phase 1 on 2026-08-08. Work only on
Phase 1 until the user explicitly authorizes the next phase:

1. Add bounded archive preflight and reject unsafe ZIP input before extraction.
2. Parse container.xml, OPF manifest/spine, EPUB 3 NAV, and EPUB 2 NCX.
3. Build the unified read-only publication and navigation models with spine fallback.
4. Add local file selection/drop, an accessible navigation tree, sandboxed read-only preview, and issue panel.
5. Extend self-authored fixtures and tests for basic EPUB 2/3 browsing and malicious-input rejection.
6. Run all checks and write a Phase 1 report with evidence, limitations, and remaining risks.

Do not add editing, export UI, deployment, backend, telemetry, or AI during Phase 1.

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
