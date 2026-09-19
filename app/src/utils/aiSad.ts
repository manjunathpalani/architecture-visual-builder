import type { ArchitectureDocument } from '../types'
import {
  buildArchitectureBrief,
  type ArchitectureBrief,
  type NfrBrief,
  type SequenceFlowBrief,
  type SequenceStepBrief,
} from './architectureNarrative'
import { getEngineApiKey, getProvider, loadAiSettings, type AiProviderId } from './aiProviders'
import { aiFetch, aiUnreachableMessage } from './aiApi'

export interface SadDraft {
  purpose?: string
  executiveSummary?: string
  scope: string[]
  assumptions: string[]
  nfrs: NfrBrief[]
  sequenceFlows: SequenceFlowBrief[]
  systemNarratives: Array<{ id: string; explanation: string }>
  integrationNarratives: Array<{ id: string; explanation: string }>
  observations: string[]
  risks: string[]
  recommendations: string[]
}

export function summarizeArchitectureForSad(doc: ArchitectureDocument, brief: ArchitectureBrief): string {
  const lines: string[] = [
    `Name: ${brief.title}`,
    `Description: ${brief.description}`,
    `Counts: ${brief.stats.systems} systems, ${brief.stats.integrations} integrations, ${brief.stats.subDiagrams} nested diagrams, ${brief.sequenceFlows.length} sequence flows`,
    '',
    'Views:',
    ...brief.views.map(
      (view) =>
        `- ${view.key}: ${view.path} (${view.systems.length} systems, ${view.integrations.length} integrations, ${view.sequenceFlows.length} flows)`,
    ),
    '',
    'Systems:',
    ...brief.systems.slice(0, 40).map(
      (system) =>
        `- ${system.id}: ${system.label} (${system.typeLabel}${system.vendor ? `, ${system.vendor}` : ''})${system.hasSubDiagram ? ' [nested diagram]' : ''}${system.description ? ` — ${system.description}` : ''}`,
    ),
    '',
    'Integrations:',
    ...brief.integrations.slice(0, 40).map(
      (item) =>
        `- ${item.id}: ${item.sourceLabel} -> ${item.targetLabel} via ${item.protocol} (${item.frequency}) ${item.label}`,
    ),
    '',
    'Structural sequence flows:',
    ...brief.sequenceFlows.slice(0, 16).map(
      (flow) =>
        `- ${flow.id} [${flow.viewPath}] ${flow.name}: ${flow.steps.map((step) => `${step.from}->${step.to}`).join(' | ')}`,
    ),
    '',
    'Existing NFRs:',
    ...(brief.nfrs.length
      ? brief.nfrs.map((item) => `- ${item.id} [${item.category}/${item.source}] ${item.requirement}`)
      : ['(none)']),
  ]

  if (doc.changeDesigns?.length) {
    lines.push('', 'Features:')
    for (const design of doc.changeDesigns.slice(0, 8)) {
      lines.push(`- ${design.title}: ${design.definition || design.proposedChange}`)
      if (design.nonFunctionalRequirements) lines.push(`  NFR: ${design.nonFunctionalRequirements}`)
    }
  }

  const text = lines.filter((line) => line !== undefined).join('\n')
  return text.length > 24000 ? `${text.slice(0, 23900)}\n…(truncated)` : text
}

