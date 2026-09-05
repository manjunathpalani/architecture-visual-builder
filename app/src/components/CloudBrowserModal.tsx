import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ChevronRight, Cloud, FolderOpen, HardDrive, Loader2, X } from 'lucide-react'
import {
  getGoogleBucket,
  isGoogleConnected,
  isICloudConnected,
  isMicrosoftConnected,
} from '../utils/cloud/cloudCredentials'
import { CloudApiError } from '../utils/cloud/oauth'
import {
  listOneDriveChildren,
  listSharePointChildren,
  listSharePointSites,
  readOneDriveFile,
  readSharePointFile,
} from '../utils/cloud/microsoftGraph'
import {
  listGcsObjects,
  listGoogleDriveChildren,
  readGcsObject,
  readGoogleDriveFile,
} from '../utils/cloud/googleCloud'
import { listICloudChildren, readICloudFile } from '../utils/cloud/icloudFolder'
import type { CloudItem, CloudSelection, CloudStoreId } from '../utils/cloud/types'

type BrowserMode = 'open' | 'save'

interface CloudBrowserModalProps {
  mode: BrowserMode
  suggestedName: string
  onClose: () => void
  onOpen: (content: string, selection: CloudSelection) => void
  onSave: (selection: CloudSelection) => Promise<void>
}

interface Crumb {
  name: string
  id?: string
}

