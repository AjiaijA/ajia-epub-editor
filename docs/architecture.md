# Architecture

Status: Phase 2 source editing and preserve-first export complete on 2026-08-08.

## Phase 1 read pipeline

The browser read path is deliberately one-way:

```text
local File
→ transferable ArrayBuffer in a dedicated Worker
→ central-directory safety preflight
→ bounded archive extraction
→ container.xml → OPF → manifest/spine
→ EPUB 3 NAV / EPUB 2 NCX / spine fallback
→ immutable publication model
→ sanitized read-only iframe srcdoc
```

`src/app/openPublicationAsync.ts` owns the cancellable Worker boundary. The
parser remains framework-independent and can run synchronously in tests. No
file bytes or metadata leave the browser.

### Archive intake

`src/epub/archive/preflight.ts` parses the end record and central directory
before calling `fflate` extraction. It applies centralized limits, normalizes
entry paths, rejects unsafe or duplicate paths, and cross-checks each central
entry against its local header, including filename, method, encryption flag,
range, overlap, and aliased offsets. The extracted payload length must then
match the declared uncompressed size.

The Phase 0 writer is now used only at the final export boundary, after the
edit session and export validator have approved a complete candidate.

### Publication parsing

The package/parser modules decode UTF-8 with BOM detection, reject DTDs, and
identify XML nodes by local name instead of depending on a fixed prefix. The OPF
model retains original href strings while resolving safe archive paths for
lookup. Missing manifest resources and broken spine references become issues
instead of crashing unrelated readable chapters.

Navigation is normalized to one recursive model. EPUB 3 NAV is authoritative
when present; NCX is retained as an alternate and compared by normalized target.
EPUB 2 NCX is used when NAV is absent, and chapter/spine order is the documented
fallback.

### Read-only preview

`src/epub/preview/createPreview.ts` parses a copy of chapter source for preview
only. It removes active elements, refresh, event handlers and navigation
attributes; disables links; removes remote CSS/resources; and embeds known
local resources as generated data URLs. Local stylesheets are copied into a
sanitized inline style element.

The result is serialized only to iframe `srcdoc`. The iframe has an empty
`sandbox` token set (no scripts and no same-origin permission) and an injected
CSP. This transformed DOM is never authoritative and cannot be saved back to an
EPUB.

### Source-edit authority

`src/epub/editor/editSession.ts` owns immutable source-edit sessions. The
original publication/archive bytes never change. A successful source commit
must parse as XML with an XHTML `html` root, then records the exact source,
encoded bytes, dirty path, revision, and before/after transaction. Invalid XML
does not create a transaction or partially update the session. UTF-8 BOM state
is retained when new bytes are encoded.

CodeMirror is an input surface only. Preview construction always receives the
last validated session source, and the sanitized preview DOM is still never a
save source. Encrypted chapters are excluded from source editing.

### Export boundary

`src/epub/validator/exportValidator.ts` blocks export for archive/open errors,
invalid dirty XHTML, missing package/manifest resources, unknown dirty paths,
encrypted edits, or unsafe local references. Broken optional local references
remain warnings so imperfect but openable books can still be repaired.

`src/epub/exporter/exportEpub.ts` overlays only `modifiedEntries` on the
original entry payload map and writes a new archive. It then checks the binary
`mimetype` header, extracts the result, byte-compares every output payload with
its expected clean or modified bytes, and reopens the exported EPUB through the
same untrusted-input parser. Browser export runs in a dedicated Worker and
downloads an `-edited.epub`; it never overwrites the selected file.

### UI boundary

React components receive the publication through an edit session. The UI adds
an explicit advanced XHTML tab, validation/apply controls, dirty state,
pre-export checks, background export, and a warning before abandoning unsaved
changes. It has no visual editing, backend, analytics, or network integration.

## Proven seams

Phase 0 establishes two framework-independent core boundaries under `src/epub`.
Neither module depends on React or a preview DOM.

### Archive writer and inspector

`src/epub/archive/epubZip.ts` uses `fflate` for in-memory ZIP writing and
extraction. The writer constructs a fresh ordered entry map with root
`mimetype` inserted first and configured at compression level 0. All other
entries receive their existing `Uint8Array` payload; the writer does not decode,
normalize, or rebuild those payloads.

The acceptance test does not trust `fflate`'s API description. A separate
binary inspector walks ZIP local file headers and proves that:

- the first local entry starts at byte 0 and is named `mimetype`;
- compression method is 0 (STORE);
- the local extra-field length is 0;
- the stored payload is exactly the 20 UTF-8 bytes of
  `application/epub+zip`, with no BOM or newline;
- every clean fixture entry is byte-identical after write and extraction.

`fflate` is therefore the provisional Phase 0 writer choice. This decision can
be revisited if later streaming, metadata, Unicode-path, or large-book tests
expose an incompatibility. Tests, rather than the library choice, are the stable
contract.

### Loss-minimizing XHTML text patch

`src/epub/text/safeTextPatch.ts` treats the original source string as
authoritative. It scans XML markup with quote-aware boundaries, maps editable
text tokens inside `body`, and records exact source offsets and raw source. A
patch is applied only if the saved raw slice still matches those offsets.

Only the selected source range is replaced. Replacement text is escaped for
`&`, `<`, and `>`, after which the complete XHTML is parsed again as XML. A
structure fingerprint made from element hierarchy, namespace URI/local name,
sorted attribute namespace/name/value triples, comments, processing
instructions, and CDATA must remain identical. Tests separately prove that the
entire prefix and suffix around the target range are byte-for-byte unchanged,
which covers all markup and all non-target text.

The XML DOM is used only for validation and fingerprinting. It is never
serialized and is not a write source. The preview DOM remains outside this
authority boundary.

## Fixture and project shape

`tests/fixtures/minimal-epub` is a self-authored, redistributable, transparent
EPUB 3 payload fixture. Tests package its visible source files in memory rather
than committing an opaque generated archive. Vitest, strict TypeScript, ESLint,
Prettier, and a declaration-producing TypeScript build form the minimal Phase 0
toolchain.

## Deferred architecture

Phase 2 deliberately does not implement visual text editing, search/replace,
navigation editing, or application Undo/Redo. Those require the later
source-token transaction design and must not be implemented by serializing a
preview DOM. The parser and exporter currently materialize complete bounded
archives in Worker memory; streamed processing remains a performance and
defense-in-depth improvement for later large-book work.
