import {
  ExportValidationError,
  exportEpubSession,
  type ExportedEpub,
} from '../epub/exporter/exportEpub.js'
import type { EpubEditSession } from '../models/publication.js'
import type { ExportWorkerResponse } from '../workers/exportEpub.worker.js'

export async function exportEpubAsync(
  session: EpubEditSession,
): Promise<ExportedEpub> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(exportEpubSession(session))
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/exportEpub.worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = (event: MessageEvent<ExportWorkerResponse>) => {
      worker.terminate()
      if (event.data.type === 'success') {
        resolve(event.data.exported)
      } else {
        reject(new ExportValidationError(event.data.issues))
      }
    }
    worker.onerror = () => {
      worker.terminate()
      reject(
        new ExportValidationError([
          {
            code: 'export.worker-crashed',
            message: 'The browser export worker stopped unexpectedly.',
            severity: 'error',
          },
        ]),
      )
    }
    worker.postMessage({ session })
  })
}
