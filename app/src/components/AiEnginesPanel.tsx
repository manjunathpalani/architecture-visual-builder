import { useEffect, useState } from 'react'
import { Check, ExternalLink, KeyRound, Loader2, Sparkles, X } from 'lucide-react'
import {
  AI_PROVIDERS,
  countSavedKeys,
  loadAiSettings,
  saveAiSettings,
  type AiKeyTest,
  type AiProviderId,
  type StoredAiSettings,
} from '../utils/aiProviders'
import { fetchAiStatus, verifyAiKey, type AiStatus } from '../utils/aiDiagram'

interface AiEnginesPanelProps {
  onClose?: () => void
  embedded?: boolean
}

export function AiEnginesPanel({ onClose, embedded = false }: AiEnginesPanelProps) {
  const [saved, setSaved] = useState<StoredAiSettings>(loadAiSettings)
  const [drafts, setDrafts] = useState<StoredAiSettings>(loadAiSettings)
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [testing, setTesting] = useState<AiProviderId | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    void fetchAiStatus().then(setStatus)
  }, [])

  const persist = (next: StoredAiSettings) => {
    setSaved(next)
    setDrafts((prev) => ({
      ...prev,
      selectedProvider: next.selectedProvider,
      keys: { ...prev.keys, ...next.keys },
      azureEndpoint: next.azureEndpoint,
      azureDeployment: next.azureDeployment,
      keyTests: next.keyTests,
    }))
    saveAiSettings(next)
  }

  const updateDraft = (patch: Partial<StoredAiSettings>) => {
    setDrafts((prev) => ({
      ...prev,
      ...patch,
      keys: { ...prev.keys, ...patch.keys },
      keyTests: patch.keyTests ? { ...prev.keyTests, ...patch.keyTests } : prev.keyTests,
    }))
  }

  const setDefaultEngine = (id: AiProviderId) => {
    const next = { ...saved, selectedProvider: id, keys: saved.keys, keyTests: saved.keyTests }
    persist(next)
    setFlash('Default engine saved')
    window.setTimeout(() => setFlash(null), 1600)
  }

  const saveAndTest = async (id: AiProviderId) => {
    const info = AI_PROVIDERS.find((p) => p.id === id)
    const draftKey = drafts.keys[id]?.trim() ?? ''
    const onServer = Boolean(status?.providers.find((p) => p.id === id)?.configured)

    if (!draftKey && !onServer) {
      const next: StoredAiSettings = {
        ...saved,
        selectedProvider: drafts.selectedProvider,
        keys: { ...saved.keys, [id]: '' },
        azureEndpoint: drafts.azureEndpoint,
        azureDeployment: drafts.azureDeployment,
        keyTests: { ...saved.keyTests, [id]: undefined },
      }
      persist(next)
      setFlash(`${info?.shortLabel ?? id} key cleared`)
      window.setTimeout(() => setFlash(null), 1600)
      return
    }

    setTesting(id)
    const result = await verifyAiKey({
      provider: id,
      apiKey: draftKey || undefined,
      useServer: !draftKey && onServer,
      azureEndpoint: drafts.azureEndpoint,
      azureDeployment: drafts.azureDeployment,
    })
    setTesting(null)

    const test: AiKeyTest = {
      ok: result.ok,
      message: result.message,
      testedAt: new Date().toISOString(),
      source: result.source,
    }

    if (!result.ok) {
      setDrafts((prev) => ({ ...prev, keyTests: { ...prev.keyTests, [id]: test } }))
      saveAiSettings({
        ...saved,
        keyTests: { ...saved.keyTests, [id]: test },
      })
      setSaved((prev) => ({ ...prev, keyTests: { ...prev.keyTests, [id]: test } }))
      return
    }

    persist({
      ...saved,
      selectedProvider: drafts.selectedProvider,
      keys: { ...saved.keys, [id]: draftKey },
      azureEndpoint: drafts.azureEndpoint,
      azureDeployment: drafts.azureDeployment,
      keyTests: { ...saved.keyTests, [id]: test },
    })
    setFlash(result.message)
    window.setTimeout(() => setFlash(null), 2200)
  }

  const serverConfigured = (id: AiProviderId) =>
    Boolean(status?.providers.find((p) => p.id === id)?.configured)

  const body = (
    <>
      {!embedded && (
        <div className="git-int-header">
          <div>
            <h2>
              <KeyRound size={20} />
              AI Engines
            </h2>
            <p>
              Paste a key and click Save &amp; test. We call the provider to confirm the key before
              keeping it. Keys stay in this browser and are sent only to the local Vite proxy.
            </p>
          </div>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>
      )}
      {embedded && (
        <p className="settings-lead">
          Paste a key and click Save &amp; test. Keys stay in this browser and are sent only to the local Vite proxy.
        </p>
      )}

        <div className="ai-engines-toolbar">
          <label>
            Default engine
            <select
              value={saved.selectedProvider}
              onChange={(e) => setDefaultEngine(e.target.value as AiProviderId)}
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
            {flash && (
              <em>
                <Check size={13} /> {flash}
              </em>
            )}
          </span>
        </div>

        <div className="git-int-grid ai-engines-grid">
          {AI_PROVIDERS.map((provider) => {
            const onServer = serverConfigured(provider.id)
            const model = status?.providers.find((p) => p.id === provider.id)?.model ?? provider.defaultModel
            const test = drafts.keyTests?.[provider.id]
            const busy = testing === provider.id
            const draftKey = drafts.keys[provider.id] ?? ''
            const canTest = Boolean(draftKey.trim()) || onServer
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
                    value={draftKey}
                    onChange={(e) =>
                      updateDraft({
                        keys: { [provider.id]: e.target.value },
                        keyTests: { [provider.id]: undefined },
                      })
                    }
                    disabled={busy}
                  />
                </label>
                {provider.id === 'azure-openai' && (
                  <>
                    <label>
                      Endpoint
                      <input
                        placeholder="https://your-resource.openai.azure.com"
                        value={drafts.azureEndpoint ?? ''}
                        onChange={(e) =>
                          updateDraft({
                            azureEndpoint: e.target.value,
                            keyTests: { 'azure-openai': undefined },
                          })
                        }
                        disabled={busy}
                      />
                    </label>
                    <label>
                      Deployment name
                      <input
                        placeholder="gpt-4o"
                        value={drafts.azureDeployment ?? ''}
                        onChange={(e) =>
                          updateDraft({
                            azureDeployment: e.target.value,
                            keyTests: { 'azure-openai': undefined },
                          })
                        }
                        disabled={busy}
                      />
                    </label>
                  </>
                )}
                <div className="ai-key-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy || !canTest}
                    onClick={() => void saveAndTest(provider.id)}
                  >
                    {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                    {busy ? 'Testing…' : draftKey.trim() ? 'Save & test' : 'Test server key'}
                  </button>
                  {draftKey.trim() && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() => {
                        persist({
                          ...saved,
                          keys: { ...saved.keys, [provider.id]: '' },
                          azureEndpoint: drafts.azureEndpoint,
                          azureDeployment: drafts.azureDeployment,
                          keyTests: { ...saved.keyTests, [provider.id]: undefined },
                        })
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {test && (
                  <p className={`ai-key-status ${test.ok ? 'ok' : 'err'}`}>
                    {test.ok ? <Check size={13} /> : <X size={13} />}
                    {test.message}
                  </p>
                )}
                <a className="ai-key-link" href={provider.keyUrl} target="_blank" rel="noreferrer">
                  Get a key
                  <ExternalLink size={12} />
                </a>
              </section>
            )
          })}
        </div>
    </>
  )

  if (embedded) return <div className="settings-embed ai-engines-panel">{body}</div>

  return (
    <div className="git-int-overlay" onClick={onClose}>
      <div className="git-int-panel ai-engines-panel" onClick={(e) => e.stopPropagation()}>
        {body}
      </div>
    </div>
  )
}
