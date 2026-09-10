import { useState } from 'react'
import { Bot, Copy, Loader2, Play, Sparkles } from 'lucide-react'
import type { ArchitectureDocument, TechnicalChangeDesign } from '../types'
import {
  CHANGE_KIND_LABELS,
  applyComponentChange,
  copyText,
  generateComponentInstruction,
  patchTaskInDesigns,
  tasksForSystem,
} from '../utils/changeDesign'

interface ChangeDesignSectionProps {
  document: ArchitectureDocument
  systemId: string
  onChangeDesigns: (designs: TechnicalChangeDesign[]) => void
  onOpenDesign: (systemId: string) => void
}

export function ChangeDesignSection({
  document,
  systemId,
  onChangeDesigns,
  onOpenDesign,
}: ChangeDesignSectionProps) {
  const linked = tasksForSystem(document, systemId)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const runGenerate = async (designId: string, taskId: string) => {
    const match = linked.find((row) => row.design.id === designId && row.task.id === taskId)
    if (!match) return
    setBusyId(taskId)
    setMessage(null)
    try {
      const result = await generateComponentInstruction({
        document,
        design: match.design,
        task: match.task,
      })
      onChangeDesigns(
        patchTaskInDesigns(document.changeDesigns, designId, taskId, {
          instruction: result.instruction,
          instructionGeneratedAt: new Date().toISOString(),
          status: 'instructed',
        }),
      )
      setMessage(
        result.source === 'ai'
          ? 'Work instruction generated. Apply it to make the code change.'
          : result.error
            ? `Used the template instruction (${result.error})`
            : 'Used the template instruction. Add an AI key to refine it.',
      )
    } finally {
      setBusyId(null)
    }
  }

  const runCopy = async (designId: string, taskId: string, text: string) => {
    const ok = await copyText(text)
    if (!ok) {
      setMessage('Could not copy to the clipboard')
      return
    }
    onChangeDesigns(
      patchTaskInDesigns(document.changeDesigns, designId, taskId, { status: 'instructed' }),
    )
    setCopiedId(taskId)
    setTimeout(() => setCopiedId((current) => (current === taskId ? null : current)), 1600)
  }

  return (
    <div className="sub-diagram-section">
      <div className="sub-diagram-header">
        <Bot size={16} />
        <span>Feature / apply</span>
      </div>
      <p className="sub-diagram-desc">
        Translate this component’s new or update architecture change into an agent instruction, then
        apply it to the code.
      </p>

      {linked.length === 0 ? (
        <button
          type="button"
          className="btn-secondary sub-diagram-open-btn"
          onClick={() => onOpenDesign(systemId)}
        >
          <Bot size={16} />
          Add to a feature
        </button>
      ) : (
        <div className="change-design-section-list">
          {linked.map(({ design, task }) => (
            <div key={`${design.id}-${task.id}`} className="change-design-section-item">
              <strong>
                {design.title.trim() || 'Untitled feature'} · {CHANGE_KIND_LABELS[task.changeKind ?? 'update']}
              </strong>
              {task.intent && <p>{task.intent}</p>}
              <div className="change-design-section-actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === task.id}
                  onClick={() => void runGenerate(design.id, task.id)}
                >
                  {busyId === task.id ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                  {task.instruction ? 'Regenerate' : 'Generate instruction'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!task.instruction}
                  onClick={() => void runCopy(design.id, task.id, task.instruction ?? '')}
                >
                  <Copy size={14} />
                  {copiedId === task.id ? 'Copied' : 'Copy for agent'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === task.id}
                  onClick={() => {
                    void (async () => {
                      setBusyId(task.id)
                      try {
                        const result = await applyComponentChange({ document, design, task })
                        onChangeDesigns(
                          patchTaskInDesigns(document.changeDesigns, design.id, task.id, {
                            status: 'applying',
                          }),
                        )
                        setMessage(
                          result.mode === 'vscode'
                            ? 'Applying in VS Code. Mark applied when the agent finishes.'
                            : 'Apply instruction copied and downloaded. Mark applied when done.',
                        )
                      } finally {
                        setBusyId(null)
                      }
                    })()
                  }}
                >
                  {busyId === task.id ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
                  Apply
                </button>
                {task.status === 'applying' && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      onChangeDesigns(
                        patchTaskInDesigns(document.changeDesigns, design.id, task.id, {
                          status: 'applied',
                          appliedAt: new Date().toISOString(),
                        }),
                      )
                    }
                  >
                    Mark applied
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => onOpenDesign(systemId)}
                >
                  Open design
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {message && <p className="code-link-hint">{message}</p>}
    </div>
  )
}
