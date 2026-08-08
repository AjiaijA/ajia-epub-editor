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
`artifacts/ajia-epub-editor-v0.1.0-rc.1.zip`. Verify its adjacent SHA-256 file
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

## Private ajia.site preview

Use a non-public, access-controlled path such as `/epub-editor-rc/`. Extract
the RC into a new versioned directory; do not overwrite the previous version.
For example, the hosting layout can be:

```text
ajia.site/
  releases/
    ajia-epub-editor-v0.1.0-rc.1/
  epub-editor-rc -> releases/ajia-epub-editor-v0.1.0-rc.1/
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
reviewed SHA-256. Public DNS/path switching is intentionally outside the RC
generation task.
