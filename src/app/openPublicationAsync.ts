import { openEpubPublication } from '../epub/parser/publication.js'
import { EpubOpenError, type EpubPublication } from '../models/publication.js'
import type { OpenWorkerResponse } from '../workers/openEpub.worker.js'

export async function openPublicationAsync(
  bytes: Uint8Array,
  fileName: string,
  signal?: AbortSignal,
): Promise<EpubPublication> {
  throwIfAborted(signal)
  if (typeof Worker === 'undefined') {
    return Promise.resolve(openEpubPublication(bytes, fileName))
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/openEpub.worker.ts', import.meta.url),
      {
        type: 'module',
      },
    )
    const abort = (): void => {
      worker.terminate()
      reject(abortError())
    }
    signal?.addEventListener('abort', abort, { once: true })

    worker.onmessage = (event: MessageEvent<OpenWorkerResponse>) => {
      signal?.removeEventListener('abort', abort)
      worker.terminate()
      if (event.data.type === 'success') {
        resolve(event.data.publication)
      } else {
        reject(new EpubOpenError(event.data.message, event.data.issues))
      }
    }
    worker.onerror = () => {
      signal?.removeEventListener('abort', abort)
      worker.terminate()
      reject(
        new EpubOpenError('后台打开任务失败。', [
          {
            code: 'open.worker-crashed',
            message: '浏览器后台任务异常终止。',
            severity: 'error',
          },
        ]),
      )
    }

    const transferable =
      bytes.byteOffset === 0 &&
      bytes.byteLength === bytes.buffer.byteLength &&
      bytes.buffer instanceof ArrayBuffer
        ? bytes.buffer
        : bytes.slice().buffer
    worker.postMessage({ buffer: transferable, fileName }, [transferable])
  })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw abortError()
}

function abortError(): Error {
  const error = new Error('打开任务已取消。')
  error.name = 'AbortError'
  return error
}
