import type { ArchitectureDocument, Integration, SystemNode } from '../types'
import { getEngineApiKey, getProvider, loadAiSettings, type AiProviderId } from './aiProviders'
import { aiFetch, aiUnreachableMessage } from './aiApi'

export type AnalysisVerdict = 'strong' | 'balanced' | 'at-risk'

export type AnalysisLensId =
  | 'overall'
  | 'integration'
  | 'security'
  | 'cost'
  | 'resilience'
  | 'data'
  | 'ai'

export const ANALYSIS_LENSES: Array<{ id: AnalysisLensId; label: string; hint: string }> = [
  { id: 'overall', label: 'Overall', hint: 'Balance of the whole landscape' },
  { id: 'integration', label: 'Integration', hint: 'Coupling, protocols, and contracts' },
  { id: 'security', label: 'Security', hint: 'Identity, exposure, and data protection' },
  { id: 'cost', label: 'Cost & ops', hint: 'Run cost, complexity, operations' },
  { id: 'resilience', label: 'Resilience', hint: 'Failure modes and recovery' },
  { id: 'data', label: 'Data', hint: 'Sources of truth and movement' },
  { id: 'ai', label: 'AI / GenAI', hint: 'Grounding, safety, and model ops' },
]

export interface CapabilityAssessment {
  name: string
  related: string[]
  assessment: string
  pros: string[]
  cons: string[]
}

export interface CapabilityAnalysis {
  title: string
  summary: string
  verdict: AnalysisVerdict
  capabilities: CapabilityAssessment[]
  risks: string[]
  recommendations: string[]
}

export function buildAnalysisPrompt(options: {
  lens: AnalysisLensId
  focusLabel?: string
  notes?: string
}): string {
  const lens = ANALYSIS_LENSES.find((item) => item.id === options.lens) ?? ANALYSIS_LENSES[0]
  const parts = [
    `Analyze this architecture as enterprise capabilities and show pros and cons.`,
    `Focus lens: ${lens.label} — ${lens.hint}.`,
  ]
  if (options.focusLabel?.trim()) {
    parts.push(`Give extra depth to this system or capability: ${options.focusLabel.trim()}.`)
  }
  if (options.notes?.trim()) {
    parts.push(`Additional review notes from the architect: ${options.notes.trim()}`)
  }
  return parts.join('\n')
}

export function summarizeArchitectureForAnalysis(doc: ArchitectureDocument): string {
  const systems = flattenSystems(doc.systems)
  const integrations = flattenIntegrations(doc.systems, doc.integrations)
  return [
    `Name: ${doc.metadata.name}`,
    doc.metadata.description ? `Description: ${doc.metadata.description}` : '',
    `Counts: ${systems.length} systems, ${integrations.length} integrations`,
    'Systems:',
    systems.map(formatSystem).join('\n') || '(none)',
    'Integrations:',
    integrations.map(formatIntegration).join('\n') || '(none)',
  ]
    .filter(Boolean)
    .join('\n')
}

function flattenSystems(systems: SystemNode[], depth = 0): Array<SystemNode & { depth: number }> {
  const rows: Array<SystemNode & { depth: number }> = []
  for (const system of systems) {
    rows.push({ ...system, depth })
    if (system.subDiagram?.systems.length) {
      rows.push(...flattenSystems(system.subDiagram.systems, depth + 1))
    }
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

function formatSystem(system: SystemNode & { depth: number }): string {
  const indent = '  '.repeat(system.depth)
  const bits: string[] = [system.type]
  if (system.properties?.vendor) bits.push(system.properties.vendor)
  if (system.properties?.service) bits.push(system.properties.service)
  const desc = system.properties?.description ? ` — ${system.properties.description}` : ''
  return `${indent}- ${system.id}: ${system.label} (${bits.join(', ')})${desc}`
}

function formatIntegration(integration: Integration): string {
  return `- ${integration.source} -> ${integration.target}: ${integration.label} via ${integration.protocol} (${integration.frequency})`
}

export async function analyzeArchitectureCapabilities(options: {
  document: ArchitectureDocument
  lens: AnalysisLensId
  focusLabel?: string
  notes?: string
  providerId?: AiProviderId
}): Promise<CapabilityAnalysis> {
  const settings = loadAiSettings()
  const provider = options.providerId ?? settings.selectedProvider
  const info = getProvider(provider)
  const prompt = buildAnalysisPrompt({
    lens: options.lens,
    focusLabel: options.focusLabel,
    notes: options.notes,
  })
  const context = summarizeArchitectureForAnalysis(options.document)

  let response: Awaited<ReturnType<typeof aiFetch>>
  try {
    response = await aiFetch('analyze', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        context,
        provider,
        apiKey: getEngineApiKey(provider),
        azureEndpoint: settings.azureEndpoint,
        azureDeployment: settings.azureDeployment,
      }),
    })
  } catch {
    throw new Error(aiUnreachableMessage())
  }

  const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string }
  if (!response.ok) {
    throw new Error(payload.error || `${info.label} analysis failed (${response.status})`)
  }
  if (!payload.text) {
    throw new Error(`${info.shortLabel} returned an empty analysis`)
  }

  return normalizeAnalysis(parseJsonObject(payload.text))
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? trimmed).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('The model did not return a JSON analysis. Try again.')
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    throw new Error('Could not parse the capability analysis. Try again.')
  }
}

function normalizeAnalysis(raw: unknown): CapabilityAnalysis {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Capability analysis is empty')
  }
  const input = raw as Record<string, unknown>
  const capabilities = asArray(input.capabilities)
    .map(normalizeCapability)
    .filter((item): item is CapabilityAssessment => Boolean(item))
    .slice(0, 10)

  if (capabilities.length === 0) {
    throw new Error('The model returned no capabilities to review.')
  }

  return {
    title: asString(input.title) || 'Capability analysis',
    summary: asString(input.summary) || 'Review of the current architecture.',
    verdict: parseVerdict(input.verdict),
    capabilities,
    risks: stringList(input.risks).slice(0, 8),
    recommendations: stringList(input.recommendations).slice(0, 8),
  }
}

function normalizeCapability(raw: unknown): CapabilityAssessment | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const name = asString(input.name)
  if (!name) return null
  const pros = stringList(input.pros)
  const cons = stringList(input.cons)
  if (pros.length === 0 && cons.length === 0) return null
  return {
    name,
    related: stringList(input.related).slice(0, 8),
    assessment: asString(input.assessment),
    pros: pros.slice(0, 6),
    cons: cons.slice(0, 6),
  }
}

function parseVerdict(value: unknown): AnalysisVerdict {
  const raw = asString(value).toLowerCase()
  if (raw === 'strong' || raw === 'balanced' || raw === 'at-risk') return raw
  return 'balanced'
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(asString).filter(Boolean)
}
