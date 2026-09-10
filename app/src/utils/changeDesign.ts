import type {
  ArchitectureChangeKind,
  ArchitectureDocument,
  ComponentChangeTask,
  ComponentChangeTaskStatus,
  Integration,
  SystemNode,
  SystemType,
  TechnicalChangeDesign,
  ChangeDesignStatus,
} from '../types'
import {
  getIntegrationChangeStatus,
  getSystemChangeStatus,
  type ChangeStatus,
} from './architectureState'
import { buildBrowseUrl, getCodeLinkLabel, hasCodeLink } from './codeLink'
import { getProvider, loadAiSettings, type AiProviderId } from './aiProviders'
import {
  generateInstructionViaHost,
  isVsCodeHost,
  runLinkedAgent,
  type VsCodeAgentRequest,
} from './vscodeHost'

export const CHANGE_DESIGN_STATUSES: ChangeDesignStatus[] = ['draft', 'ready', 'in-progress', 'done']

export const CHANGE_DESIGN_STATUS_LABELS: Record<ChangeDesignStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  'in-progress': 'In progress',
  done: 'Done',
}

export const CHANGE_KIND_LABELS: Record<ArchitectureChangeKind, string> = {
  new: 'New',
  update: 'Update',
  retire: 'Retire',
}

export function changeKindFromStatus(status: ChangeStatus): ArchitectureChangeKind {
  if (status === 'new') return 'new'
  if (status === 'retired') return 'retire'
  return 'update'
}

export interface ArchitectureChange {
  kind: ArchitectureChangeKind
  ownerKind: 'system' | 'integration'
  id: string
  label: string
  systemIds: string[]
  detail: string
}

export function listArchitectureChanges(doc: ArchitectureDocument): ArchitectureChange[] {
  const systems = listDesignableSystems(doc)
  const labels = new Map(systems.map((item) => [item.id, item.pathLabel]))
  const rows: ArchitectureChange[] = []

  for (const system of systems) {
    if (system.changeStatus === 'unchanged') continue
    const kind = changeKindFromStatus(system.changeStatus)
    rows.push({
      kind,
      ownerKind: 'system',
      id: system.id,
      label: system.pathLabel,
      systemIds: [system.id],
      detail: `${CHANGE_KIND_LABELS[kind]} component · ${system.category}`,
    })
  }

  const integrations = flattenIntegrations(doc.systems, doc.integrations)
  for (const integration of integrations) {
    const status = getIntegrationChangeStatus(integration)
    if (status === 'unchanged') continue
    const kind = changeKindFromStatus(status)
    const source = labels.get(integration.source) ?? integration.source
    const target = labels.get(integration.target) ?? integration.target
    rows.push({
      kind,
      ownerKind: 'integration',
      id: integration.id,
      label: integration.label,
      systemIds: [integration.source, integration.target],
      detail: `${CHANGE_KIND_LABELS[kind]} flow ${source} → ${target} via ${integration.protocol}`,
    })
  }

  const order: Record<ArchitectureChangeKind, number> = { new: 0, update: 1, retire: 2 }
  return rows.sort((a, b) => order[a.kind] - order[b.kind] || a.label.localeCompare(b.label))
}

export function summarizeArchitectureChanges(doc: ArchitectureDocument): string {
  const changes = listArchitectureChanges(doc)
  if (changes.length === 0) {
    return 'No new, updated, or retired components are marked on the canvas yet. Set Architecture state on systems and integrations, then sync.'
  }
  const groups: Record<ArchitectureChangeKind, ArchitectureChange[]> = { new: [], update: [], retire: [] }
  for (const change of changes) groups[change.kind].push(change)
  const lines: string[] = []
  for (const kind of ['new', 'update', 'retire'] as ArchitectureChangeKind[]) {
    const items = groups[kind]
    if (items.length === 0) continue
    lines.push(`${CHANGE_KIND_LABELS[kind]} (${items.length})`)
    for (const item of items) {
      lines.push(`- ${item.label}: ${item.detail}`)
    }
  }
  return lines.join('\n')
}

