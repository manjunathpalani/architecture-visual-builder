import type {
  ArchitectureDocument,
  AuditEvent,
  AuditKind,
  Integration,
  SystemNode,
} from '../types'
import type { DrawingElement } from '../types/diagram'
import { getGoogleTokens, getMicrosoftTokens } from './cloud/cloudCredentials'
import { generateId } from './jsonIO'

const MAX_EVENTS = 400
const IGNORE_PROPS = new Set(['width', 'height'])

export function currentAuditActor(): string {
  const google = getGoogleTokens()
  if (google?.name || google?.email) return google.name || google.email || 'Google user'
  const microsoft = getMicrosoftTokens()
  if (microsoft?.name || microsoft?.email) return microsoft.name || microsoft.email || 'Microsoft user'
  return 'Local user'
}

export type AuditExtras = Partial<Pick<AuditEvent, 'kind' | 'summary' | 'details'>>

const AUDIT_KINDS: AuditKind[] = [
  'add',
  'remove',
  'update',
  'move',
  'connect',
  'draw',
  'import',
  'ai',
  'navigate',
]

export function sanitizeAudit(raw: unknown): AuditEvent[] {
  if (!Array.isArray(raw)) return []
  const events: AuditEvent[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const event = item as Partial<AuditEvent>
    if (typeof event.id !== 'string' || typeof event.summary !== 'string') continue
    const kind = AUDIT_KINDS.includes(event.kind as AuditKind) ? (event.kind as AuditKind) : 'update'
    events.push({
      id: event.id,
      at: typeof event.at === 'string' ? event.at : new Date().toISOString(),
      actor: typeof event.actor === 'string' && event.actor.trim() ? event.actor : 'Local user',
      kind,
      summary: event.summary,
      details: Array.isArray(event.details)
        ? event.details.filter((line): line is string => typeof line === 'string').slice(0, 40)
        : [],
    })
    if (events.length >= MAX_EVENTS) break
  }
  return events
}

export function applyAudit(
  previous: ArchitectureDocument,
  next: ArchitectureDocument,
  extras?: AuditExtras,
): ArchitectureDocument {
  const details = diffDocuments(previous, next)
  const extraDetails = extras?.details?.filter(Boolean) ?? []
  const allDetails = [...details, ...extraDetails]
  if (allDetails.length === 0 && !extras?.summary) {
    if (next.audit === previous.audit) return next
    return { ...next, audit: previous.audit }
  }

  const kind = extras?.kind ?? inferKind(allDetails)
  const event: AuditEvent = {
    id: generateId('audit'),
    at: new Date().toISOString(),
    actor: currentAuditActor(),
    kind,
    summary: extras?.summary?.trim() || summarize(allDetails, kind),
    details: allDetails.slice(0, 40),
  }

  const prior =
    extras?.kind === 'import' ? sanitizeAudit(next.audit) : sanitizeAudit(next.audit ?? previous.audit)
  return {
    ...next,
    metadata: { ...next.metadata, updatedAt: event.at },
    audit: [event, ...prior].slice(0, MAX_EVENTS),
  }
}

function inferKind(details: string[]): AuditKind {
  const text = details.join('\n')
  const only = (re: RegExp) => details.length > 0 && details.every((line) => re.test(line))
  if (only(/^Added /)) return 'add'
  if (only(/^Removed /)) return 'remove'
  if (only(/^Moved /) || only(/^Resized /)) return 'move'
  if (only(/^Connected /) || only(/^Disconnected /) || only(/^Rerouted /)) return 'connect'
  if (only(/^Drew /) || only(/^Erased /)) return 'draw'
  if (/^Added /.test(text) && !/^Removed /.test(text)) return 'add'
  if (/^Removed /.test(text) && !/^Added /.test(text)) return 'remove'
  return 'update'
}

function summarize(details: string[], kind: AuditKind): string {
  if (details.length === 1) return details[0]
  const labels: Record<AuditKind, string> = {
    add: 'Added items',
    remove: 'Removed items',
    update: 'Updated the diagram',
    move: 'Moved items',
    connect: 'Changed integrations',
    draw: 'Changed drawings',
    import: 'Imported architecture',
    ai: 'Updated with AI',
    navigate: 'Changed diagram view',
  }
  return `${labels[kind]} (${details.length} changes)`
}

function diffDocuments(prev: ArchitectureDocument, next: ArchitectureDocument): string[] {
  const details: string[] = []
  if ((prev.metadata.name ?? '') !== (next.metadata.name ?? '')) {
    details.push(`Renamed project from “${prev.metadata.name}” to “${next.metadata.name}”`)
  }
  if ((prev.metadata.description ?? '') !== (next.metadata.description ?? '')) {
    details.push('Updated project description')
  }
  diffSystems(prev.systems, next.systems, [], details)
  diffIntegrations(prev.integrations, next.integrations, [], details)
  diffDrawings(prev.drawings ?? [], next.drawings ?? [], [], details)
  return details
}

function prefix(trail: string[], message: string): string {
  return trail.length ? `${trail.join(' / ')}: ${message}` : message
}

