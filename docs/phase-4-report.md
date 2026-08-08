# Phase 4 Report

Date: 2026-08-08
Branch: `agent/phase-4-search-history-toc`

## Outcome

Phase 4 adds current-chapter and whole-book body-text search, result navigation,
replace-current, atomic Replace All, application Undo/Redo, and minimal NAV/NCX
label editing. These operations reuse the revision-bound XML text-segment and
exact-source transaction boundaries established earlier. Preview DOM remains
non-authoritative and no whole-document serializer was introduced.

Replace All validates every result and candidate chapter before committing one
multi-entry transaction. TOC labels are patched only when a single source text
node can be identified; uniquely matched EPUB 3 NAV and NCX targets are updated
together. Ambiguous synchronization is reported and never guessed. The UI
shows scope, match and chapter counts, previous/next navigation, replacement
actions, selected TOC label editing, Undo/Redo availability, dirty entries,
affected chapters, and the latest transaction summary.

## Verification evidence

- 16 test files and 52 automated tests pass.
- Search coverage proves body-only behavior, inline boundaries, stale-result
  rejection, exact current replacement, atomic multi-chapter replacement, and
  no partial mutation on failure.
- History coverage proves one-step undo/redo of multi-entry replacement and
  TOC changes.
- EPUB 2 NCX and EPUB 3 NAV+NCX tests prove exact label patches, stable targets,
  repeated synchronized renames, and warning-first behavior.
- The Phase 4 export integration test reopens replaced chapters and synchronized
  navigation while byte-comparing every clean archive payload.
- Prettier, ESLint, strict TypeScript, all tests, production/core builds,
  coverage, fixture export, and dependency audit pass locally. The dependency
  audit reports zero known vulnerabilities.
- Local Chromium loaded the self-authored EPUB 2 fixture, renamed an NCX label
  containing `&`, verified Undo/Redo, found and atomically replaced body text
  with `& < >`, rendered the literal result, and completed browser export with
  a new `-edited.epub` status. There was no public deployment or PR.
- Private CI/EPUBCheck evidence is recorded after the committed branch is
  pushed for internal verification.

## Library choices

No new runtime library was added. Search, grouping, stale checks, transaction
history, and TOC location use the existing TypeScript core, `@xmldom/xmldom`
XML validation, and Phase 0 source tokenizer. `fflate` remains the ZIP writer
behind binary and payload-preservation assertions. React remains a presentation
surface only.

## Residual risks

- Whole-book indexing is synchronous. Archive limits bound work, but a highly
  text-heavy book may briefly block the UI; Phase 5 should profile and move the
  index to a Worker if needed.
- Search deliberately does not match a phrase split across inline elements.
  This avoids uncertain cross-node rewrites and is disclosed in the UI.
- A TOC label containing multiple non-whitespace text nodes, or a NAV/NCX target
  with ambiguous counterparts, is not rewritten automatically.
- Final Apple Books, Calibre, and third-reader smoke tests, accessibility polish,
  progress feedback, release packaging, and deployment documentation remain
  Phase 5 work.

## Recommendation

Proceed to Phase 5 only after the private CI/EPUBCheck gate is green. Phase 5
is the final planned phase for the V0.1 release candidate.
