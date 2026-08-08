# Security

Status: V0.1 RC1 archive intake, isolated editing, background search, reversible transactions, and release controls implemented.

## Archive gate

User ZIP content is not extracted until the central directory passes these
checks:

- 100 MiB file, 10,000 entries, 512 MiB declared total output, 128 MiB per
  entry, and 200:1 compression-ratio limits;
- single-disk non-ZIP64 input using STORE or DEFLATE only;
- no NUL, absolute path, drive path, backslash path, parent traversal, or
  normalized duplicate;
- no ZIP-encrypted entries;
- central directory bounds and local-header signature checks;
- central/local filename, compression and encryption-flag agreement;
- unique local offsets and non-overlapping local payload ranges;
- extracted payload sizes equal central-directory declarations.

Failures are returned as structured user-facing issues. No partial publication
model or preview is produced after an archive safety error.

`META-INF/encryption.xml` is read only to identify protected resources. An
encrypted chapter is marked `source-only` and receives no visual preview. The
application never decrypts, de-obfuscates, or modifies protected content.

## Preview isolation

Preview construction uses an inert parsed copy, not the authoritative source.
It removes script, iframe, object, embed, form, base, refresh, event attributes,
form actions, srcdoc, navigation URLs and unsupported URL-bearing attributes.
Links retain only an inert `data-epub-href` for future confirmation UI.

Remote CSS imports and URL values are removed. Local CSS, images, fonts and
media are resolved only against archive entries and embedded as generated data
URLs. No HTTP/HTTPS fetch is performed.

Read-only preview uses `sandbox=""`. Safe visual editing uses
`sandbox="allow-same-origin"` only so the parent application can attach input
guards to verified text spans. Neither mode has `allow-scripts`; active EPUB
elements and event attributes are removed before rendering, and both receive
this CSP policy:

```text
default-src 'none'; img-src data: blob:; style-src 'unsafe-inline';
font-src data: blob:; media-src data: blob:; object-src 'none';
base-uri 'none'; form-action 'none'
```

The Worker and UI contain no telemetry, backend, account, cloud storage, AI or
book-content logging path.

## Source editing and export

Source edits are accepted only for unencrypted spine XHTML. Every commit must
parse as XML, reject `DOCTYPE`, and retain an XHTML `html` root. Validation is
atomic: malformed drafts stay in the editor and never enter authoritative
session bytes. UTF-8 BOM state is preserved, and the original archive entry is
never mutated.

Pre-export validation blocks known structural/open errors, missing declared
resources, unsafe archive-local references, invalid dirty XHTML, protected
content edits, and paths not present in the opened archive. Export occurs in a
Worker, creates a new file, checks the required EPUB `mimetype` local header,
byte-compares extracted payloads, and reopens the result through the archive
gate before presenting a download.

## Safe visual input controls

Editable spans are generated from revision-bound source mappings; EPUB markup
cannot declare them. `beforeinput` permits only text insertion, IME composition,
and deletion within one segment. Enter/paragraph creation, formatting, object
insertion, history commands, and cross-segment selections are blocked. Paste is
prevented and reconstructed solely as a text node from `text/plain`; drop is
always blocked. If a browser nevertheless creates a child element, the segment
is reset instead of committed.

Composition ends and focus/mode/chapter changes flush pending text through the
same stale-ID, XML, and fingerprint checks. The application reads only
`textContent`; iframe `innerHTML` is never authoritative or saved.

## Search, replacement, and navigation controls

Search consumes verified body text segments only. It does not index element
attributes, metadata, scripts, styles, or arbitrary serialized DOM. Results
are revision-bound; any intervening chapter change makes them stale. Replace
All first verifies the complete result set and every candidate chapter, then
commits one multi-entry transaction. A stale or invalid candidate leaves the
entire session unchanged.

TOC editing changes only a uniquely located NAV/NCX text node through the same
escaped minimal-patch and XML-validation path. Targets, attributes, hierarchy,
and unrelated source bytes are retained. Uncertain synchronization produces a
warning rather than a guessed rewrite. Undo/Redo restores recorded exact
entry bytes and never operates on preview HTML.

## Phase 0 controls

- Processing code is local and has no network, backend, telemetry, analytics, or
  AI integration.
- The safe text-patch module refuses stale offsets instead of guessing where a
  patch belongs.
- Replacement text is XML-escaped and the complete result must parse before it
  is returned.
- A structural fingerprint must match before and after the patch; the DOM used
  for validation is never serialized back to source.
- `DOCTYPE` is rejected at this safe-edit boundary. This avoids custom/external
  entity behavior that cannot be mapped safely by the Phase 0 tokenizer.
- Script and style text are not exposed as editable body segments.
- The checked-in fixture contains only self-authored text and no user book,
  secret, copyrighted sample, or remote resource.

## Remaining security limits

Phase 4 relies on central-directory declared sizes before `fflate` extraction.
Payload sizes are checked again afterward, but extraction is not yet an
incremental stream with a live output-byte abort. Work runs in a cancellable
Worker so the UI remains isolated, but peak memory can approach the configured
archive bounds.

ZIP64 and legacy non-UTF-8 filename encodings are rejected rather than parsed.
CSS sanitization intentionally supports a small safe subset and can remove
legitimate complex styling. The iframe sandbox/CSP is the final containment
boundary even when sanitizer coverage is incomplete.

`@xmldom/xmldom` and `fflate` are pinned by `package-lock.json`. Dependency audit
is part of milestone verification. Dependency behavior is still treated as
untrusted at preservation boundaries, which is why local-header and source
invariance tests are maintained independently.

No book content may be sent to analytics, error reporting, AI services, or
application servers in any phase.

Whole-book search executes in a dedicated Worker and can be cancelled by
terminating that Worker. Search messages use browser structured cloning only;
they are never sent to a service or logged. Opening and export use independent
Workers so no Worker has a persistent content store.

The release package is static and contains no credential, endpoint, service
worker, analytics SDK, or remote font/script. Deployment guidance requires a
restrictive page CSP and a versioned, reversible directory switch. The RC ZIP
has a SHA-256 sidecar for transport verification.

EPUBCheck is a CI/build-time tool only. The browser never uploads a user's book
for conformance checking. CI downloads the pinned 5.3.0 distribution and first
verifies its published release asset against the recorded SHA-256 digest.
