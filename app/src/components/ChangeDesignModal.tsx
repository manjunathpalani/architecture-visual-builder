import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  Copy,
  Download,
  KeyRound,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import type { ArchitectureDocument, ComponentChangeTask, TechnicalChangeDesign } from '../types'
import {
  AI_PROVIDERS,
  getProvider,
  loadAiSettings,
  type AiProviderId,
} from '../utils/aiProviders'
import { fetchAiStatus, type AiStatus } from '../utils/aiDiagram'
import {
  CHANGE_DESIGN_STATUSES,
  CHANGE_DESIGN_STATUS_LABELS,
  CHANGE_KIND_LABELS,
  applyComponentChange,
  changeKindFromStatus,
  buildDesignPackMarkdown,
  buildInstructionMarkdown,
  copyText,
  countTasksByKind,
  createEmptyDesign,
  createTaskFromSystem,
  designFileSlug,
  downloadMarkdown,
  generateComponentInstruction,
  listArchitectureChanges,
  listDesignableSystems,
  removeDesign,
  syncTasksFromArchitecture,
  upsertDesign,
} from '../utils/changeDesign'

interface ChangeDesignModalProps {
  document: ArchitectureDocument
  focusSystemId?: string
  variant?: 'overlay' | 'page'
  onSave: (designs: TechnicalChangeDesign[]) => void
  onSelectSystem: (id: string) => void
  onManageKeys: () => void
  onClose: () => void
}

