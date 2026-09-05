import { writeGcsObject, writeGoogleDriveFile } from './googleCloud'
import { writeICloudFile } from './icloudFolder'
import { writeOneDriveFile, writeSharePointFile } from './microsoftGraph'
import { CloudApiError } from './oauth'
import type { CloudSelection } from './types'

export async function writeCloudSelection(selection: CloudSelection, content: string): Promise<void> {
  if (selection.store === 'onedrive') {
    await writeOneDriveFile(selection.folderId, selection.fileName, content)
    return
  }
  if (selection.store === 'sharepoint') {
    if (!selection.siteId) throw new CloudApiError('Pick a SharePoint site.')
    await writeSharePointFile(selection.siteId, selection.folderId, selection.fileName, content)
    return
  }
  if (selection.store === 'google-drive') {
    await writeGoogleDriveFile(selection.folderId, selection.fileName, content)
    return
  }
  if (selection.store === 'gcs') {
    const prefix = selection.path ? `${selection.path.replace(/\/$/, '')}/` : ''
    await writeGcsObject(`${prefix}${selection.fileName}`, content)
    return
  }
  await writeICloudFile(selection.path ? selection.path.split('/') : [], selection.fileName, content)
}
