import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Copy, Download, KeyRound, Loader2, Sparkles, X } from 'lucide-react'
import type { ArchitectureDocument } from '../types'
import { AI_PROVIDERS, getProvider, isEngineReady, loadAiSettings, type AiProviderId } from '../utils/aiProviders'
import { fetchAiStatus, type AiStatus } from '../utils/aiDiagram'
import {
  buildStructuralTestPlan,
  downloadTestPlan,
  downloadTestPlanJson,
  formatTestPlanMarkdown,
  generateTestPlan,
  type ArchitectureTestPlan,
} from '../utils/testPlan'

interface AiTestPlanModalProps {
  document: ArchitectureDocument
  onManageKeys: () => void
  onClose: () => void
}

export function AiTestPlanModal({ document, onManageKeys, onClose }: AiTestPlanModalProps) {
  const initial = loadAiSettings()
  const [provider, setProvider] = useState<AiProviderId>(initial.selectedProvider)
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [plan, setPlan] = useState<ArchitectureTestPlan | null>(() =>
    document.systems.length ? buildStructuralTestPlan(document) : null,
  )

  useEffect(() => {
    void fetchAiStatus().then(setStatus)
  }, [])

  const info = getProvider(provider)
  const hasKey = isEngineReady(provider, status)
  const caseCount = useMemo(
    () => plan?.suites.reduce((sum, suite) => sum + suite.cases.length, 0) ?? 0,
    [plan],
  )

  const rebuild = () => {
    if (document.systems.length === 0) {
      setPlan(null)
      return
    }
    setPlan(buildStructuralTestPlan(document))
    setMessage('Rebuilt from architecture, sequence flows, and NFRs')
  }

  const enhance = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await generateTestPlan({
        document,
        notes,
        providerId: provider,
        enrichWithAi: true,
      })
      setPlan(result)
      setMessage(result.source === 'ai' ? `Enriched with ${info.shortLabel}` : 'AI did not return a usable plan; showing architecture-derived cases')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enhance the test plan')
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
              <ClipboardCheck size={18} /> End-to-end test plan
            </h2>
            <p>
              Cases from sequence flows, components, integration contracts, and NFRs
              {plan ? ` · ${plan.suites.length} suites · ${caseCount} cases` : ''}.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="ai-analysis-toolbar">
          <label>
            Engine (optional enrich)
            <select value={provider} onChange={(e) => setProvider(e.target.value as AiProviderId)} disabled={loading}>
              {AI_PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.recommended ? ' (recommended)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="ai-analysis-notes">
            Tester notes (optional)
            <input
              value={notes}
              placeholder="e.g. PCI in-scope, no prod data, must include failover"
              disabled={loading}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="ai-analysis-actions">
            <button type="button" className="btn-secondary" onClick={rebuild} disabled={loading || !document.systems.length}>
              Rebuild from architecture
            </button>
            <button type="button" className="btn-primary" onClick={() => void enhance()} disabled={loading || !hasKey || !document.systems.length}>
              {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              Enhance with AI
            </button>
            {plan && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    downloadTestPlan(plan, document.metadata.name)
                    setMessage('Downloaded Markdown test plan')
                  }}
                >
                  <Download size={14} />
                  Export Markdown
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    downloadTestPlanJson(plan, document.metadata.name)
                    setMessage('Downloaded JSON test plan')
                  }}
                >
                  <Download size={14} />
                  Export JSON
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(formatTestPlanMarkdown(plan))
                      .then(() => setMessage('Copied test plan'))
                      .catch(() => setMessage('Could not copy'))
                  }}
                >
                  <Copy size={14} />
                  Copy
                </button>
              </>
            )}
            <button type="button" className="btn-secondary" onClick={onManageKeys} disabled={loading}>
              <KeyRound size={14} />
              Settings
            </button>
          </div>
          {error && <p className="git-status err">{error}</p>}
          {message && <p className="git-status ok">{message}</p>}
        </div>

        <div className="ai-analysis-body">
          {!plan && (
            <div className="ai-analysis-empty">
              <ClipboardCheck size={28} />
              <p>Add components and integrations to generate an end-to-end test plan.</p>
            </div>
          )}
          {plan && (
            <div className="test-plan-body">
              <section className="ai-cost-card">
                <h3>{plan.title}</h3>
                <p>{plan.objective}</p>
                <ul>
                  {plan.scope.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
              {plan.suites.map((suite) => (
                <section key={suite.id} className="test-plan-suite">
                  <header>
                    <h4>{suite.name}</h4>
                    <span className="ai-effort-badge">{suite.kind}</span>
                  </header>
                  <p>{suite.objective}</p>
                  {suite.cases.map((testCase) => (
                    <article key={testCase.id} className="test-plan-case">
                      <header>
                        <h5>
                          {testCase.id}: {testCase.title}
                        </h5>
                        <span className={`ai-effort-badge effort-${testCase.priority === 'P0' ? 'high' : testCase.priority === 'P1' ? 'medium' : 'low'}`}>
                          {testCase.priority}
                        </span>
                      </header>
                      {testCase.components.length > 0 && (
                        <p className="code-link-hint">Components: {testCase.components.join(' · ')}</p>
                      )}
                      {testCase.steps.map((step, index) => (
                        <p key={`${testCase.id}-${index}`}>
                          <strong>{index + 1}.</strong> {step.action}
                          <br />
                          <em>Expected: {step.expected}</em>
                        </p>
                      ))}
                    </article>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
