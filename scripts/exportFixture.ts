import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { createEditSession } from '../src/epub/editor/editSession.js'
import { exportEpubSession } from '../src/epub/exporter/exportEpub.js'
import { openEpubPublication } from '../src/epub/parser/publication.js'
import { buildFixtureArchive } from '../tests/support/fixtureArchive.js'

const outputDirectory = resolve(process.cwd(), 'artifacts')
const outputPath = resolve(outputDirectory, 'epub2-reader-smoke.epub')
const fixtureBytes = await buildFixtureArchive('epub2-ncx')
const publication = openEpubPublication(fixtureBytes, 'epub2-phase2.epub')
const chapter = publication.chapters[0]
if (chapter === undefined) throw new Error('EPUB 2 fixture chapter missing.')

const session = createEditSession(publication)
const exported = exportEpubSession(session)
await mkdir(outputDirectory, { recursive: true })
await writeFile(outputPath, exported.bytes)
process.stdout.write(`${outputPath}\n`)
