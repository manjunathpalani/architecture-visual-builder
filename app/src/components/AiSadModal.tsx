import { useEffect, useMemo, useState } from 'react'
import { FileText, KeyRound, Loader2, NotebookPen, Sparkles, X } from 'lucide-react'
import type { ArchitectureDocument } from '../types'
import { AI_PROVIDERS, getProvider, isEngineReady, loadAiSettings, type AiProviderId } from '../utils/aiProviders'
import { fetchAiStatus, type AiStatus } from '../utils/aiDiagram'
import { generateSadDraft, type SadDraft } from '../utils/aiSad'
import { buildArchitectureBrief } from '../utils/architectureNarrative'

interface AiSadModalProps {
  document: ArchitectureDocument
  exporting?: boolean
  onManageKeys: () => void
  onExport: (draft: SadDraft) => void
  onClose: () => void
}

export function AiSadModal({ document, exporting = false, onManageKeys, onExport, onClose }: AiSadModalProps) {
  const initial = loadAiSettings()
  const [provider, setProvider] = useState<AiProviderId>(initial.selectedProvider)
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<SadDraft | null>(null)

  useEffect(() => {
    void fetchAiStatus().then(setStatus)
  }, [])

  const info = getProvider(provider)
  const hasKey = isEngineReady(provider, status)
  const systemCount = document.systems.length
  const stats = useMemo(() => buildArchitectureBrief(document), [document])
  const canRun = hasKey && systemCount > 0 && !loading && !exporting

  const runWrite = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await generateSadDraft({
        document,
        notes,
        providerId: provider,
      })
      setDraft(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SAD writing failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="git-int-overlay">
      <div className="git-int-panel git-int-panel-wide ai-analysis-panel">
        <div className="git-int-header">
          <div>
            <h2>
              <NotebookPen size={18} /> Write SAD
            </h2>
            <p>
              Draft Solution Architecture Document content with {info.shortLabel}: narrative, NFRs, nested diagrams, and
              sequence flows.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="ai-analysis-toolbar">
          <label>
            Engine
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as AiProviderId)}
              disabled={loading || exporting}
            >
              {AI_PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.recommended ? ' (recommended)' : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="ai-sad-inventory">
            {stats.stats.systems} systems · {stats.stats.integrations} integrations · {stats.stats.subDiagrams} nested
            diagrams · {stats.sequenceFlows.length} sequence flows · {stats.nfrs.length} NFRs already inferred
          </p>
          <label className="ai-analysis-notes">
            Architect notes (optional)
            <input
              value={notes}
              placeholder="e.g. emphasize PCI, 99.9% API availability, include payment nested diagram"
              disabled={loading || exporting}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="ai-analysis-actions">
            <button type="button" className="btn-primary" disabled={!canRun} onClick={() => void runWrite()}>
              {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              {draft ? 'Rewrite SAD content' : 'Write SAD content'}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!draft || loading || exporting}
              onClick={() => draft && onExport(draft)}
            >
              {exporting ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
              {exporting ? 'Exporting Word SAD…' : 'Export Word SAD'}
            </button>
            <button type="button" className="btn-secondary" onClick={onManageKeys} disabled={loading || exporting}>
              <KeyRound size={14} />
              Settings
            </button>
          </div>
          {!hasKey && (
            <p className="git-status err">
              {provider === 'copilot'
                ? 'Sign in to GitHub Copilot in VS Code, or paste a GitHub token in Settings → AI engines.'
                : 'Add an AI key first — SpaceXAI is the default engine. Copilot works in VS Code without a key.'}
            </p>
          )}
          {systemCount === 0 && <p className="git-status err">Add systems to the canvas before writing a SAD.</p>}
          {error && <p className="git-status err">{error}</p>}
        </div>

        <div className="ai-analysis-body">
          {loading && !draft && (
            <div className="ai-analysis-empty">
              <Loader2 size={22} className="spin" />
              <p>Writing purpose, NFRs, nested-diagram coverage, and sequence flows…</p>
            </div>
          )}
          {!loading && !draft && !error && (
            <div className="ai-analysis-empty">
              <NotebookPen size={22} />
              <p>
                AI will add SAD narrative and quality attributes on top of the modelled landscape, including every
                sub-diagram and derived sequence flow.
              </p>
            </div>
          )}
          {draft && (
            <div className="ai-sad-preview">
              {draft.executiveSummary && (
                <section>
                  <h3>Executive summary</h3>
                  <p>{draft.executiveSummary}</p>
                </section>
              )}
              {draft.nfrs.length > 0 && (
                <section>
                  <h3>Non-functional requirements</h3>
                  <ul>
                    {draft.nfrs.map((item) => (
                      <li key={item.id}>
                        <strong>
                          {item.id} · {item.category}
                        </strong>
                        {' — '}
                        {item.requirement}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {draft.sequenceFlows.length > 0 && (
                <section>
                  <h3>Sequence flows</h3>
                  <ul>
                    {draft.sequenceFlows.map((flow) => (
                      <li key={flow.id}>
                        <strong>{flow.name}</strong>
                        <em>
                          {' '}
                          ({flow.viewPath} · {flow.steps.length} steps)
                        </em>
                        <div className="ai-sad-script">{flow.script}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {draft.risks.length > 0 && (
                <section>
                  <h3>Risks</h3>
                  <ul>
                    {draft.risks.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
              {draft.recommendations.length > 0 && (
                <section>
                  <h3>Recommendations</h3>
                  <ul>
                    {draft.recommendations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