export function countTasksByKind(
  design: TechnicalChangeDesign,
): Record<ArchitectureChangeKind, number> {
  const counts: Record<ArchitectureChangeKind, number> = { new: 0, update: 0, retire: 0 }
  for (const task of design.tasks) counts[task.changeKind ?? 'update'] += 1
  return counts
}

export function syncTasksFromArchitecture(
  doc: ArchitectureDocument,
  design: TechnicalChangeDesign,
): TechnicalChangeDesign {
  const systems = listDesignableSystems(doc)
  const changed = systems.filter((item) => item.changeStatus !== 'unchanged')
  const existingBySystem = new Map(design.tasks.map((task) => [task.systemId, task]))
  const relatedFlows = listArchitectureChanges(doc).filter((item) => item.ownerKind === 'integration')
  const tasks = (changed.length > 0 ? changed : design.tasks.map((task) => {
    const system = systems.find((item) => item.id === task.systemId)
    return system ?? null
  }).filter((item): item is DesignableSystem => Boolean(item))).map((system) => {
    const previous = existingBySystem.get(system.id)
    const kind = changeKindFromStatus(system.changeStatus === 'unchanged' ? 'modified' : system.changeStatus)
    const flowNotes = relatedFlows
      .filter((item) => item.systemIds.includes(system.id))
      .map((item) => item.detail)
    const intent = previous?.intent?.trim() && !isDefaultIntent(previous.intent)
      ? previous.intent
      : [defaultIntent(system), ...flowNotes].filter(Boolean).join('\n')
    return {
      id: previous?.id ?? newId('task'),
      systemId: system.id,
      systemLabel: system.pathLabel !== system.label ? system.pathLabel : system.label,
      changeKind: kind,
      intent,
      instruction: previous?.instruction,
      instructionGeneratedAt: previous?.instructionGeneratedAt,
      appliedAt: previous?.appliedAt,
      status: previous?.status ?? 'pending',
    } satisfies ComponentChangeTask
  })

  return {
    ...design,
    proposedChange: design.proposedChange.trim() || summarizeArchitectureChanges(doc),
    updatedAt: new Date().toISOString(),
    tasks,
  }
}

function isDefaultIntent(intent: string): boolean {
  return /^(Implement this new |Update .+ for the proposed design|Retire |Apply the feature change)/.test(intent)
}

