# Ajia EPUB Editor V0.1.1 Deployment

This document describes the static production deployment and rollback process.
EPUB files are processed in the browser; the site requires no application
server, database, account, upload endpoint, or secret.

## Release inputs

Generate the candidate from a clean checkout:

```text
npm ci
npm run release:rc
```

The deployable files are inside
`artifacts/ajia-epub-editor-v0.1.0.zip`. Verify its adjacent SHA-256 file
before copying it to another machine. The ZIP root contains `index.html`,
hashed assets, Workers, and `release.json`.

## Local acceptance preview

```text
npm run build
npm run preview -- --host 127.0.0.1
```

Open the printed local URL, load only a disposable or self-authored EPUB, and
repeat the smoke checklist in `docs/compatibility.md`. Opening `index.html`
directly with `file://` is unsupported because module Workers require an HTTP
origin.

## Staged ajia.site preview

Extract the candidate into a new versioned directory; do not overwrite the
previous version. Verify the versioned URL before switching the stable route.
For example, the hosting layout can be:

```text
ajia.site/
  releases/
    ajia-epub-editor-v0.1.0/
  epub-editor -> releases/ajia-epub-editor-v0.1.0/
```

The build uses relative asset URLs and can be served below a subdirectory.
Before switching the preview path, verify the SHA-256, load the welcome page,
open the self-authored reader-smoke fixture, edit and export it, and confirm
that the browser Network panel shows no book-content request.

Recommended response policy for the preview path:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; img-src 'self' data: blob:; font-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Do not add access logs containing query strings or filenames, upload handlers,
analytics, crash reporting, CDN script injection, or third-party fonts.

## Current production deployment

The production application is available at
`https://ajia.site/tools/epub-editor/`. On 2026-08-09 the stable route was
atomically switched to
`/var/www/html/tools/epub-editor-releases/v0.1.1-a7bfe7d` after CI, staged-URL,
and stable-URL verification. The uploaded archive and GitHub Release asset have
SHA-256
`a4da245a494376b37395d18bdad7c920c90c05098de5d3a10d87fd35c2355e1f`.
The previous stable `v0.1.0-f0e501e` directory is retained as the immediate
rollback target; earlier RC directories are also retained.

The production route is linked from the public tools index.
The reusable Nginx location template is in
`deploy/nginx-epub-editor.conf`, but installing it requires an interactive
administrator password and remains pending. Do not claim its response headers
are active until an HTTPS header check confirms them.

The self-authored Apple Books handoff fixtures are served from the unlinked
`/tools/epub-editor-test-fixtures/` directory. They contain no user book data.
The current RC2 fixture SHA-256 values are:

- `epub2-reader-smoke-rc2.epub`:
  `761bbbd452f6acaaf851dae80182cdc9dd479ba037ff525e1a37d5e18deeff3b`
- `epub2-reader-smoke-rc2-edited.epub`:
  `b8708e1da39a8234d723388180392eec0724d73891896fbaffbb0289772b49ad`

The earlier unversioned RC1 fixture URLs remain available and were not
overwritten.

The Playwright configuration accepts `PLAYWRIGHT_BASE_URL` for repeatable
online acceptance. On Windows PowerShell:

```text
$env:PLAYWRIGHT_USE_SYSTEM_CHROME='1'
$env:PLAYWRIGHT_BASE_URL='https://ajia.site/tools/epub-editor/'
npx playwright test tests/e2e/release.spec.ts
```

## Rollback

Keep the previous versioned directory until review is complete. To roll back,
switch the preview alias or hosting configuration back to the prior directory,
then verify its version and smoke fixture. Do not delete the failed candidate
until logs and the SHA-256 have been retained for diagnosis. No user EPUB data
requires migration because the application stores no server-side book state.

## Promotion gate

Promotion from RC to public V0.1 requires explicit user approval, green private
CI/EPUBCheck, successful Apple Books, Calibre, and Thorium (or approved third
reader) smoke tests, and a final check that the deployed files match the
reviewed SHA-256. Calibre and Thorium are recorded as passed; Apple Books
remains pending. The online test route is not itself a public release.
