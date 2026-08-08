import {
  searchBodyText,
  type SearchResult,
  type SearchScope,
} from '../epub/search/textSearch.js'
import type { EpubEditSession } from '../models/publication.js'

interface SearchRequest {
  readonly activeChapterPath?: string
  readonly query: string
  readonly scope: SearchScope
  readonly session: EpubEditSession
}

export type SearchWorkerResponse =
  | { readonly results: readonly SearchResult[]; readonly type: 'success' }
  | { readonly message: string; readonly type: 'error' }

interface WorkerScope {
  onmessage: ((event: MessageEvent<SearchRequest>) => void) | null
  postMessage(message: SearchWorkerResponse): void
}

const workerScope = globalThis as unknown as WorkerScope

workerScope.onmessage = (event: MessageEvent<SearchRequest>) => {
  try {
    workerScope.postMessage({
      results: searchBodyText(
        event.data.session,
        event.data.query,
        event.data.scope,
        event.data.activeChapterPath,
      ),
      type: 'success',
    })
  } catch (cause) {
    workerScope.postMessage({
      message:
        cause instanceof Error ? cause.message : '无法建立正文搜索索引。',
      type: 'error',
    })
  }
}
