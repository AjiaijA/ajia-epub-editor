# Security

Status: Phase 0 technical spikes complete; archive intake and preview security
are not yet implemented.

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

## Explicitly unimplemented controls

The ZIP spike receives an already-extracted map from a trusted test fixture. It
is not an archive-opening API. It currently does not enforce compressed or
uncompressed size limits, entry-count limits, compression-ratio limits, path
normalization, duplicate-path rejection, encryption/DRM detection, cancellation,
or memory bounds. Those checks must precede any extraction of user input in
Phase 1.

No preview exists in Phase 0. Before a future preview can consume book content,
it must implement the iframe sandbox, restrictive CSP, active-content removal,
remote-request blocking, controlled Blob URL lifecycle, and navigation controls
defined in `product-requirements.md`.

`@xmldom/xmldom` and `fflate` are pinned by `package-lock.json`. Dependency audit
is part of the Phase 0 verification. Dependency behavior is still treated as
untrusted at preservation boundaries, which is why local-header and source
invariance tests are maintained independently.

No book content may be sent to analytics, error reporting, AI services, or
application servers in any phase.
