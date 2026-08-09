# Ajia EPUB Editor V0.1 RC Deployment

This document describes a private static test deployment and rollback. It does
not authorize a public release. EPUB files are processed in the browser; the
site requires no application server, database, account, upload endpoint, or
secret.

## Release inputs

Generate the candidate from a clean checkout:

```text
npm ci
npm run release:rc
```

The deployable files are inside
`artifacts/ajia-epub-editor-v0.1.0-rc.2.zip`. Verify its adjacent SHA-256 file
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

## Unlinked ajia.site preview

Prefer an access-controlled path. If server access control is unavailable, an
unlinked path is useful for testing but must not be described as private:
anyone who knows the URL can reach it. Extract the RC into a new versioned
directory; do not overwrite the previous version.
For example, the hosting layout can be:

```text
ajia.site/
  releases/
    ajia-epub-editor-v0.1.0-rc.2/
  epub-editor-rc -> releases/ajia-epub-editor-v0.1.0-rc.2/
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

## Current authorized test deployment

On 2026-08-08 the user authorized an online test deployment at
`https://ajia.site/tools/epub-editor/`. It points to the versioned directory
`/var/www/html/tools/epub-editor-releases/v0.1.0-rc.1-27784f1`. The uploaded
archive and reviewed local artifact both have SHA-256
`2a48d2778430041b86604d4c860443992babdc6d4a9cf2830a4ffb1a303e50e5`.

The route is not linked from the tools index and has no password protection.
The reusable Nginx location template is in
`deploy/nginx-epub-editor.conf`, but installing it requires an interactive
administrator password and remains pending. Do not claim its response headers
are active until an HTTPS header check confirms them.

The two self-authored Apple Books handoff fixtures are served from the unlinked
`/tools/epub-editor-test-fixtures/` directory. They contain no user book data.
Their SHA-256 values are:

- `epub2-reader-smoke.epub`:
  `1190a3f53c0d66cb11bbc157c4a30e59b63be5ab6097975f872c999eabec2884`
- `epub2-reader-smoke-edited.epub`:
  `54792ebc08f76771a132de155a2100a0762c1ed7ea975ad2a8cb001b018c65e5`

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
