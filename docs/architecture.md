# Architecture

Status: Phase 0 technical spikes complete on 2026-08-08.

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

Phase 0 deliberately does not implement archive intake, path and size safety,
container/OPF/navigation parsing, dirty-entry tracking, transactions, browser
workers, preview, UI, or download. In Phase 1, archive safety must wrap extraction
before this writer seam is reused. In later phases, text token identity must also
include chapter revision/version state and transaction integration.
