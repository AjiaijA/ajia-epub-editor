# Security Policy

## Supported version

Security fixes are applied to the latest release on the default branch.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository. Do
not open a public issue for a vulnerability before a fix is available.

Never send an EPUB containing copyrighted, private, personal, or confidential
content. Reproduce the issue with a minimal self-authored archive whenever
possible. Reports should include:

- affected version and browser;
- a concise description and impact;
- reproducible steps using non-sensitive data;
- the smallest safe test fixture, if one is necessary;
- any suggested mitigation.

## Security model

Ajia EPUB Editor is a static, browser-only application. It has no upload API,
backend, account, analytics, telemetry, AI integration, or remote book store.
Untrusted EPUB input is checked before extraction and displayed only through a
sandboxed, sanitized preview. Export preserves unmodified entry payloads and
revalidates all modified XML.

The project does not decrypt or bypass DRM. Reports requesting DRM
circumvention are out of scope.
