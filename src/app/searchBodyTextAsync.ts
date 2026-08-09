import {
  searchBodyText,
  type SearchResult,
  type SearchScope,
} from '../epub/search/textSearch.js'
import type { EpubEditSession } from '../models/publication.js'
import type { SearchWorkerResponse } from '../workers/searchEpub.worker.js'

export async function searchBodyTextAsync(
  session: EpubEditSession,
  query: string,
  scope: SearchScope,
  activeChapterPath?: string,
  signal?: AbortSignal,
): Promise<readonly SearchResult[]> {
  throwIfAborted(signal)
  if (typeof Worker === 'undefined') {
    return Promise.resolve(
      searchBodyText(session, query, scope, activeChapterPath),
    )
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/searchEpub.worker.ts', import.meta.url),
      { type: 'module' },
    )
    const abort = (): void => {
      worker.terminate()
      reject(abortError())
    }
    signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = (event: MessageEvent<SearchWorkerResponse>) => {
      signal?.removeEventListener('abort', abort)
      worker.terminate()
      if (event.data.type === 'success') {
        resolve(event.data.results)
      } else {
        reject(new Error(event.data.message))
      }
    }
    worker.onerror = () => {
      signal?.removeEventListener('abort', abort)
      worker.terminate()
      reject(new Error('The body-text indexing worker stopped unexpectedly.'))
    }
    worker.postMessage({ activeChapterPath, query, scope, session })
  })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw abortError()
}

function abortError(): Error {
  const error = new Error('Body-text indexing was cancelled.')
  error.name = 'AbortError'
  return error
}
