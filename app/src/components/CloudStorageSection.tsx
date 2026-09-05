import { useState } from 'react'
import { Check, Cloud, FolderOpen, HardDrive, Loader2 } from 'lucide-react'
import {
  defaultGoogleClientId,
  defaultMicrosoftClientId,
  getGoogleBucket,
  getICloudMeta,
  googleAccountLabel,
  isGoogleConnected,
  isICloudConnected,
  isMicrosoftConnected,
  microsoftAccountLabel,
  setGoogleBucket,
  setGoogleClientId,
  setGoogleTokens,
  setMicrosoftClientId,
  setMicrosoftTokens,
} from '../utils/cloud/cloudCredentials'
import { CloudApiError, signInWithGoogle, signInWithMicrosoft } from '../utils/cloud/oauth'
import { testMicrosoftConnection } from '../utils/cloud/microsoftGraph'
import { testGoogleConnection } from '../utils/cloud/googleCloud'
import { canUseFolderPicker, connectICloudFolder, disconnectICloudFolder } from '../utils/cloud/icloudFolder'

export function CloudStorageSection() {
  const [msClientId, setMsClientId] = useState(defaultMicrosoftClientId)
  const [googleClientId, setGoogleId] = useState(defaultGoogleClientId)
  const [bucket, setBucket] = useState(getGoogleBucket())
  const [includeGcs, setIncludeGcs] = useState(Boolean(getGoogleBucket()))
  const [msStatus, setMsStatus] = useState<string | null>(null)
  const [googleStatus, setGoogleStatus] = useState<string | null>(null)
  const [icloudStatus, setIcloudStatus] = useState<string | null>(null)
  const [msLoading, setMsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [icloudLoading, setIcloudLoading] = useState(false)

  const connectMicrosoft = async () => {
    setMsLoading(true)
    setMsStatus(null)
    setMicrosoftClientId(msClientId)
    try {
      await signInWithMicrosoft(msClientId)
      const { name, email } = await testMicrosoftConnection()
      setMsStatus(`Connected as ${name}${email ? ` (${email})` : ''}`)
    } catch (err) {
      setMicrosoftTokens(null)
      setMsStatus(err instanceof CloudApiError ? err.message : 'Microsoft sign-in failed')
    } finally {
      setMsLoading(false)
    }
  }

  const connectGoogle = async () => {
    setGoogleLoading(true)
    setGoogleStatus(null)
    setGoogleClientId(googleClientId)
    setGoogleBucket(bucket)
    try {
      await signInWithGoogle(googleClientId, includeGcs)
      const { name, email } = await testGoogleConnection()
      setGoogleStatus(`Connected as ${name}${email ? ` (${email})` : ''}`)
    } catch (err) {
      setGoogleTokens(null)
      setGoogleStatus(err instanceof CloudApiError ? err.message : 'Google sign-in failed')
    } finally {
      setGoogleLoading(false)
    }
  }

  const connectICloud = async () => {
    setIcloudLoading(true)
    setIcloudStatus(null)
    try {
      const name = await connectICloudFolder()
      setIcloudStatus(`Granted access to “${name}”. Prefer an iCloud Drive folder.`)
    } catch (err) {
      setIcloudStatus(err instanceof CloudApiError ? err.message : 'Folder access failed')
    } finally {
      setIcloudLoading(false)
    }
  }

  return (
    <div className="cloud-storage-section">
      <div className="cloud-storage-heading">
        <h3>Cloud storage</h3>
        <p>Sign in so this project can be saved to OneDrive, SharePoint, Google Drive / Cloud Storage, or an iCloud Drive folder.</p>
      </div>
      <div className="git-int-grid git-int-grid-3">
        <section className="git-int-card">
          <div className="git-int-card-title">
            <Cloud size={20} />
            <h3>Microsoft 365</h3>
            {isMicrosoftConnected() && (
              <span className="git-connected-badge">
                <Check size={12} /> {microsoftAccountLabel()}
              </span>
            )}
          </div>
          <p className="git-int-desc">
            Sign in with a work, school, or personal Microsoft account for <strong>OneDrive</strong> and{' '}
            <strong>SharePoint</strong>. Register a SPA app and add redirect{' '}
            <code>{typeof window !== 'undefined' ? `${window.location.origin}/oauth/callback` : '/oauth/callback'}</code>.
          </p>
          <label>
            Application (client) ID
            <input
              placeholder="Azure AD / Entra app ID"
              value={msClientId}
              onChange={(e) => setMsClientId(e.target.value)}
            />
          </label>
          <div className="git-int-actions">
            <button type="button" className="btn-primary" disabled={!msClientId.trim() || msLoading} onClick={() => void connectMicrosoft()}>
              {msLoading ? <Loader2 size={14} className="spin" /> : null}
              Sign in to Microsoft
            </button>
            {isMicrosoftConnected() && (
              <button
                type="button"
                className="btn-reset-color"
                onClick={() => {
                  setMicrosoftTokens(null)
                  setMsStatus('Disconnected')
                }}
              >
                Disconnect
              </button>
            )}
          </div>
          {msStatus && <p className={`git-status ${msStatus.includes('Connected') ? 'ok' : 'err'}`}>{msStatus}</p>}
        </section>

        <section className="git-int-card">
          <div className="git-int-card-title">
            <HardDrive size={20} />
            <h3>Google</h3>
            {isGoogleConnected() && (
              <span className="git-connected-badge">
                <Check size={12} /> {googleAccountLabel()}
              </span>
            )}
          </div>
          <p className="git-int-desc">
            Sign in with Google for <strong>Google Drive</strong>. Optionally allow <strong>Cloud Storage</strong> buckets.
            Authorized origin and redirect must be this app URL + <code>/oauth/callback</code>.
          </p>
          <label>
            OAuth client ID
            <input
              placeholder="xxxx.apps.googleusercontent.com"
              value={googleClientId}
              onChange={(e) => setGoogleId(e.target.value)}
            />
          </label>
          <label className="cloud-check">
            <input type="checkbox" checked={includeGcs} onChange={(e) => setIncludeGcs(e.target.checked)} />
            Also request Google Cloud Storage access
          </label>
          {includeGcs && (
            <label>
              GCS bucket
              <input
                placeholder="my-architecture-bucket"
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
              />
            </label>
          )}
          <div className="git-int-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={!googleClientId.trim() || googleLoading}
              onClick={() => void connectGoogle()}
            >
              {googleLoading ? <Loader2 size={14} className="spin" /> : null}
              Sign in with Google
            </button>
            {isGoogleConnected() && (
              <button
                type="button"
                className="btn-reset-color"
                onClick={() => {
                  setGoogleTokens(null)
                  setGoogleStatus('Disconnected')
                }}
              >
                Disconnect
              </button>
            )}
          </div>
          {googleStatus && (
            <p className={`git-status ${googleStatus.includes('Connected') ? 'ok' : 'err'}`}>{googleStatus}</p>
          )}
        </section>

        <section className="git-int-card">
          <div className="git-int-card-title">
            <FolderOpen size={20} />
            <h3>iCloud Drive</h3>
            {isICloudConnected() && (
              <span className="git-connected-badge">
                <Check size={12} /> {getICloudMeta()?.name}
              </span>
            )}
          </div>
          <p className="git-int-desc">
            Apple does not let web apps sign in to iCloud Drive. Choose a local folder that syncs with iCloud Drive (Chrome or Edge). The browser will ask you to grant access.
          </p>
          {!canUseFolderPicker() && (
            <p className="git-status err">Folder access is not available in this browser. Use Chrome or Edge, or save JSON and copy it into iCloud Drive.</p>
          )}
          <div className="git-int-actions">
            <button type="button" className="btn-primary" disabled={!canUseFolderPicker() || icloudLoading} onClick={() => void connectICloud()}>
              {icloudLoading ? <Loader2 size={14} className="spin" /> : null}
              Choose iCloud folder
            </button>
            {isICloudConnected() && (
              <button
                type="button"
                className="btn-reset-color"
                onClick={() => {
                  void disconnectICloudFolder()
                  setIcloudStatus('Disconnected')
                }}
              >
                Disconnect
              </button>
            )}
          </div>
          {icloudStatus && (
            <p className={`git-status ${icloudStatus.toLowerCase().includes('grant') || icloudStatus.includes('“') ? 'ok' : 'err'}`}>
              {icloudStatus}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
