# Security

Status: Phase 1 archive intake and read-only preview controls implemented.

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

The preview iframe has `sandbox=""`, without `allow-scripts` or
`allow-same-origin`, and receives this CSP policy:

```text
default-src 'none'; img-src data: blob:; style-src 'unsafe-inline';
font-src data: blob:; media-src data: blob:; object-src 'none';
base-uri 'none'; form-action 'none'
```

The Worker and UI contain no telemetry, backend, account, cloud storage, AI or
book-content logging path.

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

Phase 1 relies on central-directory declared sizes before `fflate` extraction.
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
