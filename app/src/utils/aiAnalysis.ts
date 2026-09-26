import type { ArchitectureDocument, Integration, SystemNode } from '../types'
import { getEngineApiKey, getProvider, loadAiSettings, type AiProviderId } from './aiProviders'
import { aiFetch, aiUnreachableMessage } from './aiApi'
import {
  collectDeclaredCosts,
  detectIntegrationSimplifications,
  formatCurrency,
} from './architectureSimplify'

export type AnalysisVerdict = 'strong' | 'balanced' | 'at-risk'

export type AnalysisLensId =
  | 'overall'
  | 'integration'
  | 'security'
  | 'cost'
  | 'simplify'
  | 'resilience'
  | 'data'
  | 'ai'

export const ANALYSIS_LENSES: Array<{ id: AnalysisLensId; label: string; hint: string }> = [
  { id: 'overall', label: 'Overall', hint: 'Balance of the whole landscape' },
  { id: 'integration', label: 'Integration', hint: 'Coupling, protocols, and contracts' },
  { id: 'security', label: 'Security', hint: 'Identity, exposure, and data protection' },
  { id: 'cost', label: 'Cost', hint: 'Monthly run-cost forecast from SKUs and services' },
  { id: 'simplify', label: 'Simplify', hint: 'Integrations to merge, retire, or reroute' },
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

export interface CostDriver {
  name: string
  monthly: number
  note: string
}

export interface CostForecast {
  currency: string
  monthlyLow: number
  monthlyExpected: number
  monthlyHigh: number
  confidence: 'low' | 'medium' | 'high'
  basis: string
  declaredMonthly: number
  drivers: CostDriver[]
}

export interface IntegrationSimplification {
  id: string
  title: string
  problem: string
  action: string
  integrationIds: string[]
  integrationLabels: string[]
  savingsMonthly: number
  removesHops: number
  effort: 'low' | 'medium' | 'high'
  source: 'ai' | 'structure'
}

export interface CapabilityAnalysis {
  title: string
  summary: string
  verdict: AnalysisVerdict
  capabilities: CapabilityAssessment[]
  risks: string[]
  recommendations: string[]
  costForecast: CostForecast
  simplifications: IntegrationSimplification[]
}

const VERDICT_LABEL: Record<AnalysisVerdict, string> = {
  strong: 'Strong',
  balanced: 'Balanced',
  'at-risk': 'At risk',
}

export function analysisFileSlug(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug || 'architecture-analysis'
}

export function formatCapabilityAnalysisMarkdown(
  analysis: CapabilityAnalysis,
  options: { architectureName: string; lens?: AnalysisLensId; focusLabel?: string; notes?: string },
): string {
  const lens = ANALYSIS_LENSES.find((item) => item.id === options.lens)
  const cost = analysis.costForecast
  const lines: string[] = [
    `# ${analysis.title}`,
    '',
    `- Architecture: ${options.architectureName}`,
    `- Verdict: ${VERDICT_LABEL[analysis.verdict]}`,
    lens ? `- Lens: ${lens.label}` : '',
    options.focusLabel ? `- Emphasis: ${options.focusLabel}` : '',
    options.notes?.trim() ? `- Review notes: ${options.notes.trim()}` : '',
    `- Exported: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    analysis.summary,
    '',
    '## Cost forecast',
    '',
    `- Expected monthly: ${formatCurrency(cost.monthlyExpected, cost.currency)}`,
    `- Range: ${formatCurrency(cost.monthlyLow, cost.currency)} – ${formatCurrency(cost.monthlyHigh, cost.currency)}`,
    `- Confidence: ${cost.confidence}`,
    cost.declaredMonthly > 0
      ? `- Declared on components: ${formatCurrency(cost.declaredMonthly, cost.currency)}`
      : '',
    cost.basis ? `- Basis: ${cost.basis}` : '',
  ]
  if (cost.drivers.length > 0) {
    lines.push('', '### Cost drivers', '')
    for (const driver of cost.drivers) {
      lines.push(
        `- ${driver.name}: ${formatCurrency(driver.monthly, cost.currency)}${driver.note ? ` — ${driver.note}` : ''}`,
      )
    }
  }
  if (analysis.simplifications.length > 0) {
    lines.push('', '## Simplify integrations', '')
    for (const item of analysis.simplifications) {
      lines.push(`### ${item.title}`)
      lines.push('')
      if (item.problem) lines.push(item.problem, '')
      lines.push(`**Action:** ${item.action}`)
      if (item.integrationLabels.length) lines.push(`**Flows:** ${item.integrationLabels.join(', ')}`)
      if (item.savingsMonthly > 0) {
        lines.push(`**Indicative saving:** ${formatCurrency(item.savingsMonthly, cost.currency)} / month`)
      }
      if (item.removesHops > 0) lines.push(`**Hops removed:** ${item.removesHops}`)
      lines.push(`**Effort:** ${item.effort}`, '')
    }
  }
  lines.push('## Capabilities', '')
  for (const capability of analysis.capabilities) {
    lines.push(`### ${capability.name}`)
    lines.push('')
    if (capability.related.length) lines.push(`Covers: ${capability.related.join(', ')}`, '')
    if (capability.assessment) lines.push(capability.assessment, '')
    if (capability.pros.length) {
      lines.push('**Pros**')
      capability.pros.forEach((item) => lines.push(`- ${item}`))
      lines.push('')
    }
    if (capability.cons.length) {
      lines.push('**Cons**')
      capability.cons.forEach((item) => lines.push(`- ${item}`))
      lines.push('')
    }
  }
  if (analysis.risks.length) {
    lines.push('## Risks', '')
    analysis.risks.forEach((item) => lines.push(`- ${item}`))
    lines.push('')
  }
  if (analysis.recommendations.length) {
    lines.push('## Recommendations', '')
    analysis.recommendations.forEach((item) => lines.push(`- ${item}`))
    lines.push('')
  }
  return lines.filter((line) => line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n')
}

export function downloadAnalysisFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function buildAnalysisPrompt(options: {
  lens: AnalysisLensId
  focusLabel?: string
  notes?: string
}): string {
  const lens = ANALYSIS_LENSES.find((item) => item.id === options.lens) ?? ANALYSIS_LENSES[0]
  const parts = [
    `Analyze this architecture as enterprise capabilities and show pros and cons.`,
    `Always predict monthly run cost and list integration simplifications that reduce hops, duplicates, or point-to-point sprawl.`,
    `Focus lens: ${lens.label} — ${lens.hint}.`,
  ]
  if (options.lens === 'cost') {
    parts.push('Weight the review toward SKU, region, HA, and integration runtime cost. Fill gaps where estimatedCost is missing.')
  }
  if (options.lens === 'simplify') {
    parts.push('Weight the review toward consolidating integrations. Prefer fewer hops, one canonical contract per pair, and process APIs or events over duplicate REST jobs.')
  }
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
  const declared = collectDeclaredCosts(doc)
  const smells = detectIntegrationSimplifications(doc)
  const infra = doc.metadata.infrastructure
  return [
    `Name: ${doc.metadata.name}`,
    doc.metadata.description ? `Description: ${doc.metadata.description}` : '',
    `Counts: ${systems.length} systems, ${integrations.length} integrations`,
    infra
      ? `Landing zone: ${[infra.cloudProvider, infra.primaryRegion, infra.landingZone, infra.environment]
          .filter(Boolean)
          .join(' · ') || 'not set'}`
      : '',
    declared.monthly > 0
      ? `Declared monthly cost on components: ${formatCurrency(declared.monthly)} (${declared.items.length} priced items)`
      : 'Declared monthly cost on components: none (predict from SKU, region, and service type)',
    'Systems:',
    systems.map(formatSystem).join('\n') || '(none)',
    'Integrations:',
    integrations.map(formatIntegration).join('\n') || '(none)',
    smells.length > 0
      ? `Structural simplification hints:\n${smells
          .map(
            (item) =>
              `- ${item.title}: ${item.problem} Suggested: ${item.action} [${item.integrationIds.join(', ')}]`,
          )
          .join('\n')}`
      : '',
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
  if (system.properties?.region) bits.push(`region ${system.properties.region}`)
  if (system.properties?.sku) bits.push(`sku ${system.properties.sku}`)
  if (system.properties?.haMode) bits.push(system.properties.haMode)
  if (system.properties?.estimatedCost) bits.push(`cost ${system.properties.estimatedCost}`)
  const desc = system.properties?.description ? ` — ${system.properties.description}` : ''
  return `${indent}- ${system.id}: ${system.label} (${bits.join(', ')})${desc}`
}

function formatIntegration(integration: Integration): string {
  const hops = integration.sequenceFlow?.length
    ? `, ${integration.sequenceFlow.length} inner hops`
    : ''
  return `- ${integration.id}: ${integration.source} -> ${integration.target}: ${integration.label} via ${integration.protocol} (${integration.frequency}${hops})`
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

  return normalizeAnalysis(parseJsonObject(payload.text), options.document)
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

function normalizeAnalysis(raw: unknown, document: ArchitectureDocument): CapabilityAnalysis {
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

  const declared = collectDeclaredCosts(document)
  const structural = detectIntegrationSimplifications(document)
  const aiSimplifications = asArray(input.simplifications)
    .map((item) => normalizeSimplification(item, 'ai'))
    .filter((item): item is IntegrationSimplification => Boolean(item))
  const simplifications = mergeSimplifications(aiSimplifications, structural)

  return {
    title: asString(input.title) || 'Capability analysis',
    summary: asString(input.summary) || 'Review of the current architecture.',
    verdict: parseVerdict(input.verdict),
    capabilities,
    risks: stringList(input.risks).slice(0, 8),
    recommendations: stringList(input.recommendations).slice(0, 8),
    costForecast: normalizeCostForecast(input.costForecast, declared),
    simplifications,
  }
}

function normalizeCostForecast(raw: unknown, declared: ReturnType<typeof collectDeclaredCosts>): CostForecast {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const expected = asNumber(input.monthlyExpected) || asNumber(input.monthly) || declared.monthly
  const low = asNumber(input.monthlyLow) || Math.round(expected * 0.7)
  const high = asNumber(input.monthlyHigh) || Math.round(expected * 1.4 || declared.monthly * 1.4)
  const drivers = asArray(input.drivers)
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const name = asString(row.name)
      const monthly = asNumber(row.monthly)
      if (!name || monthly <= 0) return null
      return { name, monthly, note: asString(row.note) }
    })
    .filter((item): item is CostDriver => Boolean(item))
    .slice(0, 10)
  const fallbackDrivers =
    drivers.length > 0
      ? drivers
      : declared.items.slice(0, 10).map((item) => ({
          name: item.label,
          monthly: item.monthly,
          note: item.raw,
        }))
  const confidenceRaw = asString(input.confidence).toLowerCase()
  const confidence: CostForecast['confidence'] =
    confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low'
      ? confidenceRaw
      : declared.monthly > 0
        ? 'medium'
        : 'low'
  return {
    currency: asString(input.currency) || 'USD',
    monthlyLow: Math.min(low, expected || low),
    monthlyExpected: expected,
    monthlyHigh: Math.max(high, expected || high),
    confidence,
    basis:
      asString(input.basis) ||
      (declared.monthly > 0
        ? 'Blend of declared component costs and typical list prices for unnamed SKUs.'
        : 'Indicative list-price forecast. Add SKU and estimatedCost on components to tighten it.'),
    declaredMonthly: declared.monthly,
    drivers: fallbackDrivers,
  }
}

function normalizeSimplification(
  raw: unknown,
  source: IntegrationSimplification['source'],
): IntegrationSimplification | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const title = asString(input.title)
  const action = asString(input.action) || asString(input.recommendation)
  if (!title || !action) return null
  const effortRaw = asString(input.effort).toLowerCase()
  return {
    id: asString(input.id) || `ai-${title.slice(0, 24)}`,
    title,
    problem: asString(input.problem),
    action,
    integrationIds: stringList(input.integrationIds).slice(0, 12),
    integrationLabels: stringList(input.integrationLabels).slice(0, 12),
    savingsMonthly: asNumber(input.savingsMonthly) || asNumber(input.savings),
    removesHops: Math.round(asNumber(input.removesHops)),
    effort: effortRaw === 'low' || effortRaw === 'high' || effortRaw === 'medium' ? effortRaw : 'medium',
    source,
  }
}

function mergeSimplifications(
  ai: IntegrationSimplification[],
  structural: ReturnType<typeof detectIntegrationSimplifications>,
): IntegrationSimplification[] {
  const mapped = structural.map((item) => ({
    ...item,
    savingsMonthly: 0,
    removesHops: Math.max(0, item.integrationIds.length - 1),
    effort: 'medium' as const,
    source: 'structure' as const,
  }))
  const seen = new Set<string>()
  const out: IntegrationSimplification[] = []
  for (const item of [...ai, ...mapped]) {
    const key = `${item.title}|${item.integrationIds.slice().sort().join(',')}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
    if (out.length >= 10) break
  }
  return out
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
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
