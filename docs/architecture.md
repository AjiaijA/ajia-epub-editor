# Architecture

Status: V0.1 RC1 architecture complete on 2026-08-08.

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

### Safe visual-edit mapping

`src/epub/text/safeTextPatch.ts` aligns XML-aware source text tokens with
parsed DOM text-node paths. Only non-whitespace `body` text outside
`script`/`style` becomes a revision-bound `TextSegment`. A mapping is rejected
when tokenizer and parser text counts or decoded values disagree. Script, SVG,
MathML, DTD, invalid XML, and stale mappings downgrade to preview/source mode.

The editable preview wraps only verified text nodes with generated segment IDs.
User input never supplies markup: the UI reads `textContent`, then
`commitVisualText` resolves the ID against the current chapter revision,
escapes XML text, replaces exactly one source slice, validates the complete
XHTML, compares structural fingerprints, records one text transaction, and
re-tokenizes. Every accepted edit increments the chapter revision and
invalidates all previous IDs and offsets.

The structural fingerprint retains element/namespace hierarchy, every
attribute value, comments, processing instructions, CDATA, and text-node
positions/count while excluding only text values.

### Phase 4 search and transaction authority

`src/epub/search/textSearch.ts` indexes the same verified body text segments
used by safe visual editing. Search therefore excludes attributes, head,
script, and style text and deliberately does not join matches across inline
segment boundaries. Every result carries its chapter revision and exact raw
source slice. Replace-current rejects a stale result. Replace All validates
every result first, groups patches by chapter, applies ranges from the end of
each source, validates every candidate XHTML, and commits all changed entries
as one transaction or none.

The edit session now records generic reversible changes containing exact
before/after source and bytes for each affected entry. Source edits, visual
text edits, replacements, and TOC labels share this one boundary. Undo moves
the last transaction to a redo stack and restores all its entries atomically;
Redo reapplies the same verified bytes. A new edit clears the redo stack.

### Minimal navigation patches

`src/epub/navigation/tocEditor.ts` reparses navigation over the current edit
overlay, locates a selected NAV anchor or NCX `navLabel/text` by normalized
target plus current label, and changes exactly one mapped text token. When an
EPUB 3 NAV item has one unambiguous NCX target match, both labels are committed
in one transaction. Ambiguous or structurally complex labels are left
untouched and reported as warnings; href targets and hierarchy are never
rewritten. Spine fallback labels are read-only.

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

React components receive the publication through an edit session. The UI has
preview, safe visual, and advanced XHTML views; current-chapter/whole-book
search; result navigation; replacement counts; TOC label editing; history
controls and summaries; pre-export checks; and background export. It has no
backend, analytics, AI, or book-content network integration.

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

Whole-book search now runs in a cancellable dedicated Worker; unit tests retain
a deterministic in-process fallback. Opening and export use separate Workers.
The parser and exporter still materialize complete bounded archives in Worker
memory, so streamed processing remains a later performance and
defense-in-depth improvement. The main UI bundle also remains large enough to
trigger Vite's chunk-size advisory; future code splitting must not introduce a
second save authority or DOM serialization path.

### Release boundary

V0.1 RC packaging includes only the Vite static build plus a small
`release.json`. `scripts/packageRelease.ts` fixes ZIP entry timestamps, sorts
paths, emits a versioned archive, and writes a SHA-256 sidecar. Runtime and
deployment remain separate: the package can be served below a versioned static
directory, tested, and rolled back without modifying source EPUB files or
server-side state.
