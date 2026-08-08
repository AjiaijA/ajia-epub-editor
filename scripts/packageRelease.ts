import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'

import { zipSync, type Zippable } from 'fflate'

import { RELEASE_VERSION } from '../src/release.js'

const root = process.cwd()
const distDirectory = resolve(root, 'dist')
const outputDirectory = resolve(root, 'artifacts')
const archiveName = `ajia-epub-editor-v${RELEASE_VERSION}.zip`
const archivePath = resolve(outputDirectory, archiveName)
const entries: Zippable = {}
const fixedMtime = new Date('1980-01-01T00:00:00.000Z')

await collect(distDirectory)
entries['release.json'] = [
  new TextEncoder().encode(
    `${JSON.stringify(
      {
        application: 'Ajia EPUB Editor',
        privacy: 'EPUB content is processed locally in the browser.',
        version: RELEASE_VERSION,
      },
      null,
      2,
    )}\n`,
  ),
  { mtime: fixedMtime },
]

const archive = zipSync(entries, { level: 9 })
const digest = createHash('sha256').update(archive).digest('hex')
await mkdir(outputDirectory, { recursive: true })
await writeFile(archivePath, archive)
await writeFile(`${archivePath}.sha256`, `${digest}  ${archiveName}\n`)
process.stdout.write(`${archivePath}\nSHA-256 ${digest}\n`)

async function collect(directory: string): Promise<void> {
  const directoryEntries = await readdir(directory, { withFileTypes: true })
  for (const entry of directoryEntries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      await collect(path)
      continue
    }
    const archiveEntryPath = relative(distDirectory, path).split(sep).join('/')
    entries[archiveEntryPath] = [
      new Uint8Array(await readFile(path)),
      { mtime: fixedMtime },
    ]
  }
}
