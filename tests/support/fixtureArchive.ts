import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { writeEpubArchive } from '../../src/epub/archive/epubZip.js'

export async function buildFixtureArchive(
  fixtureName: string,
): Promise<Uint8Array> {
  const root = pathToFileURL(
    resolve(process.cwd(), 'tests', 'fixtures', fixtureName) + '/',
  )
  const entries = new Map<string, Uint8Array>()
  await collectFiles(root, '', entries)
  entries.delete('README.md')
  return writeEpubArchive(entries)
}

async function collectFiles(
  directoryUrl: URL,
  relativeDirectory: string,
  entries: Map<string, Uint8Array>,
): Promise<void> {
  const directoryEntries = await readdir(fileURLToPath(directoryUrl), {
    withFileTypes: true,
  })
  for (const directoryEntry of directoryEntries) {
    const relativePath =
      relativeDirectory === ''
        ? directoryEntry.name
        : `${relativeDirectory}/${directoryEntry.name}`
    const entryUrl = new URL(
      encodeURIComponent(directoryEntry.name) +
        (directoryEntry.isDirectory() ? '/' : ''),
      directoryUrl,
    )
    if (directoryEntry.isDirectory()) {
      await collectFiles(entryUrl, relativePath, entries)
    } else {
      entries.set(
        relativePath,
        new Uint8Array(await readFile(fileURLToPath(entryUrl))),
      )
    }
  }
}
