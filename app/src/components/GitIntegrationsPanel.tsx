import { useState } from 'react'
import { Check, Cloud, Code2, Loader2, X } from 'lucide-react'
import {
  getAzureDevOpsCredentials,
  getGitHubCredentials,
  isAzureDevOpsConnected,
  isGitHubConnected,
  setAzureDevOpsCredentials,
  setGitHubCredentials,
} from '../utils/gitCredentials'
import { testAzureDevOpsConnection } from '../utils/gitProviders/azureDevOpsApi'
import { testGitHubConnection } from '../utils/gitProviders/githubApi'
import { GitApiError } from '../utils/gitProviders/apiClient'

interface GitIntegrationsPanelProps {
  onClose: () => void
}

export function GitIntegrationsPanel({ onClose }: GitIntegrationsPanelProps) {
  const ghCreds = getGitHubCredentials()
  const azCreds = getAzureDevOpsCredentials()

  const [ghToken, setGhToken] = useState(ghCreds?.token ?? '')
  const [azOrg, setAzOrg] = useState(azCreds?.organization ?? '')
  const [azToken, setAzToken] = useState(azCreds?.token ?? '')
  const [ghStatus, setGhStatus] = useState<string | null>(null)
  const [azStatus, setAzStatus] = useState<string | null>(null)
  const [ghLoading, setGhLoading] = useState(false)
  const [azLoading, setAzLoading] = useState(false)

  const connectGitHub = async () => {
    setGhLoading(true)
    setGhStatus(null)
    setGitHubCredentials({ token: ghToken })
    try {
      const { username } = await testGitHubConnection()
      setGhStatus(`Connected as ${username}`)
    } catch (err) {
      setGitHubCredentials(null)
      setGhStatus(err instanceof GitApiError ? err.message : 'Connection failed')
    } finally {
      setGhLoading(false)
    }
  }

  const connectAzure = async () => {
    setAzLoading(true)
    setAzStatus(null)
    setAzureDevOpsCredentials({ organization: azOrg, token: azToken })
    try {
      const { organization } = await testAzureDevOpsConnection()
      setAzStatus(`Connected to ${organization}`)
    } catch (err) {
      setAzureDevOpsCredentials(null)
      setAzStatus(err instanceof GitApiError ? err.message : 'Connection failed')
    } finally {
      setAzLoading(false)
    }
  }

  return (
    <div className="git-int-overlay">
      <div className="git-int-panel">
        <div className="git-int-header">
          <div>
            <h2>Git Integrations</h2>
            <p>Connect GitHub and Azure DevOps to browse repos and sync architecture JSON</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="git-int-grid">
          <section className="git-int-card">
            <div className="git-int-card-title">
              <Code2 size={20} />
              <h3>GitHub</h3>
              {isGitHubConnected() && (
                <span className="git-connected-badge">
                  <Check size={12} /> Connected
                </span>
              )}
            </div>
            <p className="git-int-desc">
              Use a Personal Access Token with <code>repo</code> scope to browse repositories and push architecture files.
            </p>
            <label>
              Personal Access Token
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
              />
            </label>
            <div className="git-int-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={!ghToken || ghLoading}
                onClick={connectGitHub}
              >
                {ghLoading ? <Loader2 size={14} className="spin" /> : null}
                Connect GitHub
              </button>
              {isGitHubConnected() && (
                <button
                  type="button"
                  className="btn-reset-color"
                  onClick={() => {
                    setGitHubCredentials(null)
                    setGhToken('')
                    setGhStatus('Disconnected')
                  }}
                >
                  Disconnect
                </button>
              )}
            </div>
            {ghStatus && <p className={`git-status ${ghStatus.includes('Connected') ? 'ok' : 'err'}`}>{ghStatus}</p>}
          </section>

          <section className="git-int-card">
            <div className="git-int-card-title">
              <Cloud size={20} />
              <h3>Azure DevOps</h3>
              {isAzureDevOpsConnected() && (
                <span className="git-connected-badge">
                  <Check size={12} /> Connected
                </span>
              )}
            </div>
            <p className="git-int-desc">
              Use an organization name and PAT with <code>Code (read & write)</code> scope.
            </p>
            <label>
              Organization
              <input
                placeholder="my-organization"
                value={azOrg}
                onChange={(e) => setAzOrg(e.target.value)}
              />
            </label>
            <label>
              Personal Access Token
              <input
                type="password"
                placeholder="Azure DevOps PAT"
                value={azToken}
                onChange={(e) => setAzToken(e.target.value)}
              />
            </label>
            <div className="git-int-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={!azOrg || !azToken || azLoading}
                onClick={connectAzure}
              >
                {azLoading ? <Loader2 size={14} className="spin" /> : null}
                Connect Azure DevOps
              </button>
              {isAzureDevOpsConnected() && (
                <button
                  type="button"
                  className="btn-reset-color"
                  onClick={() => {
                    setAzureDevOpsCredentials(null)
                    setAzOrg('')
                    setAzToken('')
                    setAzStatus('Disconnected')
                  }}
                >
                  Disconnect
                </button>
              )}
            </div>
            {azStatus && <p className={`git-status ${azStatus.includes('Connected') ? 'ok' : 'err'}`}>{azStatus}</p>}
          </section>
        </div>

        <div className="git-int-footer">
          <p>Tokens are stored locally in your browser only. Never share PATs or commit them to source control.</p>
        </div>
      </div>
    </div>
  )
}