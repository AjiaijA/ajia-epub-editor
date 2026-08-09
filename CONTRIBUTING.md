# Contributing

Thank you for helping improve Ajia EPUB Editor.

## Before opening an issue

- Search existing issues first.
- Do not attach copyrighted books, private manuscripts, credentials, or DRM
  material to a public issue.
- Prefer a minimal, self-authored EPUB fixture that reproduces the problem.
- Include browser/OS, EPUB version when known, expected behavior, and the exact
  non-sensitive error message.

Security vulnerabilities should follow [SECURITY.md](SECURITY.md).

## Development workflow

1. Fork the repository and create a focused branch.
2. Install locked dependencies with `npm ci`.
3. Add or update a self-authored regression fixture/test.
4. Keep EPUB core logic independent from React.
5. Run `npm run check`, `npm run test:coverage`, and `npm run test:e2e`.
6. Explain preservation, security, and compatibility effects in the pull
   request.

## Non-negotiable preservation rules

- Never upload book content or add telemetry/analytics around it.
- Never save preview DOM or `contenteditable.innerHTML` as XHTML.
- Never serialize a whole XML document merely to change a text token.
- Never weaken the binary `mimetype`, clean-payload, XML, stale-offset, or
  structure-fingerprint tests to make new input pass.
- Never bypass DRM or modify encrypted content.
- Fixtures must be self-authored and redistributable.

Formatting and lint rules are enforced by CI. Keep changes small enough to
review and avoid unrelated refactoring.
