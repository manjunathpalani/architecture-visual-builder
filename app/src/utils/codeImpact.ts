import type { ArchitectureDocument, TechnicalChangeDesign } from '../types'
import { getEngineApiKey, getProvider, loadAiSettings, type AiProviderId } from './aiProviders'
import { aiFetch, aiUnreachableMessage } from './aiApi'
import { CHANGE_KIND_LABELS, flattenIntegrations, listDesignableSystems } from './changeDesign'
import {
  collectCodeSnapshot,
  formatSnapshotForPrompt,
  scanLocalFolder,
  targetsFromDesign,
  type CodeSnapshot,
} from './codeSnapshot'

export type ImpactVerdict = 'contained' | 'cross-cutting' | 'high-risk'

export interface SystemImpact {
  systemId: string
  systemLabel: string
  changeKind: string
  impact: string
  files: string[]
  requiredChanges: string[]
  risks: string[]
  effort: 'low' | 'medium' | 'high'
}

export interface IntegrationImpact {
  label: string
  from: string
  to: string
  impact: string
}

export interface CodeImpactReport {
  title: string
  summary: string
  verdict: ImpactVerdict
  systems: SystemImpact[]
  integrations: IntegrationImpact[]
  missingCode: string[]
  recommendedOrder: string[]
  snapshotSource: CodeSnapshot['source']
  fileCount: number
  analyzedAt: string
}

export async function analyzeCodeImpact(options: {
  document: ArchitectureDocument
  design: TechnicalChangeDesign
  providerId?: AiProviderId
  localFolder?: boolean
}): Promise<CodeImpactReport> {
  const settings = loadAiSettings()
  const provider = options.providerId ?? settings.selectedProvider
  const info = getProvider(provider)
  const targets = targetsFromDesign(options.document, options.design)
  const snapshot = options.localFolder
    ? await scanLocalFolder(targets)
    : await collectCodeSnapshot(targets)

  const prompt = [
    `Analyze the impact of this feature on existing systems and their code.`,
    `Feature: ${options.design.title.trim() || 'Untitled feature'}`,
    options.design.definition?.trim() || options.design.proposedChange.trim()
      ? `Definition: ${options.design.definition?.trim() || options.design.proposedChange.trim()}`
      : '',
    'Return required file changes, integration contract impacts, and a safe implementation order.',
  ]
    .filter(Boolean)
    .join('\n')

  const context = [
    summarizeFeature(options.document, options.design),
    formatSnapshotForPrompt(snapshot),
  ].join('\n\n')

  let response: Awaited<ReturnType<typeof aiFetch>>
  try {
    response = await aiFetch('impact', {
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
    throw new Error(payload.error || `${info.label} impact analysis failed (${response.status})`)
  }
  if (!payload.text) {
    throw new Error(`${info.shortLabel} returned an empty impact analysis`)
  }

  const report = normalizeImpact(parseJsonObject(payload.text))
  return {
    ...report,
    snapshotSource: snapshot.source,
    fileCount: snapshot.files.length,
    analyzedAt: new Date().toISOString(),
  }
}

function summarizeFeature(document: ArchitectureDocument, design: TechnicalChangeDesign): string {
  const systems = listDesignableSystems(document)
  const labels = new Map(systems.map((item) => [item.id, item.pathLabel]))
  const integrations = flattenIntegrations(document.systems, document.integrations)
  const taskLines = design.tasks.map((task) => {
    const system = systems.find((item) => item.id === task.systemId)
    const kind = CHANGE_KIND_LABELS[task.changeKind]
    const path = task.codePath || system?.properties?.gitPath || 'unlinked'
    const repo = system?.properties?.gitRepo || 'no repo'
    return `- ${task.systemId}: ${task.systemLabel} [${kind}] path=${path} repo=${repo} intent=${task.intent || 'n/a'}`
  })
  const related = integrations.filter((edge) =>
    design.tasks.some((task) => task.systemId === edge.source || task.systemId === edge.target),
  )
  return [
    `Architecture: ${document.metadata.name}`,
    `Feature: ${design.title}`,
    design.problem ? `Problem: ${design.problem}` : '',
    design.proposedChange ? `Proposed change: ${design.proposedChange}` : '',
    'Component work:',
    taskLines.join('\n') || '(none)',
    'Related integrations:',
    related
      .map(
        (edge) =>
          `- ${edge.id}: ${labels.get(edge.source) ?? edge.source} -> ${labels.get(edge.target) ?? edge.target}: ${edge.label} (${edge.protocol})`,
      )
      .join('\n') || '(none)',
  ]
    .filter(Boolean)
    .join('\n')
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? trimmed).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('The model did not return a JSON impact report. Try again.')
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    throw new Error('Could not parse the impact report. Try again.')
  }
}

function normalizeImpact(raw: unknown): Omit<CodeImpactReport, 'snapshotSource' | 'fileCount' | 'analyzedAt'> {
  if (!raw || typeof raw !== 'object') throw new Error('Impact report is empty')
  const input = raw as Record<string, unknown>
  const verdictRaw = asString(input.verdict).toLowerCase()
  const verdict: ImpactVerdict =
    verdictRaw === 'contained' || verdictRaw === 'cross-cutting' || verdictRaw === 'high-risk'
      ? verdictRaw
      : 'cross-cutting'
  const systems = asArray(input.systems)
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const systemLabel = asString(row.systemLabel) || asString(row.name)
      if (!systemLabel) return null
      return {
        systemId: asString(row.systemId),
        systemLabel,
        changeKind: asString(row.changeKind) || 'update',
        impact: asString(row.impact),
        files: stringList(row.files).slice(0, 12),
        requiredChanges: stringList(row.requiredChanges).slice(0, 8),
        risks: stringList(row.risks).slice(0, 6),
        effort: parseEffort(row.effort),
      }
    })
    .filter((item): item is SystemImpact => Boolean(item))
    .slice(0, 12)
  const integrations = asArray(input.integrations)
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const label = asString(row.label)
      const impact = asString(row.impact)
      if (!label && !impact) return null
      return {
        label: label || 'Integration',
        from: asString(row.from),
        to: asString(row.to),
        impact,
      }
    })
    .filter((item): item is IntegrationImpact => Boolean(item))
    .slice(0, 12)
  return {
    title: asString(input.title) || 'Code impact',
    summary: asString(input.summary) || 'Review of required changes in existing systems.',
    verdict,
    systems,
    integrations,
    missingCode: stringList(input.missingCode).slice(0, 12),
    recommendedOrder: stringList(input.recommendedOrder).slice(0, 12),
  }
}

function parseEffort(value: unknown): SystemImpact['effort'] {
  const raw = asString(value).toLowerCase()
  if (raw === 'low' || raw === 'high' || raw === 'medium') return raw
  return 'medium'
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
