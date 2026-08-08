export interface ArchiveLimits {
  readonly maxCompressionRatio: number
  readonly maxEntries: number
  readonly maxEntryUncompressedBytes: number
  readonly maxFileBytes: number
  readonly maxTotalUncompressedBytes: number
}

const MEBIBYTE = 1024 * 1024

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxCompressionRatio: 200,
  maxEntries: 10_000,
  maxEntryUncompressedBytes: 128 * MEBIBYTE,
  maxFileBytes: 100 * MEBIBYTE,
  maxTotalUncompressedBytes: 512 * MEBIBYTE,
}
