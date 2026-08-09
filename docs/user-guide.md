# Ajia EPUB Editor User Guide

## 1. Open a book

Open the web app and choose or drop a DRM-free `.epub` file. The file stays in
your browser. Before opening, the editor checks the ZIP layout, entry paths,
declared sizes, compression ratios, headers, EPUB package, spine, and
navigation documents.

An error stops unsafe input. A warning means the book can continue with a
documented limitation. An informational notice describes a safe fallback.

## 2. Navigate and preview

Choose a chapter from **Contents**. Preview is isolated: scripts do not run,
remote resources are not requested, and links are disabled. A blocked-resource
count shows how much active or external content was removed from the preview.

## 3. Edit text safely

Select **Safe edit**. Only text inside dotted outlines is editable. You can
type, delete, use an input method, or paste plain text within one segment.
Enter, rich formatting, drag/drop, and selections crossing segment boundaries
are blocked because they could change XHTML structure.

Each accepted edit:

1. resolves the visible segment against the current chapter revision;
2. escapes XML special characters such as `&`, `<`, and `>`;
3. changes only that exact source slice;
4. validates the full XML document and its structural fingerprint;
5. creates one undoable edit transaction.

Deleting a complete isolated token is supported. If a change is rejected, the
original text is restored immediately and navigation remains available.

## 4. Use XHTML Source

Use **XHTML Source** when markup itself must change or when a complex chapter is
not available in Safe edit. Select **Validate & apply** to commit a draft.
Invalid XML remains a draft and is never used by Preview or Export. **Discard
draft** restores the last validated source; **Restore opened version** creates
an undoable restoration to the original chapter.

## 5. Find and replace

**Find & replace** searches body text only. It does not search attributes,
URLs, scripts, styles, or metadata, and it does not guess a phrase across
separate inline text segments.

- **Replace current** updates one revision-bound result.
- **Replace all** validates all results first and commits them together, or
  changes nothing if any result became stale.

An empty replacement deletes the matched text safely.

## 6. Rename a table-of-contents label

Select a writable NAV or NCX item, edit **Display text**, and choose **Update
label**. Only label text changes. Links, fragments, hierarchy, and spine order
remain unchanged. When EPUB 3 NAV and EPUB 2 NCX have one unambiguous matching
target, both labels are synchronized.

## 7. Undo, check, and export

Undo and Redo operate on complete edit transactions. Select **Check** before
exporting. Errors block export; warnings document compatibility risks.

**Export EPUB** creates a new `-edited.epub`. The editor verifies the required
ZIP `mimetype` header, compares every extracted payload with the expected
original or modified bytes, and reopens the result before download. It never
overwrites the selected file.

## 8. Language and site navigation

English is the default interface. Use **EN / 中文** to switch languages. The
choice is stored only in browser local storage. Home, Blog, About, and All tools
links are available in the header.

## 9. Supported and unsupported books

V0.1 targets reflowable, DRM-free EPUB 2 and EPUB 3. Complex SVG, MathML,
fixed-layout, or malformed chapters may be preview-only or source-only. ZIP64,
legacy non-UTF-8 ZIP filenames, unsafe paths, excessive archive sizes, and
encrypted content are rejected or kept read-only. DRM is never bypassed.

For a suspected security issue, follow [SECURITY.md](../SECURITY.md) instead of
posting book content in a public issue.
