import { useEffect, useState } from 'react'
import { Check, ExternalLink, KeyRound, Sparkles, X } from 'lucide-react'
import {
  AI_PROVIDERS,
  countSavedKeys,
  loadAiSettings,
  saveAiSettings,
  type AiProviderId,
  type StoredAiSettings,
} from '../utils/aiProviders'
import { fetchAiStatus, type AiStatus } from '../utils/aiDiagram'

interface AiEnginesPanelProps {
  onClose: () => void
}

export function AiEnginesPanel({ onClose }: AiEnginesPanelProps) {
  const [settings, setSettings] = useState<StoredAiSettings>(loadAiSettings)
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void fetchAiStatus().then(setStatus)
  }, [])

  const update = (patch: Partial<StoredAiSettings>) => {
    const next: StoredAiSettings = {
      ...settings,
      ...patch,
      keys: { ...settings.keys, ...patch.keys },
    }
    setSettings(next)
    saveAiSettings(next)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }

  const serverConfigured = (id: AiProviderId) =>
    Boolean(status?.providers.find((p) => p.id === id)?.configured)

  return (
    <div className="git-int-overlay" onClick={onClose}>
      <div className="git-int-panel ai-engines-panel" onClick={(e) => e.stopPropagation()}>
        <div className="git-int-header">
          <div>
            <h2>
              <KeyRound size={20} />
              AI Engines
            </h2>
            <p>
              Save API keys for SpaceXAI, OpenAI, Anthropic, Gemini, and Azure OpenAI. SpaceXAI is
              the default. Keys stay in this browser and are sent only to the local Vite proxy.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="ai-engines-toolbar">
          <label>
            Default engine
            <select
              value={settings.selectedProvider}
              onChange={(e) => update({ selectedProvider: e.target.value as AiProviderId })}
            >
              {AI_PROVIDERS.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                  {provider.recommended ? ' (recommended)' : ''}
                </option>
              ))}
            </select>
          </label>
          <span className="ai-engines-count">
            {countSavedKeys()} browser key{countSavedKeys() === 1 ? '' : 's'} saved
            {saved && (
              <em>
                <Check size={13} /> Saved
              </em>
            )}
          </span>
        </div>

        <div className="git-int-grid ai-engines-grid">
          {AI_PROVIDERS.map((provider) => {
            const onServer = serverConfigured(provider.id)
            const model = status?.providers.find((p) => p.id === provider.id)?.model ?? provider.defaultModel
            return (
              <section key={provider.id} className="git-int-card">
                <div className="git-int-card-title">
                  <Sparkles size={18} />
                  <h3>{provider.label}</h3>
                  {provider.recommended && <span className="git-connected-badge">Default</span>}
                  {onServer && <span className="git-connected-badge">Server key</span>}
                </div>
                <p className="code-link-hint">{provider.description}</p>
                <p className="code-link-hint">
                  Model <code>{model}</code> · env <code>{provider.envKey}</code>
                </p>
                <label>
                  {provider.keyLabel}
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={onServer ? 'Using server key (optional override)' : provider.keyPlaceholder}
                    value={settings.keys[provider.id] ?? ''}
                    onChange={(e) =>
                      update({ keys: { [provider.id]: e.target.value } })
                    }
                  />
                </label>
                {provider.id === 'azure-openai' && (
                  <>
                    <label>
                      Endpoint
                      <input
                        placeholder="https://your-resource.openai.azure.com"
                        value={settings.azureEndpoint ?? ''}
                        onChange={(e) => update({ azureEndpoint: e.target.value })}
                      />
                    </label>
                    <label>
                      Deployment name
                      <input
                        placeholder="gpt-4o"
                        value={settings.azureDeployment ?? ''}
                        onChange={(e) => update({ azureDeployment: e.target.value })}
                      />
                    </label>
                  </>
                )}
                <a className="ai-key-link" href={provider.keyUrl} target="_blank" rel="noreferrer">
                  Get a key
                  <ExternalLink size={12} />
                </a>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
