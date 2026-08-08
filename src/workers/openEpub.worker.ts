import { openEpubPublication } from '../epub/parser/publication.js'
import {
  EpubOpenError,
  type EpubIssue,
  type EpubPublication,
} from '../models/publication.js'

interface OpenRequest {
  readonly buffer: ArrayBuffer
  readonly fileName: string
}

export type OpenWorkerResponse =
  | { readonly publication: EpubPublication; readonly type: 'success' }
  | {
      readonly issues: readonly EpubIssue[]
      readonly message: string
      readonly type: 'error'
    }

interface WorkerScope {
  onmessage: ((event: MessageEvent<OpenRequest>) => void) | null
  postMessage(message: OpenWorkerResponse): void
}

const workerScope = globalThis as unknown as WorkerScope

workerScope.onmessage = (event: MessageEvent<OpenRequest>) => {
  try {
    const publication = openEpubPublication(
      new Uint8Array(event.data.buffer),
      event.data.fileName,
    )
    workerScope.postMessage({
      publication,
      type: 'success',
    } satisfies OpenWorkerResponse)
  } catch (cause) {
    const issues =
      cause instanceof EpubOpenError
        ? cause.issues
        : [
            {
              code: 'open.worker-failed',
              message: '后台打开任务失败。',
              severity: 'error' as const,
              ...(cause instanceof Error ? { detail: cause.message } : {}),
            },
          ]
    workerScope.postMessage({
      issues,
      message: cause instanceof Error ? cause.message : '无法打开 EPUB。',
      type: 'error',
    } satisfies OpenWorkerResponse)
  }
}
