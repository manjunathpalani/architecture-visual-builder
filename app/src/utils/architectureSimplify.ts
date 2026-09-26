import type { ArchitectureDocument, Integration, SystemNode } from '../types'

export interface DeclaredCostItem {
  id: string
  label: string
  monthly: number
  raw: string
}

export interface DeclaredCostRollup {
  monthly: number
  items: DeclaredCostItem[]
}

export interface StructuralSimplification {
  id: string
  title: string
  problem: string
  action: string
  integrationIds: string[]
  integrationLabels: string[]
}

export function parseMonthlyCost(raw?: string): number | null {
  if (!raw?.trim()) return null
  const text = raw.trim()
  const match = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  let value = Number(match[1])
  if (!Number.isFinite(value) || value <= 0) return null
  if (/\bk\b/i.test(text)) value *= 1000
  if (/year|annual|\/\s*yr|\/\s*year/i.test(text)) value /= 12
  if (/day|\/\s*d\b/i.test(text)) value *= 30
  return Math.round(value)
}

export function collectDeclaredCosts(doc: ArchitectureDocument): DeclaredCostRollup {
  const items: DeclaredCostItem[] = []
  const visit = (systems: SystemNode[]) => {
    for (const system of systems) {
      const monthly = parseMonthlyCost(system.properties?.estimatedCost)
      if (monthly != null) {
        items.push({
          id: system.id,
          label: system.label,
          monthly,
          raw: system.properties?.estimatedCost ?? '',
        })
      }
      if (system.subDiagram?.systems.length) visit(system.subDiagram.systems)
    }
  }
  visit(doc.systems)
  return {
    monthly: items.reduce((sum, item) => sum + item.monthly, 0),
    items,
  }
}

export function detectIntegrationSimplifications(doc: ArchitectureDocument): StructuralSimplification[] {
  const systems = flattenSystems(doc.systems)
  const integrations = flattenIntegrations(doc.systems, doc.integrations)
  const byId = new Map(systems.map((system) => [system.id, system]))
  const findings: StructuralSimplification[] = []

  const pairMap = new Map<string, Integration[]>()
  for (const edge of integrations) {
    const key = [edge.source, edge.target].sort().join('::')
    const list = pairMap.get(key) ?? []
    list.push(edge)
    pairMap.set(key, list)
  }

  for (const [key, group] of pairMap) {
    if (group.length < 2) continue
    const [left, right] = key.split('::')
    const leftLabel = byId.get(left)?.label ?? left
    const rightLabel = byId.get(right)?.label ?? right
    const protocols = unique(group.map((edge) => edge.protocol))
    findings.push({
      id: `dup-${key}`,
      title: `Consolidate ${group.length} flows between ${leftLabel} and ${rightLabel}`,
      problem:
        protocols.length > 1
          ? `The same pair uses ${protocols.join(', ')}. Overlapping contracts add mapping and ops cost.`
          : `${group.length} integrations share the same endpoints. Duplicate hops inflate runtime and mapping work.`,
      action: 'Keep one canonical contract (event or process API) and retire the extra point-to-point jobs.',
      integrationIds: group.map((edge) => edge.id),
      integrationLabels: group.map((edge) => edge.label),
    })
  }

  const degree = new Map<string, number>()
  for (const edge of integrations) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  }
  for (const [id, count] of degree) {
    const system = byId.get(id)
    if (!system || count < 6) continue
    if (system.type === 'middleware') continue
    const incident = integrations.filter((edge) => edge.source === id || edge.target === id)
    findings.push({
      id: `hub-${id}`,
      title: `Reduce point-to-point fan-out from ${system.label}`,
      problem: `${system.label} has ${count} direct integrations. Each extra hop is another mapping, SLA, and failure mode.`,
      action: 'Front this system with a process API, ESB, or event bus so spokes do not each own a private contract.',
      integrationIds: incident.map((edge) => edge.id),
      integrationLabels: incident.map((edge) => edge.label),
    })
  }

  for (const edge of integrations) {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) continue
    const saasToSor =
      (source.type === 'saas' || source.type === 'powerplatform') &&
      (target.type === 'onpremise' || target.type === 'database')
    const reverse =
      (target.type === 'saas' || target.type === 'powerplatform') &&
      (source.type === 'onpremise' || source.type === 'database')
    if (!saasToSor && !reverse) continue
    findings.push({
      id: `bypass-${edge.id}`,
      title: `Insert a process layer on “${edge.label}”`,
      problem: `${source.label} talks directly to ${target.label}. Channel-to-system-of-record shortcuts are hard to version and observe.`,
      action: 'Route through an API, iPaaS, or event backbone so the SoR contract is reused.',
      integrationIds: [edge.id],
      integrationLabels: [edge.label],
    })
  }

  for (const edge of integrations) {
    const hops = edge.sequenceFlow?.length ?? 0
    if (hops < 5) continue
    findings.push({
      id: `seq-${edge.id}`,
      title: `Shorten the sequence on “${edge.label}”`,
      problem: `This integration already lists ${hops} inner hops. Long chains raise latency and failure surface.`,
      action: 'Collapse adjacent validation/transform steps into one process service, and keep only business-visible hops.',
      integrationIds: [edge.id],
      integrationLabels: [edge.label],
    })
  }

  return findings.slice(0, 8)
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `$${Math.round(amount).toLocaleString('en-US')}`
  }
}

function flattenSystems(systems: SystemNode[]): SystemNode[] {
  const rows: SystemNode[] = []
  for (const system of systems) {
    rows.push(system)
    if (system.subDiagram?.systems.length) rows.push(...flattenSystems(system.subDiagram.systems))
  }
  return rows
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

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}