export function CloudBrowserModal({ mode, suggestedName, onClose, onOpen, onSave }: CloudBrowserModalProps) {
  const [store, setStore] = useState<CloudStoreId>(firstConnectedStore())
  const [items, setItems] = useState<CloudItem[]>([])
  const [crumbs, setCrumbs] = useState<Crumb[]>([])
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([])
  const [siteId, setSiteId] = useState('')
  const [fileName, setFileName] = useState(suggestedName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const enabled =
      (store === 'onedrive' || store === 'sharepoint') && isMicrosoftConnected() ||
      (store === 'google-drive' || store === 'gcs') && isGoogleConnected() ||
      store === 'icloud' && isICloudConnected()
    if (!enabled) {
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const folderId = crumbs[crumbs.length - 1]?.id
      const path = crumbs.map((c) => c.name)
      if (store === 'onedrive') {
        setItems(await listOneDriveChildren(folderId))
      } else if (store === 'sharepoint') {
        if (!siteId) {
          const listed = await listSharePointSites()
          setSites(listed)
          if (listed[0]) setSiteId(listed[0].id)
          setItems([])
        } else {
          setItems(await listSharePointChildren(siteId, folderId))
        }
      } else if (store === 'google-drive') {
        setItems(await listGoogleDriveChildren(folderId))
      } else if (store === 'gcs') {
        setItems(await listGcsObjects(path.join('/')))
      } else {
        setItems(await listICloudChildren(path))
      }
    } catch (err) {
      setItems([])
      setError(err instanceof CloudApiError ? err.message : 'Could not list files')
    } finally {
      setLoading(false)
    }
  }, [store, crumbs, siteId])

  useEffect(() => {
    void load()
  }, [load])

  const openFolder = (item: CloudItem) => {
    setCrumbs((prev) => [...prev, { name: item.name, id: item.id }])
  }

  const goRoot = () => setCrumbs([])
  const goUpTo = (index: number) => {
    setCrumbs((prev) => prev.slice(0, index + 1))
  }

  const selection = (): CloudSelection => ({
    store,
    path: crumbs.map((c) => c.name).join('/'),
    fileName,
    folderId: crumbs[crumbs.length - 1]?.id,
    siteId: store === 'sharepoint' ? siteId : undefined,
    bucket: store === 'gcs' ? getGoogleBucket() : undefined,
  })

  const handleOpenItem = async (item: CloudItem) => {
    if (item.isFolder) {
      openFolder(item)
      return
    }
    if (mode !== 'open' || !item.name.toLowerCase().endsWith('.json')) return
    setLoading(true)
    setError(null)
    try {
      const content = await readFile(store, item, siteId, crumbs.map((c) => c.name))
      onOpen(content, { ...selection(), fileName: item.name, fileId: item.id })
    } catch (err) {
      setError(err instanceof CloudApiError ? err.message : 'Could not open file')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    const name = fileName.trim().endsWith('.json') ? fileName.trim() : `${fileName.trim()}.json`
    if (!name || name === '.json') return
    setSaving(true)
    setError(null)
    try {
      await onSave({ ...selection(), fileName: name })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="repo-browser-overlay">
      <div className="repo-browser work-item-browser">
        <div className="repo-browser-header">
          <div>
            <h2>{mode === 'open' ? 'Open from cloud' : 'Save to cloud'}</h2>
            <p>
              {mode === 'open'
                ? 'Sign in under Settings → Cloud storage, then pick an architecture JSON file.'
                : 'Choose a folder. The project JSON is written there.'}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="repo-browser-providers">
          <StoreTab id="onedrive" label="OneDrive" icon={<Cloud size={16} />} store={store} enabled={isMicrosoftConnected()} onSelect={setStore} reset={() => setCrumbs([])} />
          <StoreTab id="sharepoint" label="SharePoint" icon={<Cloud size={16} />} store={store} enabled={isMicrosoftConnected()} onSelect={setStore} reset={() => { setCrumbs([]); setSiteId('') }} />
          <StoreTab id="google-drive" label="Google Drive" icon={<HardDrive size={16} />} store={store} enabled={isGoogleConnected()} onSelect={setStore} reset={() => setCrumbs([])} />
          <StoreTab id="gcs" label="Google Cloud" icon={<HardDrive size={16} />} store={store} enabled={isGoogleConnected() && Boolean(getGoogleBucket())} onSelect={setStore} reset={() => setCrumbs([])} />
          <StoreTab id="icloud" label="iCloud" icon={<FolderOpen size={16} />} store={store} enabled={isICloudConnected()} onSelect={setStore} reset={() => setCrumbs([])} />
        </div>

        {!isMicrosoftConnected() && !isGoogleConnected() && !isICloudConnected() && (
          <p className="repo-browser-warn">
            Sign in under Settings → Cloud storage (Microsoft, Google, or an iCloud Drive folder) before opening or saving.
          </p>
        )}

        {store === 'sharepoint' && (
          <div className="work-item-toolbar">
            <label>
              SharePoint site
              <select
                value={siteId}
                onChange={(e) => {
                  setSiteId(e.target.value)
                  setCrumbs([])
                }}
              >
                {sites.length === 0 && <option value="">No sites found</option>}
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="repo-breadcrumb cloud-breadcrumb">
          <button type="button" onClick={goRoot}>
            root
          </button>
          {crumbs.map((part, index) => (
            <span key={`${part.name}-${index}`}>
              <ChevronRight size={12} />
              <button type="button" onClick={() => goUpTo(index)}>
                {part.name}
              </button>
            </span>
          ))}
        </div>

        {error && <p className="git-status err">{error}</p>}

        <div className="work-item-results">
          {loading && <Loader2 size={18} className="spin" />}
          {!loading &&
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="work-item-result"
                onClick={() => void handleOpenItem(item)}
              >
                <strong>{item.isFolder ? 'Folder' : 'File'}</strong>
                <span>{item.name}</span>
                <em>{item.isFolder ? 'Open' : mode === 'open' ? 'Load' : ''}</em>
              </button>
            ))}
          {!loading && items.length === 0 && !error && <p className="work-item-empty">This folder is empty.</p>}
        </div>

        {mode === 'save' && (
          <div className="cloud-save-bar">
            <label>
              File name
              <input value={fileName} onChange={(e) => setFileName(e.target.value)} />
            </label>
            <button type="button" className="btn-primary" disabled={saving || !fileName.trim()} onClick={() => void handleSave()}>
              {saving ? <Loader2 size={14} className="spin" /> : null}
              Save here
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function StoreTab({
  id,
  label,
  icon,
  store,
  enabled,
  onSelect,
  reset,
}: {
  id: CloudStoreId
  label: string
  icon: ReactNode
  store: CloudStoreId
  enabled: boolean
  onSelect: (id: CloudStoreId) => void
  reset: () => void
}) {
  return (
    <button
      type="button"
      className={`provider-btn ${store === id ? 'active' : ''}`}
      disabled={!enabled}
      onClick={() => {
        onSelect(id)
        reset()
      }}
    >
      {icon} {label}
    </button>
  )
}

function firstConnectedStore(): CloudStoreId {
  if (isMicrosoftConnected()) return 'onedrive'
  if (isGoogleConnected()) return 'google-drive'
  return 'icloud'
}

async function readFile(store: CloudStoreId, item: CloudItem, siteId: string, path: string[]): Promise<string> {
  if (store === 'onedrive') return readOneDriveFile(item.id)
  if (store === 'sharepoint') return readSharePointFile(siteId, item.id)
  if (store === 'google-drive') return readGoogleDriveFile(item.id)
  if (store === 'gcs') return readGcsObject(item.id)
  return readICloudFile([...path, item.name])
}
