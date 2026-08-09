# AGENTS.md

## Objective

Implement Ajia EPUB Editor according to `docs/product-requirements.md`.

## Current milestone

Phases 0 through 5 and RC1–RC3 are complete. On 2026-08-09 the user approved
the international V0.1 release: English-default/Chinese-optional UI, a formal
ajia.site tools entry, a public GitHub repository, bilingual documentation,
and ongoing synchronized maintenance. Calibre and Thorium passed; Apple Books
opens an edited fixture.

Current work is V0.1.1 released maintenance. Preserve the English-first
international interface, complete both English and Chinese documentation for
user-facing changes, and keep the site deployment, GitHub source, tags, and
release assets synchronized.

## Non-negotiable constraints

- Local-only processing; never upload EPUB content.
- Preserve the original archive structure and clean entry payload bytes.
- Never save preview DOM or `contenteditable.innerHTML` as authoritative XHTML.
- Never use whole-source `replaceAll()` for body text replacement.
- Do not serialize an entire XHTML/NAV/NCX document merely to save a text edit.
- Do not rename files, normalize XML/CSS, re-encode media, or rebuild the EPUB from templates.
- Do not execute EPUB scripts or request remote EPUB resources.
- Do not bypass DRM or modify encrypted content.
- Deployment and a public GitHub repository are authorized for this project.
  Backend, telemetry, accounts, AI, and scope expansion remain unauthorized.

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
