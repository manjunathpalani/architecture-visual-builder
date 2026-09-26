import { useEffect, useState } from 'react'
import {
  Check,
  Coins,
  GitMerge,
  KeyRound,
  Loader2,
  Minus,
  Scale,
  Sparkles,
  StickyNote,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import type { ArchitectureDocument } from '../types'
import {
  AI_PROVIDERS,
  getProvider,
  isEngineReady,
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
  type CostForecast,
  type IntegrationSimplification,
} from '../utils/aiAnalysis'
import { formatCurrency } from '../utils/architectureSimplify'

interface AiAnalysisModalProps {
  document: ArchitectureDocument
  focusLabel?: string
  onManageKeys: () => void
  onClose: () => void
  onShowIntegrations?: (ids: string[]) => void
  onNoteIntegrations?: (ids: string[], note: string) => void
  onRetireIntegrations?: (ids: string[]) => void
}

const VERDICT_LABEL: Record<AnalysisVerdict, string> = {
  strong: 'Strong',
  balanced: 'Balanced',
  'at-risk': 'At risk',
}

export function AiAnalysisModal({
  document,
  focusLabel,
  onManageKeys,
  onClose,
  onShowIntegrations,
  onNoteIntegrations,
  onRetireIntegrations,
}: AiAnalysisModalProps) {
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
  const hasKey = isEngineReady(provider, status)
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
              {focusLabel ? ` · emphasis on ${focusLabel}` : ''}. Cost forecast and integration simplifications included.
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
            <p className="git-status err">
              {provider === 'copilot'
                ? 'Sign in to GitHub Copilot in VS Code, or paste a GitHub token in Settings → AI engines.'
                : 'Add an AI key first — SpaceXAI is the default engine. Copilot works in VS Code without a key.'}
            </p>
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
              <p>Pick a lens and run analysis to forecast cost and find integrations you can simplify.</p>
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

              <CostForecastCard forecast={analysis.costForecast} />

              {analysis.simplifications.length > 0 && (
                <section className="ai-simplify-section">
                  <h4>
                    <GitMerge size={15} />
                    Simplify integrations
                  </h4>
                  <p className="code-link-hint">
                    Duplicate hops, shortcuts, and long chains you can collapse. Show on canvas, attach a note, or mark
                    extras as retired.
                  </p>
                  <div className="ai-simplify-list">
                    {analysis.simplifications.map((item) => (
                      <SimplificationCard
                        key={item.id}
                        item={item}
                        currency={analysis.costForecast.currency}
                        onShow={
                          onShowIntegrations && item.integrationIds.length > 0
                            ? () => {
                                onShowIntegrations(item.integrationIds)
                                onClose()
                              }
                            : undefined
                        }
                        onNote={
                          onNoteIntegrations && item.integrationIds.length > 0
                            ? () =>
                                onNoteIntegrations(
                                  item.integrationIds,
                                  [
                                    `## AI simplification: ${item.title}`,
                                    item.problem,
                                    `Action: ${item.action}`,
                                    item.savingsMonthly > 0
                                      ? `Indicative saving: ${formatCurrency(item.savingsMonthly, analysis.costForecast.currency)} / month`
                                      : '',
                                  ]
                                    .filter(Boolean)
                                    .join('\n\n'),
                                )
                            : undefined
                        }
                        onRetire={
                          onRetireIntegrations && item.integrationIds.length > 1
                            ? () => onRetireIntegrations(item.integrationIds.slice(1))
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </section>
              )}

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

function CostForecastCard({ forecast }: { forecast: CostForecast }) {
  const hasRange = forecast.monthlyHigh > 0 || forecast.monthlyExpected > 0 || forecast.declaredMonthly > 0
  if (!hasRange) return null
  return (
    <section className="ai-cost-card">
      <header>
        <h4>
          <Coins size={15} />
          Predicted monthly cost
        </h4>
        <span className={`ai-cost-confidence confidence-${forecast.confidence}`}>{forecast.confidence} confidence</span>
      </header>
      <div className="ai-cost-figures">
        <div>
          <em>Expected</em>
          <strong>{formatCurrency(forecast.monthlyExpected, forecast.currency)}</strong>
        </div>
        <div>
          <em>Range</em>
          <strong>
            {formatCurrency(forecast.monthlyLow, forecast.currency)} –{' '}
            {formatCurrency(forecast.monthlyHigh, forecast.currency)}
          </strong>
        </div>
        {forecast.declaredMonthly > 0 && (
          <div>
            <em>Declared on components</em>
            <strong>{formatCurrency(forecast.declaredMonthly, forecast.currency)}</strong>
          </div>
        )}
      </div>
      {forecast.basis && <p>{forecast.basis}</p>}
      {forecast.drivers.length > 0 && (
        <ul className="ai-cost-drivers">
          {forecast.drivers.map((driver) => (
            <li key={`${driver.name}-${driver.monthly}`}>
              <span>{driver.name}</span>
              <strong>{formatCurrency(driver.monthly, forecast.currency)}</strong>
              {driver.note && <em>{driver.note}</em>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SimplificationCard({
  item,
  currency,
  onShow,
  onNote,
  onRetire,
}: {
  item: IntegrationSimplification
  currency: string
  onShow?: () => void
  onNote?: () => void
  onRetire?: () => void
}) {
  return (
    <article className="ai-simplify-card">
      <header>
        <h5>{item.title}</h5>
        <span className={`ai-effort-badge effort-${item.effort}`}>{item.effort} effort</span>
      </header>
      {item.problem && <p>{item.problem}</p>}
      <p>
        <strong>Simplify:</strong> {item.action}
      </p>
      <div className="ai-simplify-meta">
        {item.integrationLabels.length > 0 && <span>{item.integrationLabels.join(' · ')}</span>}
        {item.savingsMonthly > 0 && (
          <span>Save ~{formatCurrency(item.savingsMonthly, currency)}/mo</span>
        )}
        {item.removesHops > 0 && <span>Remove {item.removesHops} hop{item.removesHops === 1 ? '' : 's'}</span>}
        {item.source === 'structure' && <span>From diagram structure</span>}
      </div>
      {(onShow || onNote || onRetire) && (
        <div className="ai-simplify-actions">
          {onShow && (
            <button type="button" className="btn-secondary" onClick={onShow}>
              Show on canvas
            </button>
          )}
          {onNote && (
            <button type="button" className="btn-secondary" onClick={onNote}>
              <StickyNote size={13} />
              Add as note
            </button>
          )}
          {onRetire && (
            <button type="button" className="btn-secondary" onClick={onRetire}>
              Mark extras retired
            </button>
          )}
        </div>
      )}
    </article>
  )
}
