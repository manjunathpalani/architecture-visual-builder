import { useState } from 'react'
import { Check, Cloud, Code2, Loader2, Ticket, X } from 'lucide-react'
import {
  getAzureDevOpsCredentials,
  getGitHubCredentials,
  getJiraCredentials,
  isAzureDevOpsConnected,
  isGitHubConnected,
  isJiraConnected,
  setAzureDevOpsCredentials,
  setGitHubCredentials,
  setJiraCredentials,
} from '../utils/gitCredentials'
import { testAzureDevOpsConnection } from '../utils/gitProviders/azureDevOpsApi'
import { testGitHubConnection } from '../utils/gitProviders/githubApi'
import { testJiraConnection } from '../utils/alm/jiraApi'
import { GitApiError } from '../utils/gitProviders/apiClient'
import { CloudStorageSection } from './CloudStorageSection'

export type IntegrationSection = 'git' | 'jira' | 'cloud' | 'all'

interface GitIntegrationsPanelProps {
  onClose?: () => void
  embedded?: boolean
  section?: IntegrationSection
}

export function GitIntegrationsPanel({
  onClose,
  embedded = false,
  section = 'all',
}: GitIntegrationsPanelProps) {
  const ghCreds = getGitHubCredentials()
  const azCreds = getAzureDevOpsCredentials()
  const jiraCreds = getJiraCredentials()

  const [ghToken, setGhToken] = useState(ghCreds?.token ?? '')
  const [azOrg, setAzOrg] = useState(azCreds?.organization ?? '')
  const [azToken, setAzToken] = useState(azCreds?.token ?? '')
  const [jiraSite, setJiraSite] = useState(jiraCreds?.site ?? '')
  const [jiraEmail, setJiraEmail] = useState(jiraCreds?.email ?? '')
  const [jiraToken, setJiraToken] = useState(jiraCreds?.token ?? '')
  const [ghStatus, setGhStatus] = useState<string | null>(null)
  const [azStatus, setAzStatus] = useState<string | null>(null)
  const [jiraStatus, setJiraStatus] = useState<string | null>(null)
  const [ghLoading, setGhLoading] = useState(false)
  const [azLoading, setAzLoading] = useState(false)
  const [jiraLoading, setJiraLoading] = useState(false)

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

  const connectJira = async () => {
    setJiraLoading(true)
    setJiraStatus(null)
    setJiraCredentials({ site: jiraSite, email: jiraEmail, token: jiraToken })
    try {
      const { displayName, site } = await testJiraConnection()
      setJiraStatus(`Connected to ${site} as ${displayName}`)
    } catch (err) {
      setJiraCredentials(null)
      setJiraStatus(err instanceof GitApiError ? err.message : 'Connection failed')
    } finally {
      setJiraLoading(false)
    }
  }

  const showGit = section === 'all' || section === 'git'
  const showJira = section === 'all' || section === 'jira'
  const showCloud = section === 'all' || section === 'cloud'

  const body = (
    <>
      {!embedded && (
        <div className="git-int-header">
          <div>
            <h2>Integrations</h2>
            <p>Sign in to cloud storage, Git, and Jira to save projects and link work items</p>
          </div>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>
      )}

      {(showGit || showJira) && (
        <div className={`git-int-grid ${showGit && showJira ? 'git-int-grid-3' : showGit ? 'git-int-grid' : ''}`}>
          {showGit && (
            <>
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
              Organization + PAT with <code>Code (read & write)</code> and <code>Work Items (Read)</code> to sync repos and link work items.
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
            </>
          )}

          {showJira && (
          <section className="git-int-card">
            <div className="git-int-card-title">
              <Ticket size={20} />
              <h3>Jira</h3>
              {isJiraConnected() && (
                <span className="git-connected-badge">
                  <Check size={12} /> Connected
                </span>
              )}
            </div>
            <p className="git-int-desc">
              Jira Cloud site, account email, and an API token from{' '}
              <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer">
                Atlassian account settings
              </a>
              .
            </p>
            <label>
              Site
              <input
                placeholder="mycompany or mycompany.atlassian.net"
                value={jiraSite}
                onChange={(e) => setJiraSite(e.target.value)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                placeholder="you@company.com"
                value={jiraEmail}
                onChange={(e) => setJiraEmail(e.target.value)}
              />
            </label>
            <label>
              API token
              <input
                type="password"
                placeholder="Jira API token"
                value={jiraToken}
                onChange={(e) => setJiraToken(e.target.value)}
              />
            </label>
            <div className="git-int-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={!jiraSite || !jiraEmail || !jiraToken || jiraLoading}
                onClick={connectJira}
              >
                {jiraLoading ? <Loader2 size={14} className="spin" /> : null}
                Connect Jira
              </button>
              {isJiraConnected() && (
                <button
                  type="button"
                  className="btn-reset-color"
                  onClick={() => {
                    setJiraCredentials(null)
                    setJiraSite('')
                    setJiraEmail('')
                    setJiraToken('')
                    setJiraStatus('Disconnected')
                  }}
                >
                  Disconnect
                </button>
              )}
            </div>
            {jiraStatus && (
              <p className={`git-status ${jiraStatus.includes('Connected') ? 'ok' : 'err'}`}>{jiraStatus}</p>
            )}
          </section>
        )}
        </div>
      )}

      {showCloud && <CloudStorageSection />}

      {(showCloud || !embedded) && (
      <div className="git-int-footer">
        <p>
          Access tokens stay in this browser only. For Microsoft and Google, register an OAuth app and use redirect{' '}
          <code>{typeof window !== 'undefined' ? `${window.location.origin}/oauth/callback` : '/oauth/callback'}</code>.
          Never commit client secrets or PATs.
        </p>
      </div>
      )}
    </>
  )

  if (embedded) return <div className="settings-embed">{body}</div>

  return (
    <div className="git-int-overlay">
      <div className="git-int-panel git-int-panel-wide">{body}</div>
    </div>
  )
}
