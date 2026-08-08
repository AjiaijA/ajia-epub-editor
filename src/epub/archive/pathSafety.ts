export function normalizeArchiveEntryPath(path: string): string {
  if (path.includes('\0')) throw new Error('path contains NUL')
  if (path.includes('\\')) throw new Error('backslash paths are not allowed')
  if (path.startsWith('/') || /^[A-Za-z]:/u.test(path)) {
    throw new Error('absolute paths are not allowed')
  }

  const directory = path.endsWith('/')
  const output: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') throw new Error('parent traversal is not allowed')
    output.push(part)
  }
  if (output.length === 0) throw new Error('path is empty after normalization')
  return output.join('/') + (directory ? '/' : '')
}

export interface ResolvedArchiveHref {
  readonly external: boolean
  readonly fragment: string
  readonly normalizedTarget: string | null
  readonly path: string | null
}

export function resolveArchiveHref(
  baseDocumentPath: string,
  href: string,
): ResolvedArchiveHref {
  const trimmed = href.trim()
  if (/^[A-Za-z][A-Za-z\d+.-]*:/u.test(trimmed) || trimmed.startsWith('//')) {
    return { external: true, fragment: '', normalizedTarget: null, path: null }
  }

  const hashIndex = trimmed.indexOf('#')
  const withoutFragment =
    hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex)
  const fragment = hashIndex === -1 ? '' : trimmed.slice(hashIndex + 1)
  const queryIndex = withoutFragment.indexOf('?')
  const pathPart =
    queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex)
  if (pathPart.startsWith('/') || pathPart.includes('\\')) {
    throw new Error('href uses an unsafe absolute or backslash path')
  }

  const baseParts = baseDocumentPath.split('/').slice(0, -1)
  const hrefParts = pathPart === '' ? [] : pathPart.split('/')
  const output = pathPart === '' ? baseDocumentPath.split('/') : [...baseParts]
  for (const encodedPart of hrefParts) {
    if (encodedPart === '' || encodedPart === '.') continue
    if (encodedPart === '..') {
      if (output.length === 0)
        throw new Error('href traverses above the archive root')
      output.pop()
      continue
    }
    const decoded = decodePathSegment(encodedPart)
    if (decoded === '..' || decoded === '.') {
      throw new Error('href contains encoded traversal')
    }
    output.push(decoded)
  }

  const path = output.join('/')
  if (path === '') throw new Error('href resolves to an empty archive path')
  return {
    external: false,
    fragment,
    normalizedTarget: fragment === '' ? path : `${path}#${fragment}`,
    path,
  }
}

function decodePathSegment(segment: string): string {
  let decoded: string
  try {
    decoded = decodeURIComponent(segment)
  } catch {
    throw new Error('href contains invalid percent encoding')
  }
  if (
    decoded.includes('/') ||
    decoded.includes('\\') ||
    decoded.includes('\0')
  ) {
    throw new Error('href contains an encoded path separator or NUL')
  }
  return decoded
}
