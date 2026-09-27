import { useState } from 'react'
import { Bot, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import {
  AGENT_PLAN_STEP_KINDS,
  createPlanStep,
  defaultAgentPlan,
  type AgentPlan,
  type AgentPlanStep,
  type AgentPlanStepKind,
} from '../utils/agentPlan'

interface AgentPlanModalProps {
  onPlace: (plan: AgentPlan, placement: 'canvas' | 'tab') => void
  onClose: () => void
}

export function AgentPlanModal({ onPlace, onClose }: AgentPlanModalProps) {
  const [plan, setPlan] = useState<AgentPlan>(() => defaultAgentPlan())
  const [toolsText, setToolsText] = useState(() => defaultAgentPlan().tools.join('\n'))
  const [error, setError] = useState<string | null>(null)

  const updateStep = (id: string, patch: Partial<AgentPlanStep>) => {
    setPlan((current) => ({
      ...current,
      steps: current.steps.map((step) => (step.id === id ? { ...step, ...patch } : step)),
    }))
  }

  const moveStep = (index: number, direction: -1 | 1) => {
    setPlan((current) => {
      const next = index + direction
      if (next < 0 || next >= current.steps.length) return current
      const steps = [...current.steps]
      const [item] = steps.splice(index, 1)
      steps.splice(next, 0, item)
      return { ...current, steps }
    })
  }

  const removeStep = (id: string) => {
    setPlan((current) => ({ ...current, steps: current.steps.filter((step) => step.id !== id) }))
  }

  const readyPlan = (): AgentPlan | null => {
    const name = plan.name.trim()
    const steps = plan.steps.filter((step) => step.title.trim() || step.detail.trim())
    if (!name) {
      setError('Name the agent before placing it.')
      return null
    }
    if (steps.length === 0) {
      setError('Add at least one plan step.')
      return null
    }
    setError(null)
    return {
      ...plan,
      name,
      goal: plan.goal.trim(),
      model: plan.model.trim(),
      tools: toolsText.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
      steps,
    }
  }

  const place = (placement: 'canvas' | 'tab') => {
    const next = readyPlan()
    if (!next) return
    onPlace(next, placement)
  }

  return (
    <div className="swagger-overlay" onClick={onClose}>
      <div className="swagger-modal agent-plan-modal" onClick={(event) => event.stopPropagation()}>
        <div className="swagger-modal-header">
          <div>
            <h2>
              <Bot size={20} />
              Build agent and plan
            </h2>
            <p>Lay out the agent, its tools, and the steps it follows. The plan is drawn on the canvas.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="swagger-modal-body agent-plan-body">
          <div className="agent-plan-identity">
            <label>
              Agent name
              <input
                value={plan.name}
                onChange={(event) => setPlan((current) => ({ ...current, name: event.target.value }))}
                placeholder="Support agent"
              />
            </label>
            <label>
              Model
              <input
                value={plan.model}
                onChange={(event) => setPlan((current) => ({ ...current, model: event.target.value }))}
                placeholder="SpaceXAI"
              />
            </label>
            <label className="agent-plan-goal">
              Goal
              <textarea
                value={plan.goal}
                rows={2}
                onChange={(event) => setPlan((current) => ({ ...current, goal: event.target.value }))}
                placeholder="What this agent is responsible for"
              />
            </label>
            <label>
              Tools
              <textarea
                value={toolsText}
                rows={3}
                onChange={(event) => setToolsText(event.target.value)}
                placeholder={'One tool per line\nSearch knowledge\nCreate ticket'}
              />
            </label>
          </div>

          <div className="agent-plan-board-wrap">
            <div className="agent-plan-board-label">Plan</div>
            <div className="agent-plan-board">
              <article className="agent-plan-card is-agent">
                <span>Agent</span>
                <strong>{plan.name.trim() || 'Untitled agent'}</strong>
                <em>{plan.model.trim() || 'Model not set'}</em>
              </article>
              {plan.steps.map((step, index) => (
                <div className="agent-plan-step-wrap" key={step.id}>
                  <span className="agent-plan-arrow" aria-hidden>
                    →
                  </span>
                  <article className={`agent-plan-card is-${step.kind}`}>
                    <div className="agent-plan-card-top">
                      <select
                        value={step.kind}
                        aria-label={`Step ${index + 1} kind`}
                        onChange={(event) => updateStep(step.id, { kind: event.target.value as AgentPlanStepKind })}
                      >
                        {AGENT_PLAN_STEP_KINDS.map((kind) => (
                          <option key={kind.id} value={kind.id}>
                            {kind.label}
                          </option>
                        ))}
                      </select>
                      <span>{index + 1}</span>
                    </div>
                    <input
                      value={step.title}
                      aria-label={`Step ${index + 1} title`}
                      placeholder={kindHint(step.kind)}
                      onChange={(event) => updateStep(step.id, { title: event.target.value })}
                    />
                    <textarea
                      value={step.detail}
                      rows={2}
                      aria-label={`Step ${index + 1} detail`}
                      placeholder={step.kind === 'tool' ? 'Tool name' : 'What happens in this step'}
                      onChange={(event) => updateStep(step.id, { detail: event.target.value })}
                    />
                    <div className="agent-plan-card-actions">
                      <button type="button" className="icon-btn" title="Move earlier" onClick={() => moveStep(index, -1)} disabled={index === 0}>
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Move later"
                        onClick={() => moveStep(index, 1)}
                        disabled={index === plan.steps.length - 1}
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button type="button" className="icon-btn" title="Remove step" onClick={() => removeStep(step.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary agent-plan-add"
                onClick={() => setPlan((current) => ({ ...current, steps: [...current.steps, createPlanStep()] }))}
              >
                <Plus size={16} />
                Add step
              </button>
            </div>
          </div>
          {error && <p className="agent-plan-error">{error}</p>}
        </div>

        <div className="swagger-modal-footer">
          <button type="button" className="btn-secondary" onClick={() => place('tab')}>
            Open as new tab
          </button>
          <button type="button" className="btn-primary" onClick={() => place('canvas')}>
            Add to this canvas
          </button>
        </div>
      </div>
    </div>
  )
}

function kindHint(kind: AgentPlanStepKind): string {
  return AGENT_PLAN_STEP_KINDS.find((item) => item.id === kind)?.hint ?? 'Step'
}
