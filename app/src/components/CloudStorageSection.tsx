import { useEffect, useState } from 'react'
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
import {
  CloudApiError,
  openSignInWindow,
  peekPreparedLoginUrl,
  prefetchGoogleLogin,
  prefetchMicrosoftLogin,
  signInWithGoogle,
  signInWithMicrosoft,
} from '../utils/cloud/oauth'
import { loadOAuthAppConfig } from '../utils/cloud/oauthConfig'
import { testMicrosoftConnection } from '../utils/cloud/microsoftGraph'
import { testGoogleConnection } from '../utils/cloud/googleCloud'
import { canUseFolderPicker, connectICloudFolder, disconnectICloudFolder } from '../utils/cloud/icloudFolder'

export function CloudStorageSection() {
  const [msClientId, setMsClientId] = useState(defaultMicrosoftClientId())
  const [googleClientId, setGoogleClientIdState] = useState(defaultGoogleClientId())
  const [envMs, setEnvMs] = useState('')
  const [envGoogle, setEnvGoogle] = useState('')
  const [bucket, setBucket] = useState(getGoogleBucket())
  const [includeGcs, setIncludeGcs] = useState(Boolean(getGoogleBucket()))
  const [msStatus, setMsStatus] = useState<string | null>(null)
  const [googleStatus, setGoogleStatus] = useState<string | null>(null)
  const [icloudStatus, setIcloudStatus] = useState<string | null>(null)
  const [msLoading, setMsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [icloudLoading, setIcloudLoading] = useState(false)

  const showMsClientField = !envMs
  const showGoogleClientField = !envGoogle

  useEffect(() => {
    void loadOAuthAppConfig().then((config) => {
      setEnvMs(config.microsoftClientId)
      setEnvGoogle(config.googleClientId)
      if (config.microsoftClientId) setMsClientId(config.microsoftClientId)
      if (config.googleClientId) setGoogleClientIdState(config.googleClientId)
    })
  }, [])

  useEffect(() => {
    const id = (envMs || msClientId).trim()
    if (id) void prefetchMicrosoftLogin(id)
  }, [envMs, msClientId])

  useEffect(() => {
    const id = (envGoogle || googleClientId).trim()
    if (id) void prefetchGoogleLogin(id, includeGcs)
  }, [envGoogle, googleClientId, includeGcs])

  const connectMicrosoft = () => {
    const id = (envMs || msClientId).trim()
    if (!id) {
      setMsStatus('Add your Azure app (client) ID once. Continue with Microsoft then opens the Microsoft sign-in page.')
      return
    }
    setMicrosoftClientId(id)
    const preparedUrl = peekPreparedLoginUrl('microsoft', id)
    const popup = openSignInWindow(preparedUrl ?? 'about:blank')
    setMsLoading(true)
    setMsStatus(popup ? 'Opening Microsoft sign-in…' : 'Redirecting to Microsoft…')
    void (async () => {
      try {
        await signInWithMicrosoft(id, popup)
        const { name, email } = await testMicrosoftConnection()
        setMsStatus(`Connected as ${name}${email ? ` (${email})` : ''}`)
      } catch (err) {
        setMicrosoftTokens(null)
        setMsStatus(err instanceof CloudApiError ? err.message : 'Microsoft sign-in failed')
      } finally {
        setMsLoading(false)
      }
    })()
  }

  const connectGoogle = () => {
    const id = (envGoogle || googleClientId).trim()
    if (!id) {
      setGoogleStatus('Add your Google OAuth client ID once. Continue with Google then opens the Google sign-in page.')
      return
    }
    setGoogleClientId(id)
    setGoogleBucket(bucket)
    const preparedUrl = peekPreparedLoginUrl('google', id)
    const popup = openSignInWindow(preparedUrl ?? 'about:blank')
    setGoogleLoading(true)
    setGoogleStatus(popup ? 'Opening Google sign-in…' : 'Redirecting to Google…')
    void (async () => {
      try {
        await signInWithGoogle(id, includeGcs, popup)
        const { name, email } = await testGoogleConnection()
        setGoogleStatus(`Connected as ${name}${email ? ` (${email})` : ''}`)
      } catch (err) {
        setGoogleTokens(null)
        setGoogleStatus(err instanceof CloudApiError ? err.message : 'Google sign-in failed')
      } finally {
        setGoogleLoading(false)
      }
    })()
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
            Sign in with your Microsoft account to use <strong>OneDrive</strong> and <strong>SharePoint</strong>.
            {envMs ? ' A Microsoft login window opens — no app ID to type.' : ''}
          </p>
          {showMsClientField && (
            <label>
              Azure app (client) ID — one-time
              <input
                autoComplete="off"
                spellCheck={false}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={msClientId}
                onChange={(event) => {
                  setMsClientId(event.target.value)
                  setMicrosoftClientId(event.target.value)
                }}
              />
            </label>
          )}
          <div className="git-int-actions">
            <button type="button" className="btn-primary" disabled={msLoading} onClick={connectMicrosoft}>
              {msLoading ? <Loader2 size={14} className="spin" /> : null}
              Continue with Microsoft
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
          {msStatus && (
            <p className={`git-status ${statusTone(msStatus)}`}>{msStatus}</p>
          )}
          {showMsClientField && !isMicrosoftConnected() && (
            <p className="code-link-hint">
              This is an Azure app ID, not your password. After it is saved, Continue with Microsoft opens the
              Microsoft sign-in page (redirect{' '}
              <code>{typeof window !== 'undefined' ? `${window.location.origin}/oauth/callback` : '/oauth/callback'}</code>
              ).
            </p>
          )}
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
            Sign in with your Google account for <strong>Google Drive</strong>. Optionally allow{' '}
            <strong>Cloud Storage</strong> buckets.
          </p>
          {showGoogleClientField && (
            <label>
              Google OAuth client ID — one-time
              <input
                autoComplete="off"
                spellCheck={false}
                placeholder="xxxx.apps.googleusercontent.com"
                value={googleClientId}
                onChange={(event) => {
                  setGoogleClientIdState(event.target.value)
                  setGoogleClientId(event.target.value)
                }}
              />
            </label>
          )}
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
            <button type="button" className="btn-primary" disabled={googleLoading} onClick={connectGoogle}>
              {googleLoading ? <Loader2 size={14} className="spin" /> : null}
              Continue with Google
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
            <p className={`git-status ${statusTone(googleStatus)}`}>{googleStatus}</p>
          )}
          {showGoogleClientField && !isGoogleConnected() && (
            <p className="code-link-hint">
              This is a Google Cloud OAuth client ID, not your Google password. After it is saved, Continue with
              Google opens the Google sign-in page.
            </p>
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

function statusTone(message: string): string {
  if (message.includes('Connected')) return 'ok'
  if (message.startsWith('Opening') || message.startsWith('Redirecting')) return ''
  return 'err'
}