export interface DesignableSystem {
  id: string
  label: string
  type: SystemType
  category: string
  pathLabel: string
  changeStatus: ChangeStatus
  properties?: SystemNode['properties']
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

export function listDesignableSystems(doc: ArchitectureDocument): DesignableSystem[] {
  const out: DesignableSystem[] = []
  walkSystems(doc.systems, [], out)
  return out
}

function walkSystems(systems: SystemNode[], trail: string[], out: DesignableSystem[]) {
  for (const system of systems) {
    const skip = system.type === 'note' || system.type === 'group' || system.type === 'shape'
    const pathLabel = [...trail, system.label].join(' / ')
    if (!skip) {
      out.push({
        id: system.id,
        label: system.label,
        type: system.type,
        category: system.category,
        pathLabel,
        changeStatus: getSystemChangeStatus(system),
        properties: system.properties,
      })
    }
    if (system.subDiagram?.systems.length) {
      walkSystems(system.subDiagram.systems, [...trail, system.label], out)
    }
  }
}

function flattenIntegrations(systems: SystemNode[], integrations: Integration[]): Integration[] {
  const rows = [...integrations]
  for (const system of systems) {
    if (system.subDiagram) {
      rows.push(...flattenIntegrations(system.subDiagram.systems, system.subDiagram.integrations))
    }
  }
  return rows
}

export function collectChangeTaskSystemIds(doc: ArchitectureDocument): Set<string> {
  const ids = new Set<string>()
  for (const design of doc.changeDesigns ?? []) {
    for (const task of design.tasks) ids.add(task.systemId)
  }
  return ids
}

export function tasksForSystem(
  doc: ArchitectureDocument,
  systemId: string,
): Array<{ design: TechnicalChangeDesign; task: ComponentChangeTask }> {
  const rows: Array<{ design: TechnicalChangeDesign; task: ComponentChangeTask }> = []
  for (const design of doc.changeDesigns ?? []) {
    for (const task of design.tasks) {
      if (task.systemId === systemId) rows.push({ design, task })
    }
  }
  return rows
}

export function createEmptyDesign(
  doc: ArchitectureDocument,
  seedSystemId?: string,
): TechnicalChangeDesign {
  const now = new Date().toISOString()
  const systems = listDesignableSystems(doc)
  const seed = seedSystemId
    ? systems.filter((item) => item.id === seedSystemId)
    : systems.filter((item) => item.changeStatus !== 'unchanged')

  return {
    id: newId('design'),
    title: '',
    definition: '',
    problem: '',
    proposedChange: summarizeArchitectureChanges(doc),
    acceptanceCriteria: '',
    notes: '',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    tasks: seed.map((item) => createTaskFromSystem(item)),
  }
}

export function createTaskFromSystem(system: DesignableSystem, intent = ''): ComponentChangeTask {
  return {
    id: newId('task'),
    systemId: system.id,
    systemLabel: system.pathLabel !== system.label ? system.pathLabel : system.label,
    changeKind: changeKindFromStatus(system.changeStatus === 'unchanged' ? 'modified' : system.changeStatus),
    intent: intent || defaultIntent(system),
    status: 'pending',
  }
}

function defaultIntent(system: DesignableSystem): string {
  if (system.changeStatus === 'new') {
    return `Implement this new ${system.label} component so it matches the proposed design.`
  }
  if (system.changeStatus === 'modified') {
    return `Update ${system.label} for the proposed design while keeping existing contracts stable unless the design says otherwise.`
  }
  if (system.changeStatus === 'retired') {
    return `Retire ${system.label}: remove or disable its code paths, and stop callers from depending on it.`
  }
  return `Apply the feature change in ${system.label}.`
}

export function upsertDesign(
  designs: TechnicalChangeDesign[] | undefined,
  next: TechnicalChangeDesign,
): TechnicalChangeDesign[] {
  const list = designs ?? []
  const updated = { ...next, updatedAt: new Date().toISOString() }
  const index = list.findIndex((item) => item.id === updated.id)
  if (index < 0) return [...list, updated]
  return list.map((item, i) => (i === index ? updated : item))
}

export function removeDesign(
  designs: TechnicalChangeDesign[] | undefined,
  designId: string,
): TechnicalChangeDesign[] {
  return (designs ?? []).filter((item) => item.id !== designId)
}

export function patchTask(
  design: TechnicalChangeDesign,
  taskId: string,
  patch: Partial<ComponentChangeTask>,
): TechnicalChangeDesign {
  return {
    ...design,
    updatedAt: new Date().toISOString(),
    tasks: design.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
  }
}

export function patchTaskInDesigns(
  designs: TechnicalChangeDesign[] | undefined,
  designId: string,
  taskId: string,
  patch: Partial<ComponentChangeTask>,
): TechnicalChangeDesign[] {
  return (designs ?? []).map((design) =>
    design.id === designId ? patchTask(design, taskId, patch) : design,
  )
}

const DESIGN_STATUSES = new Set<ChangeDesignStatus>(CHANGE_DESIGN_STATUSES)
const TASK_STATUSES = new Set<ComponentChangeTaskStatus>([
  'pending',
  'instructed',
  'applying',
  'applied',
  'failed',
])
const CHANGE_KINDS = new Set<ArchitectureChangeKind>(['new', 'update', 'retire'])

function parseTaskStatus(value: unknown): ComponentChangeTaskStatus {
  if (value === 'copied') return 'instructed'
  if (value === 'done') return 'applied'
  if (TASK_STATUSES.has(value as ComponentChangeTaskStatus)) return value as ComponentChangeTaskStatus
  return 'pending'
}

export function sanitizeChangeDesigns(raw: unknown): TechnicalChangeDesign[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const designs: TechnicalChangeDesign[] = []
  for (const item of raw) {
    const design = sanitizeDesign(item)
    if (design) designs.push(design)
  }
  return designs.length > 0 ? designs : undefined
}

function sanitizeDesign(raw: unknown): TechnicalChangeDesign | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const id = asString(input.id) || newId('design')
  const title = asString(input.title)
  const tasks = Array.isArray(input.tasks)
    ? input.tasks.map(sanitizeTask).filter((task): task is ComponentChangeTask => Boolean(task))
    : []
  const status = DESIGN_STATUSES.has(input.status as ChangeDesignStatus)
    ? (input.status as ChangeDesignStatus)
    : 'draft'
  return {
    id,
    title,
    definition: asString(input.definition) || undefined,
    problem: asString(input.problem),
    proposedChange: asString(input.proposedChange),
    acceptanceCriteria: asString(input.acceptanceCriteria),
    notes: asString(input.notes) || undefined,
    status,
    createdAt: asString(input.createdAt) || new Date().toISOString(),
    updatedAt: asString(input.updatedAt) || new Date().toISOString(),
    tasks,
  }
}