export function ChangeDesignModal({
  document,
  focusSystemId,
  variant = 'overlay',
  onSave,
  onSelectSystem,
  onManageKeys,
  onClose,
}: ChangeDesignModalProps) {
  const existing = document.changeDesigns ?? []
  const systems = useMemo(() => listDesignableSystems(document), [document])
  const architectureChanges = useMemo(() => listArchitectureChanges(document), [document])
  const [view, setView] = useState<'list' | 'edit'>(existing.length > 0 && !focusSystemId ? 'list' : 'edit')
  const [draft, setDraft] = useState<TechnicalChangeDesign | null>(() => {
    if (focusSystemId) {
      const hit = existing.find((item) => item.tasks.some((task) => task.systemId === focusSystemId))
      return hit ? { ...hit, tasks: hit.tasks.map((task) => ({ ...task })) } : createEmptyDesign(document, focusSystemId)
    }
    if (existing.length === 0) return createEmptyDesign(document)
    return null
  })
  const [query, setQuery] = useState('')
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [provider, setProvider] = useState<AiProviderId>(loadAiSettings().selectedProvider)
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [size, setSize] = useState<'dialog' | 'expanded'>(() => {
    try {
      return localStorage.getItem('avb-feature-view-size') === 'dialog' ? 'dialog' : 'expanded'
    } catch {
      return 'expanded'
    }
  })

  const setViewSize = (next: 'dialog' | 'expanded') => {
    setSize(next)
    try {
      localStorage.setItem('avb-feature-view-size', next)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void fetchAiStatus().then(setStatus)
  }, [])

  const info = getProvider(provider)
  const serverReady = Boolean(status?.providers.find((item) => item.id === provider)?.configured)
  const hasKey = serverReady || Boolean(loadAiSettings().keys[provider]?.trim())

  const filteredSystems = systems.filter((item) => {
    if (!query.trim()) return true
    const hay = `${item.pathLabel} ${item.category} ${item.type}`.toLowerCase()
    return hay.includes(query.trim().toLowerCase())
  })

  const persist = (next: TechnicalChangeDesign, designs = existing) => {
    const saved = upsertDesign(designs, next)
    onSave(saved)
    return saved
  }

  const openNew = (seedSystemId?: string) => {
    const next = createEmptyDesign(document, seedSystemId)
    setDraft(next)
    setView('edit')
    setMessage(null)
  }

  const openExisting = (design: TechnicalChangeDesign) => {
    setDraft({ ...design, tasks: design.tasks.map((task) => ({ ...task })) })
    setView('edit')
    setMessage(null)
  }

  const updateDraft = (patch: Partial<TechnicalChangeDesign>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  const selectedIds = new Set(draft?.tasks.map((task) => task.systemId) ?? [])

  const toggleSystem = (systemId: string) => {
    if (!draft) return
    const system = systems.find((item) => item.id === systemId)
    if (!system) return
    if (selectedIds.has(systemId)) {
      updateDraft({ tasks: draft.tasks.filter((task) => task.systemId !== systemId) })
      return
    }
    updateDraft({ tasks: [...draft.tasks, createTaskFromSystem(system)] })
  }

  const updateTask = (taskId: string, patch: Partial<ComponentChangeTask>) => {
    if (!draft) return
    updateDraft({
      tasks: draft.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
    })
  }

  const handleSave = () => {
    if (!draft) return
    if (!draft.title.trim()) {
      setMessage('Give the feature a name before saving')
      return
    }
    persist({ ...draft, title: draft.title.trim() })
    setMessage('Feature saved on this project')
  }

  const handleDelete = () => {
    if (!draft) return
    onSave(removeDesign(existing, draft.id))
    setDraft(null)
    setView('list')
    setMessage('Design removed')
  }

  const runGenerate = async (task: ComponentChangeTask) => {
    if (!draft) return
    setBusyTaskId(task.id)
    setMessage(null)
    const working = {
      ...draft,
      title: draft.title.trim() || 'Untitled technical change',
    }
    try {
      const result = await generateComponentInstruction({
        document,
        design: working,
        task,
        providerId: provider,
      })
      const next: TechnicalChangeDesign = {
        ...working,
        tasks: working.tasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                instruction: result.instruction,
                instructionGeneratedAt: new Date().toISOString(),
                status: 'instructed' as const,
              }
            : item,
        ),
      }
      setDraft(next)
      persist(next)
      setMessage(
        result.source === 'ai'
          ? `Instruction ready for ${task.systemLabel}. Copy it into an agent.`
          : result.error
            ? `Template instruction for ${task.systemLabel} (${result.error})`
            : `Template instruction for ${task.systemLabel}. Add an AI key to refine it.`,
      )
    } finally {
      setBusyTaskId(null)
    }
  }

  const runGenerateAll = async () => {
    if (!draft || draft.tasks.length === 0) return
    setGeneratingAll(true)
    let current = { ...draft, title: draft.title.trim() || 'Untitled technical change' }
    for (const task of current.tasks) {
      setBusyTaskId(task.id)
      const result = await generateComponentInstruction({
        document,
        design: current,
        task,
        providerId: provider,
      })
      current = {
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                instruction: result.instruction,
                instructionGeneratedAt: new Date().toISOString(),
                status: 'instructed' as const,
              }
            : item,
        ),
      }
      setDraft(current)
    }
    persist(current)
    setBusyTaskId(null)
    setGeneratingAll(false)
    setMessage(`Generated ${current.tasks.length} agent instruction${current.tasks.length === 1 ? '' : 's'}`)
  }

  const runCopy = async (task: ComponentChangeTask) => {
    if (!draft) return
    const text = task.instruction?.trim() || buildInstructionMarkdown(document, draft, task)
    const ok = await copyText(text)
    if (!ok) {
      setMessage('Could not copy to the clipboard')
      return
    }
    updateTask(task.id, { status: task.instruction ? 'instructed' : task.status })
    setCopiedId(task.id)
    setTimeout(() => setCopiedId((id) => (id === task.id ? null : id)), 1600)
  }

  const runCopyPack = async () => {
    if (!draft) return
    const ok = await copyText(buildDesignPackMarkdown(document, draft))
    setMessage(ok ? 'Copied every component instruction as one pack' : 'Could not copy to the clipboard')
  }

  const runDownloadPack = () => {
    if (!draft) return
    downloadMarkdown(
      `${designFileSlug(draft.title)}-agent-tasks.md`,
      buildDesignPackMarkdown(document, draft),
    )
  }

  const applyTask = async (task: ComponentChangeTask) => {
    if (!draft) return
    setBusyTaskId(task.id)
    try {
      const result = await applyComponentChange({ document, design: draft, task })
      const next = {
        ...draft,
        status: 'in-progress' as const,
        tasks: draft.tasks.map((item) =>
          item.id === task.id ? { ...item, status: 'applying' as const } : item,
        ),
      }
      setDraft(next)
      persist(next)
      setMessage(
        result.mode === 'vscode'
          ? `Applying ${CHANGE_KIND_LABELS[task.changeKind]} for ${task.systemLabel} in VS Code`
          : `Apply instruction copied and downloaded for ${task.systemLabel}. Mark applied when the agent finishes.`,
      )
    } finally {
      setBusyTaskId(null)
    }
  }

  const applyAll = async () => {
    if (!draft) return
    let current = draft
    setGeneratingAll(true)
    try {
      for (const task of current.tasks) {
        setBusyTaskId(task.id)
        await applyComponentChange({ document, design: current, task })
        current = {
          ...current,
          status: 'in-progress',
          tasks: current.tasks.map((item) =>
            item.id === task.id ? { ...item, status: 'applying' as const } : item,
          ),
        }
        setDraft(current)
      }
      persist(current)
      setMessage(`Applying ${current.tasks.length} architecture change${current.tasks.length === 1 ? '' : 's'}`)
    } finally {
      setBusyTaskId(null)
      setGeneratingAll(false)
    }
  }

  const markApplied = (task: ComponentChangeTask) => {
    if (!draft) return
    const next = {
      ...draft,
      tasks: draft.tasks.map((item) =>
        item.id === task.id
          ? { ...item, status: 'applied' as const, appliedAt: new Date().toISOString() }
          : item,
      ),
    }
    const allDone = next.tasks.length > 0 && next.tasks.every((item) => item.status === 'applied')
    const saved = { ...next, status: allDone ? ('done' as const) : next.status }
    setDraft(saved)
    persist(saved)
    setMessage(`Marked ${task.systemLabel} as applied`)
  }

  const syncFromArchitecture = () => {
    if (!draft) return
    const next = syncTasksFromArchitecture(document, draft)
    setDraft(next)
    setMessage('Translated new / update / retire architecture changes into work items')
  }

  const isPage = variant === 'page'
  const expanded = isPage || size === 'expanded'

  return (
    <div
      className={
        isPage
          ? 'change-design-page'
          : `git-int-overlay change-design-overlay${expanded ? ' is-expanded' : ''}`
      }
    >
      <div className="git-int-panel git-int-panel-wide change-design-panel">
        <div className="git-int-header">
          <div>
            <h2>
              <Bot size={18} /> Feature and apply changes
            </h2>
            <p>
              Define the feature, translate new vs update architecture into work instructions, then
              apply them with a coding agent.
            </p>
          </div>
          <div className="dialog-header-actions">
            {!isPage &&
              (expanded ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setViewSize('dialog')}
                  title="Show as a smaller dialog"
                >
                  <Minimize2 size={15} />
                  Dialog
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setViewSize('expanded')}
                  title="Open expanded workspace view"
                >
                  <Maximize2 size={15} />
                  Expanded view
                </button>
              ))}
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label={isPage ? 'Back to diagram' : 'Close'}
              title={isPage ? 'Back to diagram' : 'Close'}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {view === 'list' && (
          <div className="change-design-body">
            <div className="change-design-list-toolbar">
              <p>
                {existing.length} feature{existing.length === 1 ? '' : 's'} on {document.metadata.name}
              </p>
              <button type="button" className="btn-primary" onClick={() => openNew()}>
                <Plus size={16} />
                New feature
              </button>
            </div>
            {existing.length === 0 ? (
              <div className="ai-analysis-empty">
                <Bot size={28} />
                <p>
                  No features yet. Mark canvas items as new or changed, then create a feature to
                  generate and apply agent work.
                </p>
              </div>
            ) : (
              <ul className="change-design-list">
                {existing.map((design) => (
                  <li key={design.id}>
                    <button type="button" className="change-design-list-item" onClick={() => openExisting(design)}>
                      <strong>{design.title.trim() || 'Untitled feature'}</strong>
                      <span>
                        {CHANGE_DESIGN_STATUS_LABELS[design.status]} · {countTasksByKind(design).new} new ·{' '}
                        {countTasksByKind(design).update} update · {design.tasks.length} work item
                        {design.tasks.length === 1 ? '' : 's'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {view === 'edit' && draft && (
          <div className="change-design-body">
            <div className="change-design-toolbar">
              {existing.length > 0 && (
                <button type="button" className="btn-secondary" onClick={() => setView('list')}>
                  All features
                </button>
              )}
              <label>
                Status
                <select
                  value={draft.status}
                  onChange={(e) => updateDraft({ status: e.target.value as TechnicalChangeDesign['status'] })}
                >
                  {CHANGE_DESIGN_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {CHANGE_DESIGN_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Engine
                <select value={provider} onChange={(e) => setProvider(e.target.value as AiProviderId)}>
                  {AI_PROVIDERS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                      {item.recommended ? ' (recommended)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {!hasKey && (
                <button type="button" className="btn-secondary" onClick={onManageKeys}>
                  <KeyRound size={14} />
                  Add {info.shortLabel} key
                </button>
              )}
            </div>

            <div className="change-design-grid">
              <div className="change-design-brief">
                <label>
                  Feature name
                  <input
                    value={draft.title}
                    placeholder="e.g. Order status webhooks"
                    onChange={(e) => updateDraft({ title: e.target.value })}
                  />
                </label>
                <label>
                  Feature definition
                  <textarea
                    rows={4}
                    value={draft.definition ?? ''}
                    placeholder="What is this feature? Agents use this as the source of truth when they change code."
                    onChange={(e) => updateDraft({ definition: e.target.value })}
                  />
                </label>
                <label>
                  Problem
                  <textarea
                    rows={2}
                    value={draft.problem}
                    placeholder="What is missing or wrong in the current architecture?"
                    onChange={(e) => updateDraft({ problem: e.target.value })}
                  />
                </label>
                <label>
                  Architecture translation (new / update)
                  <textarea
                    rows={4}
                    value={draft.proposedChange}
                    placeholder="How the canvas new vs update items become work. Use Sync from architecture to fill this."
                    onChange={(e) => updateDraft({ proposedChange: e.target.value })}
                  />
                </label>
                <label>
                  Acceptance criteria
                  <textarea
                    rows={3}
                    value={draft.acceptanceCriteria}
                    placeholder="How will we know each new or updated component is done?"
                    onChange={(e) => updateDraft({ acceptanceCriteria: e.target.value })}
                  />
                </label>
                <label>
                  Notes (optional)
                  <textarea
                    rows={2}
                    value={draft.notes ?? ''}
                    placeholder="Constraints, rollout, owners"
                    onChange={(e) => updateDraft({ notes: e.target.value })}
                  />
                </label>
              </div>

              <div className="change-design-components">
                <div className="change-design-components-header">
                  <h3>New vs update</h3>
                  <span>{draft.tasks.length} work items</span>
                </div>
                <p className="code-link-hint">
                  Canvas items marked new, changed, or retired become agent work. Sync after you edit
                  the diagram.
                </p>
                {architectureChanges.length > 0 && (
                  <ul className="change-design-delta-list">
                    {architectureChanges.slice(0, 8).map((change) => (
                      <li key={`${change.ownerKind}-${change.id}`}>
                        <span className={`change-kind-badge kind-${change.kind}`}>
                          {CHANGE_KIND_LABELS[change.kind]}
                        </span>
                        {change.label}
                      </li>
                    ))}
                    {architectureChanges.length > 8 && (
                      <li>+{architectureChanges.length - 8} more</li>
                    )}
                  </ul>
                )}
                <button type="button" className="btn-secondary" onClick={syncFromArchitecture}>
                  <RefreshCw size={14} />
                  Sync from architecture
                </button>
                <input
                  className="change-design-search"
                  value={query}
                  placeholder="Filter systems"
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="change-design-system-list">
                  {filteredSystems.length === 0 ? (
                    <p className="code-link-hint">
                      {systems.length === 0
                        ? 'Add systems to the canvas first.'
                        : 'No systems match that filter.'}
                    </p>
                  ) : (
                    filteredSystems.map((system) => (
                      <label key={system.id} className="change-design-system-row">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(system.id)}
                          onChange={() => toggleSystem(system.id)}
                        />
                        <span>
                          <strong>{system.pathLabel}</strong>
                          <em>
                            {system.category}
                            {system.changeStatus !== 'unchanged'
                              ? ` · ${CHANGE_KIND_LABELS[changeKindFromStatus(system.changeStatus)]}`
                              : ''}
                          </em>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="change-design-tasks">
              <div className="change-design-tasks-header">
                <h3>Work instructions</h3>
                <div className="change-design-task-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={draft.tasks.length === 0 || generatingAll}
                    onClick={() => void runGenerateAll()}
                  >
                    {generatingAll ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                    Generate all
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={draft.tasks.length === 0}
                    onClick={() => void runCopyPack()}
                  >
                    <Copy size={14} />
                    Copy pack
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={draft.tasks.length === 0}
                    onClick={runDownloadPack}
                  >
                    <Download size={14} />
                    Download .md
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={draft.tasks.length === 0 || generatingAll}
                    onClick={() => void applyAll()}
                  >
                    <Play size={14} />
                    Apply all
                  </button>
                </div>
              </div>

              {draft.tasks.length === 0 ? (
                <p className="code-link-hint">
                  Tick components, or Sync from architecture to pull new and updated items from the
                  canvas.
                </p>
              ) : (
                draft.tasks.map((task) => {
                  const missing = !systems.some((item) => item.id === task.systemId)
                  return (
                    <article key={task.id} className="change-design-task">
                      <div className="change-design-task-top">
                        <div>
                          <strong>{task.systemLabel}</strong>
                          <span className={`change-kind-badge kind-${task.changeKind ?? 'update'}`}>
                            {CHANGE_KIND_LABELS[task.changeKind ?? 'update']}
                          </span>
                          {task.status === 'applying' && <span className="change-design-missing">Applying</span>}
                          {task.status === 'applied' && <span className="change-kind-badge kind-applied">Applied</span>}
                          {missing && <span className="change-design-missing">Missing from canvas</span>}
                        </div>
                        <div className="change-design-task-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => onSelectSystem(task.systemId)}
                            disabled={missing}
                          >
                            Select
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={busyTaskId === task.id || generatingAll}
                            onClick={() => void runGenerate(task)}
                          >
                            {busyTaskId === task.id ? (
                              <Loader2 size={14} className="spin" />
                            ) : (
                              <Sparkles size={14} />
                            )}
                            {task.instruction ? 'Regenerate' : 'Generate'}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => void runCopy(task)}
                          >
                            <Copy size={14} />
                            {copiedId === task.id ? 'Copied' : 'Copy for agent'}
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={busyTaskId === task.id || generatingAll}
                            onClick={() => void applyTask(task)}
                          >
                            <Play size={14} />
                            Apply
                          </button>
                          {task.status === 'applying' && (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => markApplied(task)}
                            >
                              Mark applied
                            </button>
                          )}
                        </div>
                      </div>
                      <label>
                        Intent for this component
                        <textarea
                          rows={2}
                          value={task.intent}
                          onChange={(e) => updateTask(task.id, { intent: e.target.value })}
                          placeholder={`What should change in ${task.systemLabel}?`}
                        />
                      </label>
                      {task.instruction && (
                        <pre className="change-design-instruction">{task.instruction}</pre>
                      )}
                    </article>
                  )
                })
              )}
            </div>

            {message && <p className="change-design-message">{message}</p>}

            <div className="change-design-footer">
              <button type="button" className="btn-secondary" onClick={handleDelete}>
                <Trash2 size={14} />
                Delete feature
              </button>
              <div className="change-design-footer-right">
                <button type="button" className="btn-secondary" onClick={onClose}>
                  Close
                </button>
                <button type="button" className="btn-primary" onClick={handleSave}>
                  Save feature
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