export async function generateSadDraft(options: {
  document: ArchitectureDocument
  notes?: string
  providerId?: AiProviderId
}): Promise<SadDraft> {
  const settings = loadAiSettings()
  const provider = options.providerId ?? settings.selectedProvider
  const info = getProvider(provider)
  const brief = buildArchitectureBrief(options.document)
  const context = summarizeArchitectureForSad(options.document, brief)
  const prompt = [
    'Write SAD narrative, non-functional requirements, and sequence flows for every diagram including nested views.',
    options.notes?.trim() ? `Architect notes: ${options.notes.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  let response: Awaited<ReturnType<typeof aiFetch>>
  try {
    response = await aiFetch('sad', {
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
    throw new Error(payload.error || `${info.label} SAD writing failed (${response.status})`)
  }
  if (!payload.text) {
    throw new Error(`${info.shortLabel} returned an empty SAD draft`)
  }
  return normalizeSadDraft(parseJsonObject(payload.text), brief)
}

export function applySadDraft(brief: ArchitectureBrief, draft?: SadDraft | null): ArchitectureBrief {
  if (!draft) return brief

  const nfrs = mergeNfrs(brief.nfrs, draft.nfrs)
  const sequenceFlows = mergeSequenceFlows(brief.sequenceFlows, draft.sequenceFlows)
  const systemById = new Map(draft.systemNarratives.map((item) => [item.id, item.explanation]))
  const integrationById = new Map(draft.integrationNarratives.map((item) => [item.id, item.explanation]))

  return {
    ...brief,
    purpose: draft.purpose || brief.purpose,
    executiveSummary: draft.executiveSummary || brief.executiveSummary,
    scope: draft.scope.length > 0 ? uniqueKeep(draft.scope, brief.scope) : brief.scope,
    assumptions: draft.assumptions.length > 0 ? uniqueKeep(draft.assumptions, brief.assumptions) : brief.assumptions,
    observations: uniqueKeep(draft.observations, brief.observations).slice(0, 10),
    nfrs,
    sequenceFlows,
    systems: brief.systems.map((system) =>
      systemById.has(system.id) ? { ...system, explanation: systemById.get(system.id)! } : system,
    ),
    integrations: brief.integrations.map((item) =>
      integrationById.has(item.id) ? { ...item, explanation: integrationById.get(item.id)! } : item,
    ),
    risks: draft.risks.slice(0, 8),
    recommendations: draft.recommendations.slice(0, 8),
    aiWritten: true,
  }
}

function mergeNfrs(base: NfrBrief[], extra: NfrBrief[]): NfrBrief[] {
  const merged: NfrBrief[] = []
  const seen = new Set<string>()
  for (const item of [...extra, ...base]) {
    const key = item.requirement.toLowerCase()
    if (!item.requirement || seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return merged.slice(0, 16)
}

function mergeSequenceFlows(base: SequenceFlowBrief[], extra: SequenceFlowBrief[]): SequenceFlowBrief[] {
  if (extra.length === 0) return base
  const used = new Set<number>()
  const merged = base.map((flow) => {
    const matchIndex = extra.findIndex((item, index) => !used.has(index) && flowsMatch(flow, item))
    if (matchIndex < 0) return flow
    used.add(matchIndex)
    const draft = extra[matchIndex]
    return {
      ...flow,
      name: draft.name || flow.name,
      summary: draft.summary || flow.summary,
      steps: flow.steps.map((step, index) => {
        const drafted = draft.steps[index]
        if (!drafted) return step
        return {
          ...step,
          message: drafted.message || step.message,
        }
      }),
      script: flow.steps
        .map((step, index) => {
          const message = draft.steps[index]?.message || step.message
          return `${index + 1}. ${step.from} → ${step.to} : ${step.protocol} — ${message}`
        })
        .join('\n'),
    }
  })

  extra.forEach((item, index) => {
    if (used.has(index)) return
    if (item.steps.length === 0) return
    merged.push(item)
  })
  return merged.slice(0, 16)
}

function flowsMatch(base: SequenceFlowBrief, draft: SequenceFlowBrief): boolean {
  if (draft.id && draft.id === base.id) return true
  if (draft.viewPath && draft.viewPath === base.viewPath && similarName(base.name, draft.name)) return true
  const baseTrail = base.steps.map((step) => `${step.from}>${step.to}`).join('|')
  const draftTrail = draft.steps.map((step) => `${step.from}>${step.to}`).join('|')
  return Boolean(draftTrail) && baseTrail === draftTrail
}

function similarName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? trimmed).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('The model did not return a JSON SAD draft. Try again.')
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    throw new Error('Could not parse the SAD draft. Try again.')
  }
}

function normalizeSadDraft(raw: unknown, brief: ArchitectureBrief): SadDraft {
  if (!raw || typeof raw !== 'object') {
    throw new Error('SAD draft is empty')
  }
  const input = raw as Record<string, unknown>
  const nfrs = asArray(input.nonFunctionalRequirements)
    .map((item, index) => normalizeNfr(item, index))
    .filter((item): item is NfrBrief => Boolean(item))
  const sequenceFlows = asArray(input.sequenceFlows)
    .map((item, index) => normalizeSequence(item, index, brief))
    .filter((item): item is SequenceFlowBrief => Boolean(item))

  if (!asString(input.executiveSummary) && nfrs.length === 0 && sequenceFlows.length === 0) {
    throw new Error('The model returned no usable SAD content.')
  }

  return {
    purpose: asString(input.purpose) || undefined,
    executiveSummary: asString(input.executiveSummary) || undefined,
    scope: stringList(input.scope).slice(0, 10),
    assumptions: stringList(input.assumptions).slice(0, 8),
    nfrs: nfrs.slice(0, 12),
    sequenceFlows: sequenceFlows.slice(0, 16),
    systemNarratives: asArray(input.systemNarratives)
      .map(normalizeNarrative)
      .filter((item): item is { id: string; explanation: string } => Boolean(item))
      .slice(0, 40),
    integrationNarratives: asArray(input.integrationNarratives)
      .map(normalizeNarrative)
      .filter((item): item is { id: string; explanation: string } => Boolean(item))
      .slice(0, 40),
    observations: stringList(input.observations).slice(0, 8),
    risks: stringList(input.risks).slice(0, 8),
    recommendations: stringList(input.recommendations).slice(0, 8),
  }
}

function normalizeNfr(raw: unknown, index: number): NfrBrief | null {
  if (typeof raw === 'string') {
    const requirement = raw.trim()
    if (!requirement) return null
    return {
      id: `NFR-AI-${index + 1}`,
      category: 'Operability',
      requirement,
      rationale: 'AI-authored quality attribute for this landscape.',
      source: 'ai',
    }
  }
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const requirement = asString(input.requirement)
  if (!requirement) return null
  return {
    id: asString(input.id) || `NFR-AI-${index + 1}`,
    category: asString(input.category) || 'Operability',
    requirement,
    rationale: asString(input.rationale) || 'AI-authored quality attribute for this landscape.',
    source: 'ai',
  }
}

function normalizeSequence(raw: unknown, index: number, brief: ArchitectureBrief): SequenceFlowBrief | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const steps = asArray(input.steps)
    .map(normalizeStep)
    .filter((item): item is SequenceStepBrief => Boolean(item))
  if (steps.length === 0) return null
  const viewPath = asString(input.viewPath) || brief.views[0]?.path || brief.title
  const matchingView = brief.views.find((view) => view.path === viewPath || view.key === asString(input.viewKey))
  const name = asString(input.name) || `${steps[0].from} to ${steps[steps.length - 1].to}`
  const participants = unique(steps.flatMap((step) => [step.from, step.to]))
  return {
    id: asString(input.id) || `ai-seq-${index + 1}`,
    name,
    viewKey: matchingView?.key || asString(input.viewKey) || 'root',
    viewPath: matchingView?.path || viewPath,
    summary: asString(input.summary) || `${steps.length}-step flow from ${steps[0].from} to ${steps[steps.length - 1].to}.`,
    participants,
    steps,
    script: steps
      .map((step, hop) => `${hop + 1}. ${step.from} → ${step.to} : ${step.protocol} — ${step.message}`)
      .join('\n'),
  }
}

function normalizeStep(raw: unknown): SequenceStepBrief | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const from = asString(input.from)
  const to = asString(input.to)
  if (!from || !to) return null
  return {
    from,
    to,
    protocol: asString(input.protocol) || 'Custom',
    frequency: asString(input.frequency) || 'event-driven',
    message: asString(input.message) || asString(input.label) || `${from} to ${to}`,
  }
}

function normalizeNarrative(raw: unknown): { id: string; explanation: string } | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const id = asString(input.id)
  const explanation = asString(input.explanation)
  if (!id || !explanation) return null
  return { id, explanation }
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stringList(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
      .filter(Boolean)
  }
  if (!Array.isArray(value)) return []
  return value.map(asString).filter(Boolean)
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function uniqueKeep(primary: string[], fallback: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of [...primary, ...fallback]) {
    const key = item.trim()
    if (!key || seen.has(key.toLowerCase())) continue
    seen.add(key.toLowerCase())
    out.push(key)
  }
  return out
}
