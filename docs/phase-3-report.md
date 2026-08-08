# Phase 3 Report

Date: 2026-08-08
Branch: `agent/phase-3-safe-visual-edit`

## Outcome

Phase 3 adds safe visual text editing without making rendered DOM authoritative.
XML-aware source tokens are aligned with DOM text-node paths and emitted as
chapter-revision-bound segments. Only verified body text nodes are wrapped in
the isolated preview. Every visual commit re-resolves the segment, applies one
escaped source slice, validates XML and a structure fingerprint, records one
transaction, and rebuilds segment IDs.

The iframe input boundary supports typing, deletion, Chinese IME composition,
and controlled plain-text paste within one segment. It blocks Enter-created
paragraphs, rich formatting, cross-segment mutations, structural children, and
drop. Complex script, SVG, MathML, DTD, invalid, or mismatched chapters do not
receive safe visual editing and retain preview/source fallback.

## Verification evidence

- 14 test files and 45 automated tests pass.
- Single-character/sentence mechanics, inline nodes, XML special characters,
  exact prefix/suffix preservation, text-node structural positions, stale IDs,
  re-tokenization, input policy, paste, and visual export are covered.
- Strict TypeScript, ESLint, Prettier, production/core builds, coverage, fixture
  export, and dependency audit pass locally.
- Local Chromium test loaded the self-authored EPUB 2 fixture, edited a Chinese
  sentence containing `& < >`, switched to preview, and confirmed one dirty
  entry/transaction. Source mode showed `&amp; &lt; &gt;` escapes, and browser
  export reported creation of a new `-edited.epub` without overwriting input.
- Phase 2 private CI run `31252143276` passed pinned EPUBCheck 5.3.0. The Phase 3
  branch must pass the same private CI gate before the milestone is closed.

## Residual risks

- Browser IME behavior varies; automated policy coverage and Chromium manual
  input are present, but native IME smoke tests on Safari/WebKit remain later
  compatibility work.
- A commit rebuilds the editable iframe and therefore loses the prior caret;
  edits are safe but repeated micro-edits are less fluid than the final UX goal.
- Script, SVG, MathML, DTD and tokenizer/parser disagreement intentionally
  downgrade instead of attempting uncertain mappings.
- Search/replace, navigation changes, and application Undo/Redo remain Phase 4.

## Recommendation

After the private Phase 3 CI/EPUBCheck run is green, proceed to Phase 4 using
the same revision-bound segment and atomic transaction boundaries. Do not add a
second whole-source replacement path.
