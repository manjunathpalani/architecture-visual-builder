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
  isEngineReady,
  loadAiSettings,
  type AiProviderId,
} from '../utils/aiProviders'
import { fetchAiStatus, type AiStatus } from '../utils/aiDiagram'
import {
  CHANGE_DESIGN_STATUSES,
  CHANGE_DESIGN_STATUS_LABELS,
  CHANGE_KIND_LABELS,
  applyComponentChange,
  assignSystemsToStory,
  assignTaskToStory,
  changeKindFromStatus,
  buildDesignPackMarkdown,
  buildInstructionMarkdown,
  copyText,
  countStories,
  createEmptyDesign,
  createTaskFromSystem,
  designFileSlug,
  downloadMarkdown,
  formatTaskCodePath,
  generateComponentInstruction,
  generateRequirements,
  applyGeneratedRequirements,
  listArchitectureChanges,
  listDesignableSystems,
  removeDesign,
  syncTasksFromArchitecture,
  upsertDesign,
} from '../utils/changeDesign'
import { dispatchAgentWork } from '../utils/agentDispatch'
import { FeatureStoriesPanel } from './FeatureStoriesPanel'
import { FeatureStoryTree, type FeatureTreeSelection } from './FeatureStoryTree'

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
      return hit
        ? {
            ...hit,
            stories: hit.stories?.map((story) => ({ ...story, systemIds: [...story.systemIds] })),
            tasks: hit.tasks.map((task) => ({ ...task })),
          }
        : createEmptyDesign(document, focusSystemId)
    }
    if (existing.length === 0) return createEmptyDesign(document)
    return null
  })
  const [query, setQuery] = useState('')
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [focusStoryId, setFocusStoryId] = useState<string | null>(null)
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null)
  const [generatingReqs, setGeneratingReqs] = useState<string | null>(null)
  const [sendingAgent, setSendingAgent] = useState<string | null>(null)
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

  useEffect(() => {
    const targetId = focusTaskId
      ? `[data-task-id="${focusTaskId}"]`
      : focusStoryId
        ? `[data-story-id="${focusStoryId}"]`
        : null
    if (!targetId) return
    window.document.querySelector(targetId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusStoryId, focusTaskId, view])

  const info = getProvider(provider)
  const hasKey = isEngineReady(provider, status)

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
    setFocusStoryId(null)
    setFocusTaskId(null)
    setMessage(null)
  }

  const openExisting = (design: TechnicalChangeDesign, selection?: FeatureTreeSelection) => {
    setDraft({
      ...design,
      stories: design.stories?.map((story) => ({ ...story, systemIds: [...story.systemIds] })),
      tasks: design.tasks.map((task) => ({ ...task })),
    })
    setView('edit')
    setFocusStoryId(selection?.storyId ?? null)
    setFocusTaskId(selection?.taskId ?? null)
    setMessage(null)
  }

  const handleTreeSelect = (selection: FeatureTreeSelection) => {
    if (draft && selection.designId === draft.id && view === 'edit') {
      setFocusStoryId(selection.storyId ?? null)
      setFocusTaskId(selection.taskId ?? null)
      return
    }
    const design = existing.find((item) => item.id === selection.designId)
    if (!design) return
    openExisting(design, selection)
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
      updateDraft({
        tasks: draft.tasks.filter((task) => task.systemId !== systemId),
        stories: (draft.stories ?? []).map((story) => ({
          ...story,
          systemIds: story.systemIds.filter((id) => id !== systemId),
        })),
      })
      return
    }
    const task = createTaskFromSystem(system)
    if (focusStoryId) {
      updateDraft(assignSystemsToStory(
        { ...draft, tasks: [...draft.tasks, task] },
        focusStoryId,
        [...(draft.stories?.find((story) => story.id === focusStoryId)?.systemIds ?? []), systemId],
        systems,
      ))
      return
    }
    updateDraft({ tasks: [...draft.tasks, task] })
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
      setMessage(result.message)
    } finally {
      setBusyTaskId(null)
    }
  }

  const sendToAgent = async (scope: 'feature' | 'story' | 'component', storyId?: string, task?: ComponentChangeTask) => {
    if (!draft) return
    const key = scope === 'feature' ? 'feature' : scope === 'story' ? `story:${storyId}` : task?.id ?? 'component'
    setSendingAgent(key)
    setMessage(null)
    try {
      const result = await dispatchAgentWork({
        document,
        design: draft,
        scope,
        storyId,
        task,
        apply: true,
      })
      const applyingIds = new Set(
        scope === 'component' && task
          ? [task.id]
          : scope === 'story' && storyId
            ? draft.tasks.filter((item) => item.storyId === storyId || (draft.stories ?? []).find((story) => story.id === storyId)?.systemIds.includes(item.systemId)).map((item) => item.id)
            : draft.tasks.map((item) => item.id),
      )
      const next = {
        ...draft,
        status: 'in-progress' as const,
        tasks: draft.tasks.map((item) =>
          applyingIds.has(item.id) ? { ...item, status: 'applying' as const } : item,
        ),
      }
      setDraft(next)
      persist(next)
      setMessage(result.url ? `${result.message} ${result.url}` : result.message)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not send work to the agent')
    } finally {
      setSendingAgent(null)
    }
  }

  const applyAll = async () => {
    await sendToAgent('feature')
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

  const runGenerateRequirements = async (storyId?: string) => {
    if (!draft) return
    setGeneratingReqs(storyId ?? 'feature')
    setMessage(null)
    const working = { ...draft, title: draft.title.trim() || 'Untitled feature' }
    try {
      const result = await generateRequirements({
        document,
        design: working,
        storyId,
        providerId: provider,
      })
      const next = applyGeneratedRequirements(working, result, storyId)
      setDraft(next)
      persist(next)
      const scope = storyId
        ? (working.stories ?? []).find((item) => item.id === storyId)?.title.trim() || 'this story'
        : working.title
      setMessage(
        result.source === 'ai'
          ? `Requirements populated for ${scope}.`
          : result.error
            ? `Template requirements for ${scope} (${result.error})`
            : `Template requirements for ${scope}. Add an AI key to refine them.`,
      )
    } finally {
      setGeneratingReqs(null)
    }
  }

  const isPage = variant === 'page'
  const expanded = isPage || size === 'expanded'
  const storyCount = countStories(existing)
  const componentCount = existing.reduce((sum, design) => sum + design.tasks.length, 0)

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
              Define the feature and user stories, generate instructions, then send the pack to a
              coding agent (VS Code Copilot, GitHub Copilot, or Copilot CLI).
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
                {existing.length} feature{existing.length === 1 ? '' : 's'} · {storyCount} stor
                {storyCount === 1 ? 'y' : 'ies'} · {componentCount} linked component
                {componentCount === 1 ? '' : 's'} on {document.metadata.name}
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
              <FeatureStoryTree designs={existing} onSelect={handleTreeSelect} />
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
                  {provider === 'copilot' ? 'Connect Copilot' : `Add ${info.shortLabel} key`}
                </button>
              )}
            </div>

            <div className="change-design-tree-panel">
              <div className="change-design-components-header">
                <h3>Feature tree</h3>
                <span>
                  {(draft.stories?.length ?? 0)} stor{(draft.stories?.length ?? 0) === 1 ? 'y' : 'ies'} ·{' '}
                  {draft.tasks.length} component{draft.tasks.length === 1 ? '' : 's'}
                </span>
              </div>
              <FeatureStoryTree
                designs={existing}
                design={draft}
                selected={{
                  designId: draft.id,
                  storyId: focusStoryId ?? undefined,
                  taskId: focusTaskId ?? undefined,
                }}
                onSelect={handleTreeSelect}
              />
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
                <div className="change-design-reqs-header">
                  <span>Functional and non-functional requirements</span>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={Boolean(generatingReqs)}
                    onClick={() => void runGenerateRequirements()}
                  >
                    {generatingReqs === 'feature' ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    Populate with AI
                  </button>
                </div>
                <p className="code-link-hint">
                  Populate fills this feature and any user stories from the definition and architecture.
                </p>
                <label>
                  Functional requirements
                  <textarea
                    rows={4}
                    value={draft.functionalRequirements ?? ''}
                    placeholder="What the system shall do. Use Populate with AI or write bullets."
                    onChange={(e) => updateDraft({ functionalRequirements: e.target.value })}
                  />
                </label>
                <label>
                  Non-functional requirements
                  <textarea
                    rows={3}
                    value={draft.nonFunctionalRequirements ?? ''}
                    placeholder="Security, performance, reliability, observability, compliance."
                    onChange={(e) => updateDraft({ nonFunctionalRequirements: e.target.value })}
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
                <FeatureStoriesPanel
                  documentSystems={systems}
                  draft={draft}
                  focusStoryId={focusStoryId}
                  generatingId={generatingReqs}
                  sendingId={sendingAgent}
                  onChange={(next) => setDraft(next)}
                  onFocusStory={setFocusStoryId}
                  onGenerateStory={(storyId) => void runGenerateRequirements(storyId)}
                  onSendStory={(storyId) => void sendToAgent('story', storyId)}
                />
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
                    disabled={draft.tasks.length === 0 || generatingAll || Boolean(sendingAgent)}
                    onClick={() => void applyAll()}
                    title="Send this feature, its user stories, and component instructions to a coding agent"
                  >
                    {sendingAgent === 'feature' ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
                    Send feature to agent
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
                  const system = systems.find((item) => item.id === task.systemId)
                  const pathHint = formatTaskCodePath(task, system)
                  return (
                    <article
                      key={task.id}
                      data-task-id={task.id}
                      className={`change-design-task${focusTaskId === task.id ? ' is-active' : ''}`}
                    >
                      <div className="change-design-task-top">
                        <div>
                          <strong>{task.systemLabel}</strong>
                          <span className={`change-kind-badge kind-${task.changeKind ?? 'update'}`}>
                            {CHANGE_KIND_LABELS[task.changeKind ?? 'update']}
                          </span>
                          {task.status === 'applying' && <span className="change-design-missing">Applying</span>}
                          {task.status === 'applied' && <span className="change-kind-badge kind-applied">Applied</span>}
                          {missing && <span className="change-design-missing">Missing from canvas</span>}
                          {pathHint && <span className="change-design-code-path">{pathHint}</span>}
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
                            disabled={busyTaskId === task.id || generatingAll || Boolean(sendingAgent)}
                            onClick={() => void applyTask(task)}
                            title="Send this component instruction with its feature and user story"
                          >
                            {busyTaskId === task.id ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
                            Send to agent
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
                        User story
                        <select
                          value={task.storyId ?? ''}
                          onChange={(e) => {
                            const storyId = e.target.value || undefined
                            setDraft(assignTaskToStory(draft, task.id, storyId))
                            setFocusStoryId(storyId ?? null)
                          }}
                        >
                          <option value="">Unassigned</option>
                          {(draft.stories ?? []).map((story) => (
                            <option key={story.id} value={story.id}>
                              {story.title.trim() || 'Untitled story'}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Code path
                        <input
                          value={task.codePath ?? ''}
                          placeholder={system?.properties?.gitPath || 'src/…'}
                          onChange={(e) => updateTask(task.id, { codePath: e.target.value })}
                        />
                      </label>
                      <label>
                        Where to add
                        <textarea
                          rows={2}
                          value={task.addAt ?? ''}
                          placeholder="New files, folders, modules, and registration points"
                          onChange={(e) => updateTask(task.id, { addAt: e.target.value })}
                        />
                      </label>
                      <label>
                        Where to update
                        <textarea
                          rows={2}
                          value={task.updateAt ?? ''}
                          placeholder="Existing files, functions, configs, and callers to change"
                          onChange={(e) => updateTask(task.id, { updateAt: e.target.value })}
                        />
                      </label>
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
