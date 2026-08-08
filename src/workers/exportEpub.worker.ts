import {
  ExportValidationError,
  exportEpubSession,
  type ExportedEpub,
} from '../epub/exporter/exportEpub.js'
import type { EpubEditSession, EpubIssue } from '../models/publication.js'

interface ExportRequest {
  readonly session: EpubEditSession
}

export type ExportWorkerResponse =
  | { readonly exported: ExportedEpub; readonly type: 'success' }
  | {
      readonly issues: readonly EpubIssue[]
      readonly message: string
      readonly type: 'error'
    }

interface WorkerScope {
  onmessage: ((event: MessageEvent<ExportRequest>) => void) | null
  postMessage(message: ExportWorkerResponse, transfer?: Transferable[]): void
}

const workerScope = globalThis as unknown as WorkerScope

workerScope.onmessage = (event: MessageEvent<ExportRequest>) => {
  try {
    const exported = exportEpubSession(event.data.session)
    workerScope.postMessage(
      { exported, type: 'success' } satisfies ExportWorkerResponse,
      [exported.bytes.buffer],
    )
  } catch (cause) {
    workerScope.postMessage({
      issues:
        cause instanceof ExportValidationError
          ? cause.issues
          : [
              {
                code: 'export.worker-failed',
                message: '后台导出任务失败。',
                severity: 'error',
                ...(cause instanceof Error ? { detail: cause.message } : {}),
              },
            ],
      message: cause instanceof Error ? cause.message : '无法导出 EPUB。',
      type: 'error',
    } satisfies ExportWorkerResponse)
  }
}
