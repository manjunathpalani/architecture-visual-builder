import type { Integration, SystemNode } from '../types'

export type ChangeStatus = 'unchanged' | 'new' | 'modified' | 'retired'
export type ArchitectureStateView = 'all' | 'current' | 'future' | 'changes'

export const CHANGE_STATUSES: ChangeStatus[] = ['unchanged', 'new', 'modified', 'retired']

export const CHANGE_STATUS_LABELS: Record<ChangeStatus, string> = {
  unchanged: 'Unchanged',
  new: 'New (future)',
  modified: 'Changed',
  retired: 'Retired (current)',
}

export const CHANGE_STATUS_HINTS: Record<ChangeStatus, string> = {
  unchanged: 'Present in current and future state',
  new: 'Added in the future state',
  modified: 'Exists today but will change',
  retired: 'Present now and removed later',
}

export const CHANGE_STATUS_COLORS: Record<ChangeStatus, string> = {
  unchanged: '#64748b',
  new: '#0d9488',
  modified: '#d97706',
  retired: '#dc2626',
}

export const STATE_VIEWS: Array<{ id: ArchitectureStateView; label: string; hint: string }> = [
  { id: 'all', label: 'All', hint: 'Current and future together' },
  { id: 'current', label: 'Current state', hint: 'As-is landscape' },
  { id: 'future', label: 'Future state', hint: 'To-be landscape' },
  { id: 'changes', label: 'Changes only', hint: 'New, changed, and retired' },
]

const STORAGE_KEY = 'architecture-visual-builder-state-view'

export function loadArchitectureStateView(): ArchitectureStateView {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'current' || raw === 'future' || raw === 'changes' || raw === 'all') return raw
  } catch {
    /* ignore */
  }
  return 'all'
}

export function saveArchitectureStateView(view: ArchitectureStateView) {
  try {
    localStorage.setItem(STORAGE_KEY, view)
  } catch {
    /* ignore */
  }
}

export function parseChangeStatus(value?: string): ChangeStatus {
  if (value === 'new' || value === 'modified' || value === 'retired' || value === 'unchanged') {
    return value
  }
  return 'unchanged'
}

export function getSystemChangeStatus(system: SystemNode): ChangeStatus {
  return parseChangeStatus(system.properties?.changeStatus)
}

export function getIntegrationChangeStatus(integration: { changeStatus?: string }): ChangeStatus {
  return parseChangeStatus(integration.changeStatus)
}

export function isVisibleInStateView(status: ChangeStatus, view: ArchitectureStateView): boolean {
  if (view === 'all') return true
  if (view === 'current') return status !== 'new'
  if (view === 'future') return status !== 'retired'
  return status !== 'unchanged'
}

export function filterByArchitectureState(
  systems: SystemNode[],
  integrations: Integration[],
  view: ArchitectureStateView,
): {
  systems: SystemNode[]
  integrations: Integration[]
  contextIds: Set<string>
} {
  if (view === 'all') {
    return { systems, integrations, contextIds: new Set() }
  }

  const visibleSystems = systems.filter((system) => isVisibleInStateView(getSystemChangeStatus(system), view))
  const visibleIds = new Set(visibleSystems.map((system) => system.id))

  const visibleIntegrations = integrations.filter((integration) => {
    const status = getIntegrationChangeStatus(integration)
    if (!isVisibleInStateView(status, view)) return false
    return true
  })

  const contextIds = new Set<string>()
  for (const integration of visibleIntegrations) {
    if (!visibleIds.has(integration.source)) contextIds.add(integration.source)
    if (!visibleIds.has(integration.target)) contextIds.add(integration.target)
  }

  if (contextIds.size > 0) {
    for (const system of systems) {
      if (!contextIds.has(system.id) || visibleIds.has(system.id)) continue
      visibleSystems.push(system)
      visibleIds.add(system.id)
    }
  }

  const integrationsOnCanvas = visibleIntegrations.filter(
    (integration) => visibleIds.has(integration.source) && visibleIds.has(integration.target),
  )

  return { systems: visibleSystems, integrations: integrationsOnCanvas, contextIds }
}
