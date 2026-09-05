export type CloudStoreId = 'onedrive' | 'sharepoint' | 'google-drive' | 'gcs' | 'icloud'

export interface CloudItem {
  id: string
  name: string
  isFolder: boolean
  mimeType?: string
}

export interface CloudSelection {
  store: CloudStoreId
  path: string
  fileName: string
  folderId?: string
  fileId?: string
  siteId?: string
  driveId?: string
  bucket?: string
}