function diffSystems(prev: SystemNode[], next: SystemNode[], trail: string[], details: string[]) {
  const before = new Map(prev.map((s) => [s.id, s]))
  const after = new Map(next.map((s) => [s.id, s]))

  for (const node of next) {
    const old = before.get(node.id)
    if (!old) {
      details.push(prefix(trail, `Added ${node.label}`))
      continue
    }
    if (old.label !== node.label) details.push(prefix(trail, `Renamed “${old.label}” to “${node.label}”`))
    if (old.type !== node.type) details.push(prefix(trail, `Changed type of ${node.label} to ${node.type}`))
    if (old.category !== node.category) details.push(prefix(trail, `Changed category of ${node.label}`))
    if (moved(old.position, node.position)) details.push(prefix(trail, `Moved ${node.label}`))
    const oldSize = sizeOf(old)
    const newSize = sizeOf(node)
    if (oldSize !== newSize && oldSize !== 'x' && newSize !== 'x') {
      details.push(prefix(trail, `Resized ${node.label}`))
    }
    for (const change of propertyChanges(old.properties, node.properties, node.label)) {
      details.push(prefix(trail, change))
    }
    const oldSub = old.subDiagram
    const newSub = node.subDiagram
    if (!oldSub && newSub) details.push(prefix(trail, `Created sub-diagram for ${node.label}`))
    if (oldSub && !newSub) details.push(prefix(trail, `Removed sub-diagram for ${node.label}`))
    if (oldSub && newSub) {
      const nested = [...trail, node.label]
      diffSystems(oldSub.systems, newSub.systems, nested, details)
      diffIntegrations(oldSub.integrations, newSub.integrations, nested, details)
      diffDrawings(oldSub.drawings ?? [], newSub.drawings ?? [], nested, details)
    }
  }

  for (const node of prev) {
    if (!after.has(node.id)) details.push(prefix(trail, `Removed ${node.label}`))
  }
}

function diffIntegrations(prev: Integration[], next: Integration[], trail: string[], details: string[]) {
  const before = new Map(prev.map((i) => [i.id, i]))
  const after = new Map(next.map((i) => [i.id, i]))

  for (const edge of next) {
    const old = before.get(edge.id)
    if (!old) {
      details.push(prefix(trail, `Connected ${edge.source} → ${edge.target} (${edge.label})`))
      continue
    }
    if (old.source !== edge.source || old.target !== edge.target) {
      details.push(prefix(trail, `Rerouted ${edge.label}`))
    }
    if (old.label !== edge.label) details.push(prefix(trail, `Renamed integration to “${edge.label}”`))
    if (old.protocol !== edge.protocol) details.push(prefix(trail, `Changed protocol of ${edge.label} to ${edge.protocol}`))
    if (old.frequency !== edge.frequency) details.push(prefix(trail, `Changed frequency of ${edge.label}`))
    if (old.direction !== edge.direction) details.push(prefix(trail, `Changed direction of ${edge.label}`))
    if ((old.description ?? '') !== (edge.description ?? '')) details.push(prefix(trail, `Updated description of ${edge.label}`))
    if ((old.dataFormat ?? '') !== (edge.dataFormat ?? '')) details.push(prefix(trail, `Changed data format of ${edge.label}`))
    if ((old.interfaceSpec ?? '') !== (edge.interfaceSpec ?? '')) details.push(prefix(trail, `Updated interface spec of ${edge.label}`))
    if ((old.jiraIssueKey ?? '') !== (edge.jiraIssueKey ?? '') || (old.adoWorkItemId ?? '') !== (edge.adoWorkItemId ?? '')) {
      details.push(prefix(trail, `Updated work item link on ${edge.label}`))
    }
    const oldBends = old.waypoints?.length ?? 0
    const newBends = edge.waypoints?.length ?? 0
    if (oldBends !== newBends) details.push(prefix(trail, `Changed bends on ${edge.label}`))
  }

  for (const edge of prev) {
    if (!after.has(edge.id)) details.push(prefix(trail, `Disconnected ${edge.label}`))
  }
}

function diffDrawings(prev: DrawingElement[], next: DrawingElement[], trail: string[], details: string[]) {
  const before = new Set(prev.map((d) => d.id))
  const after = new Set(next.map((d) => d.id))
  for (const el of next) {
    if (!before.has(el.id)) details.push(prefix(trail, `Drew ${el.type}`))
  }
  for (const el of prev) {
    if (!after.has(el.id)) details.push(prefix(trail, `Erased ${el.type}`))
  }
}

function moved(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) >= 4 || Math.abs(a.y - b.y) >= 4
}

function sizeOf(node: SystemNode): string {
  return `${node.properties?.width ?? ''}x${node.properties?.height ?? ''}`
}

function propertyChanges(
  prev: Record<string, string | undefined> | undefined,
  next: Record<string, string | undefined> | undefined,
  label: string,
): string[] {
  const a = prev ?? {}
  const b = next ?? {}
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const changes: string[] = []
  for (const key of keys) {
    if (IGNORE_PROPS.has(key)) continue
    if ((a[key] ?? '') === (b[key] ?? '')) continue
    const pretty = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
    if (!(b[key] ?? '')) changes.push(`Cleared ${pretty.toLowerCase()} on ${label}`)
    else if (!(a[key] ?? '')) changes.push(`Set ${pretty.toLowerCase()} on ${label}`)
    else changes.push(`Changed ${pretty.toLowerCase()} on ${label}`)
  }
  return changes
}

export function formatAuditTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
