import type {
  ArchitectureChangeKind,
  ArchitectureDocument,
  ComponentChangeTask,
  ComponentChangeTaskStatus,
  FeatureUserStory,
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
import { getEngineApiKey, getProvider, loadAiSettings, type AiProviderId } from './aiProviders'
import { aiFetch } from './aiApi'
import {
  generateInstructionViaHost,
  isVsCodeHost,
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
    const seeded = seedCodeLocations(system, kind, previous)
    return {
      id: previous?.id ?? newId('task'),
      systemId: system.id,
      systemLabel: system.pathLabel !== system.label ? system.pathLabel : system.label,
      changeKind: kind,
      intent,
      storyId: previous?.storyId,
      codePath: seeded.codePath,
      addAt: seeded.addAt,
      updateAt: seeded.updateAt,
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

export function flattenIntegrations(systems: SystemNode[], integrations: Integration[]): Integration[] {
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
    stories: [],
    tasks: seed.map((item) => createTaskFromSystem(item)),
  }
}

export function createEmptyStory(title = ''): FeatureUserStory {
  return {
    id: newId('story'),
    title,
    description: '',
    acceptanceCriteria: '',
    systemIds: [],
  }
}

export function createTaskFromSystem(system: DesignableSystem, intent = ''): ComponentChangeTask {
  const changeKind = changeKindFromStatus(system.changeStatus === 'unchanged' ? 'modified' : system.changeStatus)
  const seeded = seedCodeLocations(system, changeKind)
  return {
    id: newId('task'),
    systemId: system.id,
    systemLabel: system.pathLabel !== system.label ? system.pathLabel : system.label,
    changeKind,
    intent: intent || defaultIntent(system),
    codePath: seeded.codePath,
    addAt: seeded.addAt,
    updateAt: seeded.updateAt,
    status: 'pending',
  }
}

function systemGitPath(system?: DesignableSystem | null): string {
  return system?.properties?.gitPath?.trim() ?? ''
}

function seedCodeLocations(
  system: DesignableSystem,
  kind: ArchitectureChangeKind,
  previous?: ComponentChangeTask,
): Pick<ComponentChangeTask, 'codePath' | 'addAt' | 'updateAt'> {
  const codePath = previous?.codePath?.trim() || systemGitPath(system) || undefined
  const addAt =
    previous?.addAt?.trim() ||
    (kind === 'new' && codePath ? `Add new files, modules, and registration points under ${codePath}` : undefined)
  const updateAt =
    previous?.updateAt?.trim() ||
    (kind === 'update' && codePath
      ? `Update existing files under ${codePath}`
      : kind === 'retire' && codePath
        ? `Remove or disconnect code under ${codePath} and update callers`
        : undefined)
  return { codePath, addAt, updateAt }
}

export function formatTaskCodePath(
  task: ComponentChangeTask,
  system?: DesignableSystem | null,
): string {
  const path = task.codePath?.trim() || systemGitPath(system)
  const repo = system?.properties?.gitRepo?.trim()
  const branch = system?.properties?.gitBranch?.trim()
  const parts = [repo, path].filter(Boolean)
  const joined = parts.join(' / ')
  if (joined && branch) return `${joined} @ ${branch}`
  return joined
}

export function assignTaskToStory(
  design: TechnicalChangeDesign,
  taskId: string,
  storyId: string | undefined,
): TechnicalChangeDesign {
  const task = design.tasks.find((item) => item.id === taskId)
  if (!task) return design
  const stories = (design.stories ?? []).map((story) => {
    const has = story.systemIds.includes(task.systemId)
    if (story.id === storyId) {
      return has ? story : { ...story, systemIds: [...story.systemIds, task.systemId] }
    }
    if (has) return { ...story, systemIds: story.systemIds.filter((id) => id !== task.systemId) }
    return story
  })
  return {
    ...design,
    updatedAt: new Date().toISOString(),
    stories,
    tasks: design.tasks.map((item) => (item.id === taskId ? { ...item, storyId } : item)),
  }
}

export function upsertStory(
  design: TechnicalChangeDesign,
  story: FeatureUserStory,
): TechnicalChangeDesign {
  const list = design.stories ?? []
  const index = list.findIndex((item) => item.id === story.id)
  const stories = index < 0 ? [...list, story] : list.map((item, i) => (i === index ? story : item))
  return { ...design, stories, updatedAt: new Date().toISOString() }
}

export function removeStory(design: TechnicalChangeDesign, storyId: string): TechnicalChangeDesign {
  return {
    ...design,
    updatedAt: new Date().toISOString(),
    stories: (design.stories ?? []).filter((item) => item.id !== storyId),
    tasks: design.tasks.map((task) =>
      task.storyId === storyId ? { ...task, storyId: undefined } : task,
    ),
  }
}

export function assignSystemsToStory(
  design: TechnicalChangeDesign,
  storyId: string,
  systemIds: string[],
  systems: DesignableSystem[],
): TechnicalChangeDesign {
  const idSet = new Set(systemIds)
  const stories = (design.stories ?? []).map((story) => {
    if (story.id === storyId) return { ...story, systemIds: [...systemIds] }
    return { ...story, systemIds: story.systemIds.filter((id) => !idSet.has(id)) }
  })
  const existing = new Map(design.tasks.map((task) => [task.systemId, task]))
  const tasks = [...design.tasks]
  for (const systemId of systemIds) {
    if (existing.has(systemId)) continue
    const system = systems.find((item) => item.id === systemId)
    if (!system) continue
    const task = { ...createTaskFromSystem(system), storyId }
    tasks.push(task)
    existing.set(systemId, task)
  }
  return {
    ...design,
    updatedAt: new Date().toISOString(),
    stories,
    tasks: tasks.map((task) => {
      if (idSet.has(task.systemId)) return { ...task, storyId }
      if (task.storyId === storyId) return { ...task, storyId: undefined }
      return task
    }),
  }
}

export function countStories(designs: TechnicalChangeDesign[]): number {
  return designs.reduce((sum, design) => sum + (design.stories?.length ?? 0), 0)
}

export interface FeatureTreeNode {
  type: 'feature' | 'story' | 'unassigned' | 'component'
  id: string
  label: string
  meta: string
  designId: string
  storyId?: string
  taskId?: string
  systemId?: string
  changeKind?: ArchitectureChangeKind
  children: FeatureTreeNode[]
}

export function buildFeatureTree(designs: TechnicalChangeDesign[]): FeatureTreeNode[] {
  return designs.map((design) => buildFeatureTreeNode(design))
}

export function buildFeatureTreeNode(design: TechnicalChangeDesign): FeatureTreeNode {
  const stories = design.stories ?? []
  const assigned = new Set(stories.flatMap((story) => story.systemIds))
  const storyNodes: FeatureTreeNode[] = stories.map((story) => {
    const tasks = design.tasks.filter(
      (task) => task.storyId === story.id || story.systemIds.includes(task.systemId),
    )
    return {
      type: 'story',
      id: `${design.id}:${story.id}`,
      label: story.title.trim() || 'Untitled story',
      meta: `${tasks.length} component${tasks.length === 1 ? '' : 's'}`,
      designId: design.id,
      storyId: story.id,
      children: tasks.map((task) => componentTreeNode(design, task)),
    }
  })
  const unassigned = design.tasks.filter(
    (task) => !task.storyId && !assigned.has(task.systemId),
  )
  if (unassigned.length > 0 || stories.length === 0) {
    const children = (stories.length === 0 ? design.tasks : unassigned).map((task) =>
      componentTreeNode(design, task),
    )
    if (children.length > 0) {
      storyNodes.push({
        type: stories.length === 0 ? 'story' : 'unassigned',
        id: `${design.id}:unassigned`,
        label: stories.length === 0 ? 'Linked components' : 'Unassigned components',
        meta: `${children.length} component${children.length === 1 ? '' : 's'}`,
        designId: design.id,
        children,
      })
    }
  }
  const storyCount = stories.length
  return {
    type: 'feature',
    id: design.id,
    label: design.title.trim() || 'Untitled feature',
    meta: `${CHANGE_DESIGN_STATUS_LABELS[design.status]} · ${storyCount} stor${storyCount === 1 ? 'y' : 'ies'} · ${design.tasks.length} component${design.tasks.length === 1 ? '' : 's'}`,
    designId: design.id,
    children: storyNodes,
  }
}

function componentTreeNode(design: TechnicalChangeDesign, task: ComponentChangeTask): FeatureTreeNode {
  const path = task.codePath?.trim()
  const kind = CHANGE_KIND_LABELS[task.changeKind ?? 'update']
  return {
    type: 'component',
    id: `${design.id}:${task.id}`,
    label: task.systemLabel,
    meta: path ? `${kind} · ${path}` : kind,
    designId: design.id,
    storyId: task.storyId,
    taskId: task.id,
    systemId: task.systemId,
    changeKind: task.changeKind,
    children: [],
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
  const stories = Array.isArray(input.stories)
    ? input.stories.map(sanitizeStory).filter((story): story is FeatureUserStory => Boolean(story))
    : []
  return {
    id,
    title,
    definition: asString(input.definition) || undefined,
    problem: asString(input.problem),
    proposedChange: asString(input.proposedChange),
    acceptanceCriteria: asString(input.acceptanceCriteria),
    functionalRequirements: asString(input.functionalRequirements) || undefined,
    nonFunctionalRequirements: asString(input.nonFunctionalRequirements) || undefined,
    notes: asString(input.notes) || undefined,
    status,
    createdAt: asString(input.createdAt) || new Date().toISOString(),
    updatedAt: asString(input.updatedAt) || new Date().toISOString(),
    stories: stories.length > 0 ? stories : undefined,
    tasks,
  }
}

function sanitizeStory(raw: unknown): FeatureUserStory | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const systemIds = Array.isArray(input.systemIds)
    ? input.systemIds.map(asString).filter(Boolean)
    : []
  return {
    id: asString(input.id) || newId('story'),
    title: asString(input.title),
    description: asString(input.description) || undefined,
    acceptanceCriteria: asString(input.acceptanceCriteria) || undefined,
    functionalRequirements: asString(input.functionalRequirements) || undefined,
    nonFunctionalRequirements: asString(input.nonFunctionalRequirements) || undefined,
    systemIds,
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
    storyId: asString(input.storyId) || undefined,
    codePath: asString(input.codePath) || undefined,
    addAt: asString(input.addAt) || undefined,
    updateAt: asString(input.updateAt) || undefined,
    instruction: asString(input.instruction) || undefined,
    instructionGeneratedAt: asString(input.instructionGeneratedAt) || undefined,
    appliedAt: asString(input.appliedAt) || undefined,
    status,
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function describeAddLocation(
  task: ComponentChangeTask,
  kind: ArchitectureChangeKind,
  codePath: string,
): string {
  if (task.addAt?.trim()) return task.addAt.trim()
  if (kind === 'new') {
    return codePath
      ? `Create the new capability under \`${codePath}\`. Add files, modules, exports, and registration/wiring there. Do not scatter the new code under other roots.`
      : 'No path is linked. Locate the matching module from the component name, add files next to related code, and record the chosen path in your summary.'
  }
  if (kind === 'retire') {
    return 'Do not add replacement code unless the feature definition requires a shim. If a shim is required, put it next to the code you are removing.'
  }
  return codePath
    ? `If this change needs new files, add them under \`${codePath}\` next to the code you are updating.`
    : 'Add new files next to the existing implementation you are changing, not in an unrelated folder.'
}

function describeUpdateLocation(
  task: ComponentChangeTask,
  kind: ArchitectureChangeKind,
  codePath: string,
): string {
  if (task.updateAt?.trim()) return task.updateAt.trim()
  if (kind === 'new') {
    return codePath
      ? `Wire the new capability into existing config, DI, routes, or callers that already live under or next to \`${codePath}\`. Name those files.`
      : 'Wire the new capability into existing config, DI, routes, or callers. Name those files. Do not restyle unrelated modules.'
  }
  if (kind === 'retire') {
    return codePath
      ? `Remove or disable the implementation under \`${codePath}\`. Update callers, config, and tests so nothing depends on it.`
      : 'Remove or disable this implementation and update callers, config, and tests so nothing depends on it.'
  }
  return codePath
    ? `Change the existing implementation under \`${codePath}\`. Keep public contracts stable unless the feature definition says otherwise. Name the files and functions to edit.`
    : 'Change the existing implementation for this component. Keep public contracts stable unless the feature definition says otherwise. Name the files and functions to edit.'
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
  const story = (design.stories ?? []).find((item) => item.id === task.storyId)
  const codePath = task.codePath?.trim() || props?.gitPath?.trim() || ''
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
    story
      ? `## User story\n**${story.title.trim() || 'Untitled story'}**\n${story.description?.trim() || '_No story description._'}${
          story.acceptanceCriteria?.trim()
            ? `\n\nStory acceptance:\n${story.acceptanceCriteria.trim()}`
            : ''
        }${
          story.functionalRequirements?.trim()
            ? `\n\nStory functional requirements:\n${story.functionalRequirements.trim()}`
            : ''
        }${
          story.nonFunctionalRequirements?.trim()
            ? `\n\nStory non-functional requirements:\n${story.nonFunctionalRequirements.trim()}`
            : ''
        }`
      : '',
    '',
    design.functionalRequirements?.trim()
      ? `## Feature functional requirements\n${design.functionalRequirements.trim()}`
      : '',
    design.nonFunctionalRequirements?.trim()
      ? `## Feature non-functional requirements\n${design.nonFunctionalRequirements.trim()}`
      : '',
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
    workItem ? `- Work item: ${workItem}` : '',
    '',
    '## Code path',
    codeLabel ? `- Linked code: ${codeLabel}` : '- Linked code: no repository linked on this component',
    codeUrl ? `- Browse: ${codeUrl}` : '',
    props?.gitRepo ? `- Repository: ${props.gitRepo}` : '',
    props?.gitBranch ? `- Branch: ${props.gitBranch}` : '',
    codePath ? `- Work in this path: \`${codePath}\`` : '- Work path: not linked. Locate the matching module from the component name and state the path you chose.',
    'Stay inside this path. Do not edit unrelated folders.',
    '',
    '## Where to add',
    describeAddLocation(task, changeKind, codePath),
    '',
    changeKind === 'retire' ? '## Where to remove / update callers' : '## Where to update',
    describeUpdateLocation(task, changeKind, codePath),
    '',
    '## Integrations',
    integrationLines.length > 0 ? integrationLines.join('\n') : '- None recorded on the diagram',
    '',
    '## Required change for this component',
    task.intent.trim() || '_No component-specific intent. Follow the feature description._',
    '',
    '## Acceptance criteria',
    [story?.acceptanceCriteria?.trim(), design.acceptanceCriteria.trim()].filter(Boolean).join('\n\n')
      || '_None listed. Infer checks from the required change._',
    '',
    design.notes?.trim() ? '## Notes' : '',
    design.notes?.trim() ?? '',
    '',
    '## Constraints',
    '- Stay scoped to this component and its linked codebase path.',
    '- Name concrete files under Where to add and Where to update. If you must guess, mark guesses.',
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

export function tasksForStory(
  design: TechnicalChangeDesign,
  storyId: string,
): ComponentChangeTask[] {
  const story = (design.stories ?? []).find((item) => item.id === storyId)
  return design.tasks.filter(
    (task) => task.storyId === storyId || Boolean(story?.systemIds.includes(task.systemId)),
  )
}

export function buildStoryPackMarkdown(
  doc: ArchitectureDocument,
  design: TechnicalChangeDesign,
  story: FeatureUserStory,
): string {
  const linked = tasksForStory(design, story.id)
  const parts = [
    `# User story: ${story.title.trim() || 'Untitled story'}`,
    '',
    `Part of feature **${design.title.trim() || 'Untitled feature'}**.`,
    '',
    design.definition?.trim() ? `## Feature definition\n${design.definition.trim()}` : '',
    story.description?.trim() ? `## Story\n${story.description.trim()}` : '',
    story.acceptanceCriteria?.trim() ? `## Story acceptance\n${story.acceptanceCriteria.trim()}` : '',
    story.functionalRequirements?.trim()
      ? `## Story functional requirements\n${story.functionalRequirements.trim()}`
      : '',
    story.nonFunctionalRequirements?.trim()
      ? `## Story non-functional requirements\n${story.nonFunctionalRequirements.trim()}`
      : '',
    design.functionalRequirements?.trim()
      ? `## Feature functional requirements\n${design.functionalRequirements.trim()}`
      : '',
    design.nonFunctionalRequirements?.trim()
      ? `## Feature non-functional requirements\n${design.nonFunctionalRequirements.trim()}`
      : '',
    '',
    `Implement ${linked.length} linked component job${linked.length === 1 ? '' : 's'} for this story only.`,
  ]

  for (const task of linked) {
    parts.push('', '---', '', task.instruction?.trim() || buildInstructionMarkdown(doc, design, task))
  }

  return parts.filter((line) => line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n')
}

export function wrapAgentApplyPrompt(scopeLabel: string, body: string): string {
  return [
    '# APPLY ARCHITECTURE CHANGE NOW',
    '',
    'You are a coding agent. Edit the workspace. Do not stop at a plan or a summary.',
    `Scope: ${scopeLabel}.`,
    'Honor the feature definition and user stories below. Implement only the linked components.',
    'Stay inside the named code paths. Do not invent secrets or unrelated systems.',
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
    design.functionalRequirements?.trim()
      ? `## Functional requirements\n${design.functionalRequirements.trim()}`
      : '',
    design.nonFunctionalRequirements?.trim()
      ? `## Non-functional requirements\n${design.nonFunctionalRequirements.trim()}`
      : '',
    ...(design.stories?.length
      ? [
          '## User stories',
          ...design.stories.map((story) => {
            const linked = design.tasks.filter(
              (task) => task.storyId === story.id || story.systemIds.includes(task.systemId),
            )
            const components = linked
              .map((task) => {
                const path = task.codePath?.trim()
                return `- ${task.systemLabel} (${CHANGE_KIND_LABELS[task.changeKind ?? 'update']}${path ? ` · ${path}` : ''})`
              })
              .join('\n')
            return `### ${story.title.trim() || 'Untitled story'}\n${story.description?.trim() || ''}${
              story.acceptanceCriteria?.trim() ? `\n\nAcceptance:\n${story.acceptanceCriteria.trim()}` : ''
            }${
              story.functionalRequirements?.trim()
                ? `\n\nFunctional requirements:\n${story.functionalRequirements.trim()}`
                : ''
            }${
              story.nonFunctionalRequirements?.trim()
                ? `\n\nNon-functional requirements:\n${story.nonFunctionalRequirements.trim()}`
                : ''
            }\n\nLinked components:\n${components || '- None yet'}`
          }),
        ]
      : []),
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

export type AgentDispatchMode = 'vscode' | 'github' | 'copilot-sdk' | 'clipboard'

export interface AgentDispatchResult {
  mode: AgentDispatchMode
  instruction: string
  message: string
  url?: string
}

export async function applyComponentChange(options: {
  document: ArchitectureDocument
  design: TechnicalChangeDesign
  task: ComponentChangeTask
}): Promise<AgentDispatchResult> {
  const { dispatchAgentWork } = await import('./agentDispatch')
  return dispatchAgentWork({
    document: options.document,
    design: options.design,
    scope: 'component',
    task: options.task,
    apply: true,
  })
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
  const key = getEngineApiKey(provider)

  const prompt =
    `Write a self-contained coding-agent instruction for this component. The feature definition is the source of truth. This architecture change is ${CHANGE_KIND_LABELS[options.task.changeKind] ?? 'Update'} (new = create, update = modify existing, retire = remove). Keep markdown. Stay scoped to this component. Required sections: Code path (use the linked repo/path exactly), Where to add (new files, folders, modules, registration points), Where to update (existing files, functions, configs, callers). Name concrete paths. If a path is missing, infer from the component name and mark it as a guess.`
  const context = [
    `Architecture: ${options.document.metadata.name}`,
    options.document.metadata.description ? `Description: ${options.document.metadata.description}` : '',
    '',
    'Draft instruction to refine:',
    template,
  ]
    .filter((line) => line !== undefined)
    .join('\n')

  try {
    const response = await aiFetch('instruct', {
      method: 'POST',
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
  } catch (primaryErr) {
    if (isVsCodeHost()) {
      try {
        const text = await generateInstructionViaHost(prompt, context)
        if (text.trim()) return { instruction: stripOuterFence(text), source: 'ai' }
      } catch {
        /* fall through to the original error */
      }
    }
    return {
      instruction: template,
      source: 'template',
      error: primaryErr instanceof Error ? primaryErr.message : 'Could not reach the AI proxy',
    }
  }
}

function stripOuterFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:markdown|md|json)?\s*([\s\S]*?)```$/i)
  return (fenced?.[1] ?? trimmed).trim()
}

export interface GeneratedRequirements {
  functionalRequirements: string
  nonFunctionalRequirements: string
  stories?: Array<{
    id?: string
    title?: string
    functionalRequirements: string
    nonFunctionalRequirements: string
  }>
  source: 'ai' | 'template'
  error?: string
}

function asRequirementText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!Array.isArray(value)) return ''
  return value
    .map((item) => {
      if (typeof item === 'string') return item.startsWith('-') ? item.trim() : `- ${item.trim()}`
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>
        const text = asString(rec.text || rec.requirement || rec.title)
        if (!text) return ''
        return text.startsWith('-') ? text : `- ${text}`
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function parseRequirementsPayload(text: string): Omit<GeneratedRequirements, 'source' | 'error'> | null {
  const raw = stripOuterFence(text)
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const functionalRequirements = asRequirementText(parsed.functionalRequirements)
    const nonFunctionalRequirements = asRequirementText(parsed.nonFunctionalRequirements)
    const stories = Array.isArray(parsed.stories)
      ? parsed.stories
          .map((item) => {
            if (!item || typeof item !== 'object') return null
            const rec = item as Record<string, unknown>
            const functional = asRequirementText(rec.functionalRequirements)
            const nonFunctional = asRequirementText(rec.nonFunctionalRequirements)
            if (!functional && !nonFunctional) return null
            return {
              id: asString(rec.id) || undefined,
              title: asString(rec.title) || undefined,
              functionalRequirements: functional,
              nonFunctionalRequirements: nonFunctional,
            }
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : undefined
    if (!functionalRequirements && !nonFunctionalRequirements && !stories?.length) return null
    return { functionalRequirements, nonFunctionalRequirements, stories }
  } catch {
    return null
  }
}

function templateFeatureRequirements(design: TechnicalChangeDesign): GeneratedRequirements {
  const title = design.title.trim() || 'this feature'
  const definition = design.definition?.trim() || design.proposedChange.trim()
  const functional = [
    `- The system shall deliver ${title}.`,
    definition ? `- ${definition.split('\n')[0]}` : '',
    design.acceptanceCriteria.trim()
      ? `- ${design.acceptanceCriteria.trim().split('\n')[0]}`
      : '- Users can complete the primary flow described in the feature definition.',
    design.tasks.length > 0
      ? `- New and updated components (${design.tasks.map((task) => task.systemLabel).slice(0, 4).join(', ')}) implement the change without breaking unrelated services.`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
  const nonFunctional = [
    '- Changes stay scoped to linked code paths and do not require secrets in source.',
    '- Failures are visible in logs or CI; production gates stay human-approved where the architecture says so.',
    '- Existing contracts stay stable unless the feature definition explicitly changes them.',
  ].join('\n')
  return {
    functionalRequirements: functional,
    nonFunctionalRequirements: nonFunctional,
    source: 'template',
  }
}

function templateStoryRequirements(
  design: TechnicalChangeDesign,
  story: FeatureUserStory,
): GeneratedRequirements {
  const linked = design.tasks.filter(
    (task) => task.storyId === story.id || story.systemIds.includes(task.systemId),
  )
  const names = linked.map((task) => task.systemLabel).join(', ') || 'the linked components'
  return {
    functionalRequirements: [
      `- As specified by "${story.title.trim() || 'this story'}", ${names} shall implement the story outcome.`,
      story.description?.trim() ? `- ${story.description.trim().split('\n')[0]}` : '',
      story.acceptanceCriteria?.trim()
        ? `- ${story.acceptanceCriteria.trim().split('\n')[0]}`
        : '- The story can be demonstrated on the linked components.',
    ]
      .filter(Boolean)
      .join('\n'),
    nonFunctionalRequirements: [
      '- Work stays inside the linked component code paths.',
      '- Follow the feature non-functional requirements that apply to this story.',
    ].join('\n'),
    source: 'template',
  }
}

export function applyGeneratedRequirements(
  design: TechnicalChangeDesign,
  generated: GeneratedRequirements,
  storyId?: string,
): TechnicalChangeDesign {
  if (storyId) {
    const stories = (design.stories ?? []).map((story) =>
      story.id === storyId
        ? {
            ...story,
            functionalRequirements: generated.functionalRequirements || story.functionalRequirements,
            nonFunctionalRequirements:
              generated.nonFunctionalRequirements || story.nonFunctionalRequirements,
          }
        : story,
    )
    return { ...design, stories, updatedAt: new Date().toISOString() }
  }

  const byId = new Map((generated.stories ?? []).map((item) => [item.id, item]))
  const byTitle = new Map(
    (generated.stories ?? [])
      .filter((item) => item.title?.trim())
      .map((item) => [item.title!.trim().toLowerCase(), item]),
  )
  const stories = (design.stories ?? []).map((story) => {
    const match = byId.get(story.id) ?? byTitle.get(story.title.trim().toLowerCase())
    if (!match) return story
    return {
      ...story,
      functionalRequirements: match.functionalRequirements || story.functionalRequirements,
      nonFunctionalRequirements: match.nonFunctionalRequirements || story.nonFunctionalRequirements,
    }
  })
  return {
    ...design,
    functionalRequirements: generated.functionalRequirements || design.functionalRequirements,
    nonFunctionalRequirements: generated.nonFunctionalRequirements || design.nonFunctionalRequirements,
    stories,
    updatedAt: new Date().toISOString(),
  }
}

function buildRequirementsContext(
  document: ArchitectureDocument,
  design: TechnicalChangeDesign,
  story?: FeatureUserStory,
): string {
  const systems = listDesignableSystems(document)
  const lines = [
    `Architecture: ${document.metadata.name}`,
    document.metadata.description ? `Description: ${document.metadata.description}` : '',
    '',
    `Feature: ${design.title.trim() || 'Untitled feature'}`,
    design.definition?.trim() ? `Definition: ${design.definition.trim()}` : '',
    design.problem.trim() ? `Problem: ${design.problem.trim()}` : '',
    design.proposedChange.trim() ? `Architecture translation:\n${design.proposedChange.trim()}` : '',
    design.acceptanceCriteria.trim() ? `Acceptance:\n${design.acceptanceCriteria.trim()}` : '',
    design.functionalRequirements?.trim()
      ? `Existing feature functional requirements:\n${design.functionalRequirements.trim()}`
      : '',
    design.nonFunctionalRequirements?.trim()
      ? `Existing feature non-functional requirements:\n${design.nonFunctionalRequirements.trim()}`
      : '',
    '',
    'Linked components:',
    ...design.tasks.map((task) => {
      const system = systems.find((item) => item.id === task.systemId)
      const path = task.codePath?.trim() || system?.properties?.gitPath?.trim() || ''
      return `- ${task.systemLabel} (${CHANGE_KIND_LABELS[task.changeKind ?? 'update']}${path ? ` · ${path}` : ''})${
        task.intent.trim() ? `: ${task.intent.trim()}` : ''
      }`
    }),
  ]
  if (story) {
    const linked = design.tasks.filter(
      (task) => task.storyId === story.id || story.systemIds.includes(task.systemId),
    )
    lines.push(
      '',
      `Focus user story id: ${story.id}`,
      `Title: ${story.title.trim() || 'Untitled story'}`,
      story.description?.trim() ? `Description: ${story.description.trim()}` : '',
      story.acceptanceCriteria?.trim() ? `Acceptance: ${story.acceptanceCriteria.trim()}` : '',
      `Linked component ids: ${linked.map((task) => task.systemLabel).join(', ') || 'none'}`,
    )
  } else if ((design.stories ?? []).length > 0) {
    lines.push('', 'User stories (include a stories[] entry for each id):')
    for (const item of design.stories ?? []) {
      const linked = design.tasks.filter(
        (task) => task.storyId === item.id || item.systemIds.includes(task.systemId),
      )
      lines.push(
        `- id=${item.id} | ${item.title.trim() || 'Untitled story'} | components: ${
          linked.map((task) => task.systemLabel).join(', ') || 'none'
        }${item.description?.trim() ? ` | ${item.description.trim()}` : ''}`,
      )
    }
  }
  return lines.filter((line) => line !== undefined).join('\n')
}

export async function generateRequirements(options: {
  document: ArchitectureDocument
  design: TechnicalChangeDesign
  storyId?: string
  providerId?: AiProviderId
}): Promise<GeneratedRequirements> {
  const story = options.storyId
    ? (options.design.stories ?? []).find((item) => item.id === options.storyId)
    : undefined
  const fallback = story
    ? templateStoryRequirements(options.design, story)
    : templateFeatureRequirements(options.design)
  const settings = loadAiSettings()
  const provider = options.providerId ?? settings.selectedProvider
  const info = getProvider(provider)
  const key = getEngineApiKey(provider)
  const prompt = story
    ? `Write functional and non-functional requirements for this one user story. Return JSON with top-level functionalRequirements and nonFunctionalRequirements only (no stories array).`
    : (options.design.stories?.length ?? 0) > 0
      ? `Write functional and non-functional requirements for the feature and for every listed user story. Return JSON with feature-level fields plus a stories array matching the given story ids.`
      : `Write functional and non-functional requirements for this feature. Return JSON with functionalRequirements and nonFunctionalRequirements.`
  const context = buildRequirementsContext(options.document, options.design, story)

  try {
    const response = await aiFetch('requirements', {
      method: 'POST',
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
      throw new Error(payload.error || `${info.label} requirements failed (${response.status})`)
    }
    const parsed = payload.text ? parseRequirementsPayload(payload.text) : null
    if (!parsed) throw new Error(`${info.shortLabel} returned requirements that could not be parsed`)
    return { ...parsed, source: 'ai' }
  } catch (err) {
    return {
      ...fallback,
      error: err instanceof Error ? err.message : 'Could not reach the AI proxy',
    }
  }
}
