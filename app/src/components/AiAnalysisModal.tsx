import { useEffect, useState } from 'react'
import { Check, KeyRound, Loader2, Minus, Scale, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import type { ArchitectureDocument } from '../types'
import {
  AI_PROVIDERS,
  getProvider,
  loadAiSettings,
  type AiProviderId,
} from '../utils/aiProviders'
import { fetchAiStatus, type AiStatus } from '../utils/aiDiagram'
import {
  ANALYSIS_LENSES,
  analyzeArchitectureCapabilities,
  type AnalysisLensId,
  type AnalysisVerdict,
  type CapabilityAnalysis,
} from '../utils/aiAnalysis'

interface AiAnalysisModalProps {
  document: ArchitectureDocument
  focusLabel?: string
  onManageKeys: () => void
  onClose: () => void
}

const VERDICT_LABEL: Record<AnalysisVerdict, string> = {
  strong: 'Strong',
  balanced: 'Balanced',
  'at-risk': 'At risk',
}

export function AiAnalysisModal({ document, focusLabel, onManageKeys, onClose }: AiAnalysisModalProps) {
  const initial = loadAiSettings()
  const [provider, setProvider] = useState<AiProviderId>(initial.selectedProvider)
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [lens, setLens] = useState<AnalysisLensId>('overall')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<CapabilityAnalysis | null>(null)

  useEffect(() => {
    void fetchAiStatus().then(setStatus)
  }, [])

  const info = getProvider(provider)
  const serverReady = Boolean(status?.providers.find((item) => item.id === provider)?.configured)
  const hasKey = serverReady || Boolean(initial.keys[provider]?.trim())
  const systemCount = document.systems.length
  const canRun = hasKey && systemCount > 0 && !loading

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeArchitectureCapabilities({
        document,
        lens,
        focusLabel,
        notes,
        providerId: provider,
      })
      setAnalysis(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
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
              <Scale size={18} /> Capability analysis
            </h2>
            <p>
              Review {document.metadata.name} with {info.shortLabel}
              {focusLabel ? ` · emphasis on ${focusLabel}` : ''}. Pros and cons per capability.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="ai-analysis-toolbar">
          <label>
            Engine
            <select value={provider} onChange={(e) => setProvider(e.target.value as AiProviderId)} disabled={loading}>
              {AI_PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.recommended ? ' (recommended)' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="ai-analysis-lenses">
            {ANALYSIS_LENSES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ai-lens-chip ${lens === item.id ? 'active' : ''}`}
                title={item.hint}
                disabled={loading}
                onClick={() => setLens(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="ai-analysis-notes">
            Extra notes (optional)
            <input
              value={notes}
              placeholder="e.g. we must stay in EU, or reduce SaaS spend"
              disabled={loading}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="ai-analysis-actions">
            <button type="button" className="btn-primary" disabled={!canRun} onClick={() => void runAnalysis()}>
              {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              {analysis ? 'Re-run analysis' : 'Analyze capabilities'}
            </button>
            <button type="button" className="btn-secondary" onClick={onManageKeys} disabled={loading}>
              <KeyRound size={14} />
              Settings
            </button>
          </div>
          {!hasKey && (
            <p className="git-status err">Add an AI key first — SpaceXAI is the default engine.</p>
          )}
          {systemCount === 0 && (
            <p className="git-status err">Add systems to the canvas before analyzing.</p>
          )}
          {error && <p className="git-status err">{error}</p>}
        </div>

        <div className="ai-analysis-body">
          {loading && !analysis && (
            <div className="ai-analysis-empty">
              <Loader2 size={22} className="spin" />
              <p>Reviewing capabilities, integrations, and trade-offs…</p>
            </div>
          )}
          {!loading && !analysis && !error && (
            <div className="ai-analysis-empty">
              <Scale size={22} />
              <p>Pick a lens and run analysis to see pros and cons for each capability.</p>
            </div>
          )}
          {analysis && (
            <>
              <div className={`ai-analysis-summary verdict-${analysis.verdict}`}>
                <div className="ai-analysis-summary-top">
                  <h3>{analysis.title}</h3>
                  <span className={`ai-verdict-badge verdict-${analysis.verdict}`}>
                    {analysis.verdict === 'strong' ? (
                      <Check size={12} />
                    ) : analysis.verdict === 'at-risk' ? (
                      <Minus size={12} />
                    ) : (
                      <Scale size={12} />
                    )}
                    {VERDICT_LABEL[analysis.verdict]}
                  </span>
                </div>
                <p>{analysis.summary}</p>
              </div>

              <div className="ai-capability-list">
                {analysis.capabilities.map((capability) => (
                  <article key={capability.name} className="ai-capability-card">
                    <header>
                      <h4>{capability.name}</h4>
                      {capability.related.length > 0 && (
                        <p className="ai-capability-related">{capability.related.join(' · ')}</p>
                      )}
                      {capability.assessment && <p className="ai-capability-assessment">{capability.assessment}</p>}
                    </header>
                    <div className="ai-procon-grid">
                      <div className="ai-pro-col">
                        <h5>
                          <ThumbsUp size={13} /> Pros
                        </h5>
                        <ul>
                          {capability.pros.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                          {capability.pros.length === 0 && <li className="muted">None returned</li>}
                        </ul>
                      </div>
                      <div className="ai-con-col">
                        <h5>
                          <ThumbsDown size={13} /> Cons
                        </h5>
                        <ul>
                          {capability.cons.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                          {capability.cons.length === 0 && <li className="muted">None returned</li>}
                        </ul>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {(analysis.risks.length > 0 || analysis.recommendations.length > 0) && (
                <div className="ai-analysis-footer-grid">
                  {analysis.risks.length > 0 && (
                    <section>
                      <h4>Cross-cutting risks</h4>
                      <ul>
                        {analysis.risks.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {analysis.recommendations.length > 0 && (
                    <section>
                      <h4>Recommendations</h4>
                      <ul>
                        {analysis.recommendations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
