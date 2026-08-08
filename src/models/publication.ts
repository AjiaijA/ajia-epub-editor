export type IssueSeverity = 'error' | 'warning' | 'info'

export interface EpubIssue {
  readonly code: string
  readonly detail?: string
  readonly message: string
  readonly path?: string
  readonly severity: IssueSeverity
}

export interface EpubArchiveEntry {
  readonly originalData: Uint8Array
  readonly path: string
}

export interface EpubArchive {
  readonly entries: ReadonlyMap<string, EpubArchiveEntry>
}

export interface ManifestItem {
  readonly archivePath: string | null
  readonly href: string
  readonly id: string
  readonly mediaType: string
  readonly properties: readonly string[]
}

export interface SpineItem {
  readonly idref: string
  readonly index: number
  readonly linear: boolean
  readonly manifestItem: ManifestItem | null
}

export interface ChapterDocument {
  readonly archivePath: string
  readonly idref: string
  readonly linear: boolean
  readonly originalBytes: Uint8Array
  readonly originalSource: string
  readonly sourceEditCapability: 'editable' | 'encrypted'
  readonly sourceEncoding: 'utf-8' | 'utf-8-bom'
  readonly title: string
  readonly visualEditCapability: 'readonly' | 'source-only'
}

export interface SourceEditTransaction {
  readonly afterSource: string
  readonly beforeSource: string
  readonly chapterPath: string
  readonly revision: number
  readonly type: 'source-edit'
}

export interface EpubEditSession {
  readonly currentSources: ReadonlyMap<string, string>
  readonly dirtyEntries: ReadonlySet<string>
  readonly modifiedEntries: ReadonlyMap<string, Uint8Array>
  readonly publication: EpubPublication
  readonly revision: number
  readonly transactions: readonly SourceEditTransaction[]
}

export interface NavigationSourceRef {
  readonly documentPath: string
  readonly kind: 'nav' | 'ncx' | 'spine'
}

export interface NavigationItem {
  readonly children: readonly NavigationItem[]
  readonly href: string
  readonly id: string
  readonly label: string
  readonly normalizedTarget: string | null
  readonly sources: readonly NavigationSourceRef[]
}

export interface NavigationModel {
  readonly alternateItems: readonly NavigationItem[]
  readonly items: readonly NavigationItem[]
  readonly source: 'nav' | 'ncx' | 'spine'
}

export interface PackageDocument {
  readonly epubVersion: '2' | '3' | 'unknown'
  readonly manifest: ReadonlyMap<string, ManifestItem>
  readonly packagePath: string
  readonly spine: readonly SpineItem[]
  readonly spineTocId: string | null
  readonly title: string
}

export interface EpubPublication {
  readonly archive: EpubArchive
  readonly chapters: readonly ChapterDocument[]
  readonly epubVersion: '2' | '3' | 'unknown'
  readonly fileName: string
  readonly issues: readonly EpubIssue[]
  readonly navigation: NavigationModel
  readonly packageDocument: PackageDocument
  readonly packagePath: string
}

export class EpubOpenError extends Error {
  readonly issues: readonly EpubIssue[]

  constructor(message: string, issues: readonly EpubIssue[]) {
    super(message)
    this.name = 'EpubOpenError'
    this.issues = issues
  }
}
