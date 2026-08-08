import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { createEditSession } from '../src/epub/editor/editSession.js'
import { exportEpubSession } from '../src/epub/exporter/exportEpub.js'
import {
  getCurrentNavigation,
  renameNavigationLabel,
} from '../src/epub/navigation/tocEditor.js'
import { openEpubPublication } from '../src/epub/parser/publication.js'
import {
  replaceAllSearchResults,
  searchBodyText,
} from '../src/epub/search/textSearch.js'
import { buildFixtureArchive } from '../tests/support/fixtureArchive.js'

const outputDirectory = resolve(process.cwd(), 'artifacts')
const outputPath = resolve(outputDirectory, 'epub2-reader-smoke.epub')
const editedOutputPath = resolve(
  outputDirectory,
  'epub2-reader-smoke-edited.epub',
)
const fixtureBytes = await buildFixtureArchive('epub2-ncx')
const publication = openEpubPublication(fixtureBytes, 'epub2-phase2.epub')
const chapter = publication.chapters[0]
if (chapter === undefined) throw new Error('EPUB 2 fixture chapter missing.')

const session = createEditSession(publication)
const exported = exportEpubSession(session)
const searchResults = searchBodyText(session, '测试文字', 'book')
const replaced = replaceAllSearchResults(
  session,
  searchResults,
  'RC 阅读器测试文字',
)
const navigationItem = getCurrentNavigation(replaced).items[0]
if (navigationItem === undefined) throw new Error('NCX fixture item missing.')
const editedSession = renameNavigationLabel(
  replaced,
  navigationItem,
  'RC 阅读器测试目录',
).session
const editedExport = exportEpubSession(editedSession)
await mkdir(outputDirectory, { recursive: true })
await writeFile(outputPath, exported.bytes)
await writeFile(editedOutputPath, editedExport.bytes)
process.stdout.write(`${outputPath}\n${editedOutputPath}\n`)
