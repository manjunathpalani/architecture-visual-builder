import { Cloud, GitBranch, KeyRound, Settings, Ticket, X } from 'lucide-react'
import { AiEnginesPanel } from './AiEnginesPanel'
import { GitIntegrationsPanel, type IntegrationSection } from './GitIntegrationsPanel'
import { countSavedKeys } from '../utils/aiProviders'
import { isAzureDevOpsConnected, isGitHubConnected, isJiraConnected } from '../utils/gitCredentials'
import { isCloudConnected } from '../utils/cloud/cloudCredentials'

export type SettingsTab = 'ai' | 'git' | 'jira' | 'cloud'

interface SettingsPanelProps {
  tab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
  onClose: () => void
}

const TABS: Array<{ id: SettingsTab; label: string; hint: string; icon: typeof Settings }> = [
  { id: 'ai', label: 'AI engines', hint: 'Keys and default model', icon: KeyRound },
  { id: 'git', label: 'Git', hint: 'GitHub and Azure DevOps', icon: GitBranch },
  { id: 'jira', label: 'Jira', hint: 'Work item linking', icon: Ticket },
  { id: 'cloud', label: 'Cloud storage', hint: 'OneDrive, SharePoint, Google, iCloud', icon: Cloud },
]

export function SettingsPanel({ tab, onTabChange, onClose }: SettingsPanelProps) {
  const gitOn = isGitHubConnected() || isAzureDevOpsConnected()
  const jiraOn = isJiraConnected()
  const cloudOn = isCloudConnected()
  const keyCount = countSavedKeys()

  const badge = (id: SettingsTab): string | null => {
    if (id === 'ai') return keyCount > 0 ? String(keyCount) : null
    if (id === 'git') return gitOn ? 'On' : null
    if (id === 'jira') return jiraOn ? 'On' : null
    if (id === 'cloud') return cloudOn ? 'On' : null
    return null
  }

  return (
    <div className="git-int-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="settings-title">
        <div className="settings-header">
          <div>
            <h2 id="settings-title">
              <Settings size={18} />
              Settings
            </h2>
            <p>AI keys, Git, Jira, and cloud storage — kept in this browser.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings sections">
            {TABS.map((item) => {
              const Icon = item.icon
              const mark = badge(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-nav-btn ${tab === item.id ? 'active' : ''}`}
                  onClick={() => onTabChange(item.id)}
                >
                  <Icon size={16} />
                  <span>
                    <strong>{item.label}</strong>
                    <em>{item.hint}</em>
                  </span>
                  {mark && <span className="git-connected-badge">{mark}</span>}
                </button>
              )
            })}
          </nav>

          <div className="settings-body">
            {tab === 'ai' && <AiEnginesPanel embedded />}
            {tab !== 'ai' && (
              <GitIntegrationsPanel embedded section={tab as IntegrationSection} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