function sanitizeTask(raw: unknown): ComponentChangeTask | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const systemId = asString(input.systemId)
  if (!systemId) return null
  const status = parseTaskStatus(input.status)
  const changeKind = CHANGE_KINDS.has(input.changeKind as ArchitectureChangeKind)
    ? (input.changeKind as ArchitectureChangeKind)
    : 'update'
  return {
    id: asString(input.id) || newId('task'),
    systemId,
    systemLabel: asString(input.systemLabel) || systemId,
    changeKind,
    intent: asString(input.intent),
    instruction: asString(input.instruction) || undefined,
    instructionGeneratedAt: asString(input.instructionGeneratedAt) || undefined,
    appliedAt: asString(input.appliedAt) || undefined,
    status,
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function buildInstructionMarkdown(
  doc: ArchitectureDocument,
  design: TechnicalChangeDesign,
  task: ComponentChangeTask,
): string {
  const systems = listDesignableSystems(doc)
  const system = systems.find((item) => item.id === task.systemId)
  const labelMap = new Map(systems.map((item) => [item.id, item.pathLabel]))
  const integrations = flattenIntegrations(doc.systems, doc.integrations).filter(
    (item) => item.source === task.systemId || item.target === task.systemId,
  )
  const props = system?.properties
  const codeLabel = props && hasCodeLink(props) ? getCodeLinkLabel(props) : ''
  const codeUrl = props ? buildBrowseUrl(props) : null
  const workItem =
    props?.jiraIssueKey || props?.adoWorkItemTitle
      ? [props.jiraIssueKey, props.jiraIssueSummary, props.adoWorkItemTitle].filter(Boolean).join(' — ')
      : ''

  const integrationLines = integrations.map((item) => {
    const otherId = item.source === task.systemId ? item.target : item.source
    const other = labelMap.get(otherId) ?? otherId
    const dir = item.source === task.systemId ? 'outbound to' : 'inbound from'
    return `- ${dir} ${other}: ${item.label} via ${item.protocol} (${item.frequency})`
  })

  const changeKind = task.changeKind ?? changeKindFromStatus(system?.changeStatus ?? 'modified')
  const definition = design.definition?.trim() || design.proposedChange.trim()
  const lines = [
    `# Coding agent task: ${task.systemLabel}`,
    '',
    `You are a coding agent. Implement this change in **${task.systemLabel}** only. Do not modify unrelated services.`,
    '',
    `## Change type: ${CHANGE_KIND_LABELS[changeKind].toUpperCase()}`,
    changeKind === 'new'
      ? 'Create this capability. It does not exist in the current codebase.'
      : changeKind === 'retire'
        ? 'Remove or disable this capability and stop callers from depending on it.'
        : 'Update the existing capability. Keep contracts stable unless the feature definition says otherwise.',
    '',
    '## Feature definition',
    `**${design.title.trim() || 'Untitled feature'}**`,
    definition || '_No feature definition written yet._',
    '',
    '## Problem',
    design.problem.trim() || '_No problem statement._',
    '',
    '## Architecture translation',
    design.proposedChange.trim() || '_No architecture new/update notes._',
    '',
    '## This component',
    `- Name: ${system?.label ?? task.systemLabel}`,
    `- Type: ${system?.type ?? 'unknown'} · ${system?.category ?? ''}`,
    `- Change: ${CHANGE_KIND_LABELS[changeKind]}`,
    system?.pathLabel && system.pathLabel !== system.label ? `- Diagram path: ${system.pathLabel}` : '',
    props?.description ? `- Role: ${props.description}` : '',
    system ? `- Architecture state: ${system.changeStatus}` : '',
    codeLabel ? `- Code: ${codeLabel}` : '- Code: no repository linked on this component',
    codeUrl ? `- Browse: ${codeUrl}` : '',
    props?.gitBranch ? `- Branch: ${props.gitBranch}` : '',
    props?.gitPath ? `- Path: ${props.gitPath}` : '',
    workItem ? `- Work item: ${workItem}` : '',
    '',
    '## Integrations',
    integrationLines.length > 0 ? integrationLines.join('\n') : '- None recorded on the diagram',
    '',
    '## Required change for this component',
    task.intent.trim() || '_No component-specific intent. Follow the feature description._',
    '',
    '## Acceptance criteria',
    design.acceptanceCriteria.trim() || '_None listed. Infer checks from the required change._',
    '',
    design.notes?.trim() ? '## Notes' : '',
    design.notes?.trim() ?? '',
    '',
    '## Constraints',
    '- Stay scoped to this component and its linked codebase path.',
    '- Match existing code style, tests, and naming.',
    '- Do not invent credentials, secrets, or unrelated systems.',
    '- If a repo or path is linked, work there. If not, locate the matching module from the component name before editing.',
    '- Call out follow-up work that belongs in another component instead of implementing it here.',
  ]

  return lines.filter((line) => line !== '').join('\n').replace(/\n{3,}/g, '\n\n')
}

export function buildApplyInstruction(
  doc: ArchitectureDocument,
  design: TechnicalChangeDesign,
  task: ComponentChangeTask,
): string {
  const kind = CHANGE_KIND_LABELS[task.changeKind ?? 'update'].toUpperCase()
  const body = task.instruction?.trim() || buildInstructionMarkdown(doc, design, task)
  return [
    '# APPLY CODE CHANGES NOW',
    '',
    'You must edit the workspace. Do not stop at a plan or a summary.',
    `This is a **${kind}** architecture change for **${task.systemLabel}**.`,
    kind === 'NEW'
      ? 'Add the new code, config, and tests.'
      : kind === 'RETIRE'
        ? 'Delete or disable the old paths and update callers.'
        : 'Update the existing implementation in place.',
    '',
    'Use the feature definition below as the source of truth.',
    '',
    body,
  ].join('\n')
}

export function buildDesignPackMarkdown(doc: ArchitectureDocument, design: TechnicalChangeDesign): string {
  const counts = countTasksByKind(design)
  const parts = [
    `# ${design.title.trim() || 'Feature'}`,
    '',
    design.definition?.trim() ? `## Feature definition\n${design.definition.trim()}` : '',
    design.problem.trim() ? `## Problem\n${design.problem.trim()}` : '',
    design.proposedChange.trim() ? `## Architecture translation (new / update)\n${design.proposedChange.trim()}` : '',
    design.acceptanceCriteria.trim() ? `## Acceptance criteria\n${design.acceptanceCriteria.trim()}` : '',
    '',
    `Apply as ${counts.new} new, ${counts.update} update, ${counts.retire} retire component job${design.tasks.length === 1 ? '' : 's'}.`,
  ]

  for (const task of design.tasks) {
    parts.push('', '---', '', task.instruction?.trim() || buildInstructionMarkdown(doc, design, task))
  }

  return parts.filter((line) => line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function designFileSlug(title: string): string {
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug || 'technical-change'
}

export interface GeneratedInstruction {
  instruction: string
  source: 'ai' | 'template'
  error?: string
}

export async function applyComponentChange(options: {
  document: ArchitectureDocument
  design: TechnicalChangeDesign
  task: ComponentChangeTask
}): Promise<{ mode: 'vscode' | 'clipboard'; instruction: string }> {
  const instruction = buildApplyInstruction(options.document, options.design, options.task)
  const payload = buildAgentRunPayload(options.document, options.design, options.task, true)
  payload.instruction = instruction
  if (isVsCodeHost()) {
    runLinkedAgent(payload)
    return { mode: 'vscode', instruction }
  }
  await copyText(instruction)
  downloadMarkdown(
    `${designFileSlug(options.design.title)}-${options.task.systemId}-apply.md`,
    instruction,
  )
  return { mode: 'clipboard', instruction }
}

export function buildAgentRunPayload(
  doc: ArchitectureDocument,
  design: TechnicalChangeDesign,
  task: ComponentChangeTask,
  apply = false,
): VsCodeAgentRequest {
  const system = listDesignableSystems(doc).find((item) => item.id === task.systemId)
  return {
    instruction: apply
      ? buildApplyInstruction(doc, design, task)
      : task.instruction?.trim() || buildInstructionMarkdown(doc, design, task),
    systemLabel: task.systemLabel,
    gitPath: system?.properties?.gitPath,
    gitRepo: system?.properties?.gitRepo,
    apply,
    changeKind: task.changeKind,
  }
}

export async function generateComponentInstruction(options: {
  document: ArchitectureDocument
  design: TechnicalChangeDesign
  task: ComponentChangeTask
  providerId?: AiProviderId
}): Promise<GeneratedInstruction> {
  const template = buildInstructionMarkdown(options.document, options.design, options.task)
  const settings = loadAiSettings()
  const provider = options.providerId ?? settings.selectedProvider
  const info = getProvider(provider)
  const key = settings.keys[provider]?.trim() ?? ''

  const prompt =
    `Write a self-contained coding-agent instruction for this component. The feature definition is the source of truth. This architecture change is ${CHANGE_KIND_LABELS[options.task.changeKind] ?? 'Update'} (new = create, update = modify existing, retire = remove). Refine the draft; keep markdown; stay scoped to this component.`
  const context = [
    `Architecture: ${options.document.metadata.name}`,
    options.document.metadata.description ? `Description: ${options.document.metadata.description}` : '',
    '',
    'Draft instruction to refine:',
    template,
  ]
    .filter((line) => line !== undefined)
    .join('\n')

  if (isVsCodeHost()) {
    try {
      const text = await generateInstructionViaHost(prompt, context)
      if (text.trim()) return { instruction: stripOuterFence(text), source: 'ai' }
      return {
        instruction: template,
        source: 'template',
        error: 'VS Code returned an empty instruction',
      }
    } catch (err) {
      return {
        instruction: template,
        source: 'template',
        error: err instanceof Error ? err.message : 'VS Code language model was unavailable',
      }
    }
  }

  try {
    const response = await fetch('/api/ai/instruct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        context,
        provider,
        apiKey: key,
        azureEndpoint: settings.azureEndpoint,
        azureDeployment: settings.azureDeployment,
      }),
    })
    const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string }
    if (!response.ok) {
      throw new Error(payload.error || `${info.label} instruction failed (${response.status})`)
    }
    const text = payload.text?.trim()
    if (!text) throw new Error(`${info.shortLabel} returned an empty instruction`)
    return { instruction: stripOuterFence(text), source: 'ai' }
  } catch (err) {
    return {
      instruction: template,
      source: 'template',
      error: err instanceof Error ? err.message : 'Could not reach the AI proxy',
    }
  }
}

function stripOuterFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)```$/i)
  return (fenced?.[1] ?? trimmed).trim()
}
