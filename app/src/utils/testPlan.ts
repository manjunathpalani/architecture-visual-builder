import type { ArchitectureDocument } from '../types'
import {
  buildArchitectureBrief,
  type ArchitectureBrief,
  type NfrBrief,
  type SequenceFlowBrief,
} from './architectureNarrative'
import { getEngineApiKey, getProvider, loadAiSettings, type AiProviderId } from './aiProviders'
import { aiFetch, aiUnreachableMessage } from './aiApi'
import { parseAppliedNfrs } from './nfrCatalog'
import { downloadAnalysisFile } from './aiAnalysis'

export type TestSuiteKind = 'e2e' | 'contract' | 'component' | 'nfr'

export interface TestStep {
  action: string
  expected: string
}

export interface TestCase {
  id: string
  title: string
  priority: 'P0' | 'P1' | 'P2'
  components: string[]
  preconditions: string[]
  steps: TestStep[]
  data?: string
}

export interface TestSuite {
  id: string
  name: string
  kind: TestSuiteKind
  objective: string
  cases: TestCase[]
}

export interface ArchitectureTestPlan {
  title: string
  objective: string
  scope: string[]
  suites: TestSuite[]
  source: 'architecture' | 'ai'
}

export function buildStructuralTestPlan(doc: ArchitectureDocument): ArchitectureTestPlan {
  const brief = buildArchitectureBrief(doc)
  const suites: TestSuite[] = [
    ...e2eSuites(brief.sequenceFlows),
    contractSuite(brief),
    componentSuite(brief),
    nfrSuite(brief.nfrs, doc),
  ].filter((suite) => suite.cases.length > 0)

  return {
    title: `${brief.title} — end-to-end test plan`,
    objective: `Verify ${brief.title} across components, integration contracts, and end-to-end sequence flows.`,
    scope: [
      `${brief.stats.systems} components`,
      `${brief.stats.integrations} integrations`,
      `${brief.sequenceFlows.length} end-to-end sequence flow${brief.sequenceFlows.length === 1 ? '' : 's'}`,
      `${brief.nfrs.length} non-functional requirement${brief.nfrs.length === 1 ? '' : 's'}`,
    ],
    suites,
    source: 'architecture',
  }
}

export function formatTestPlanMarkdown(plan: ArchitectureTestPlan): string {
  const lines: string[] = [
    `# ${plan.title}`,
    '',
    plan.objective,
    '',
    '## Scope',
    ...plan.scope.map((item) => `- ${item}`),
    '',
    `Source: ${plan.source === 'ai' ? 'Architecture + AI' : 'Architecture (sequence flows, components, NFRs)'}`,
    `Generated: ${new Date().toISOString()}`,
    '',
  ]
  for (const suite of plan.suites) {
    lines.push(`## ${suite.name}`, '', `_${suite.kind.toUpperCase()}_ — ${suite.objective}`, '')
    for (const testCase of suite.cases) {
      lines.push(`### ${testCase.id}: ${testCase.title}`, '')
      lines.push(`- Priority: ${testCase.priority}`)
      if (testCase.components.length) lines.push(`- Components: ${testCase.components.join(', ')}`)
      if (testCase.preconditions.length) {
        lines.push('- Preconditions:')
        testCase.preconditions.forEach((item) => lines.push(`  - ${item}`))
      }
      if (testCase.data) lines.push(`- Data: ${testCase.data}`)
      lines.push('- Steps:')
      testCase.steps.forEach((step, index) => {
        lines.push(`  ${index + 1}. **Action:** ${step.action}`)
        lines.push(`     **Expected:** ${step.expected}`)
      })
      lines.push('')
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n')
}

export function downloadTestPlan(plan: ArchitectureTestPlan, architectureName: string) {
  const slug = architectureName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'architecture'
  downloadAnalysisFile(`${slug}-test-plan.md`, formatTestPlanMarkdown(plan), 'text/markdown;charset=utf-8')
}

export function downloadTestPlanJson(plan: ArchitectureTestPlan, architectureName: string) {
  const slug = architectureName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'architecture'
  downloadAnalysisFile(
    `${slug}-test-plan.json`,
    JSON.stringify({ architecture: architectureName, exportedAt: new Date().toISOString(), plan }, null, 2),
    'application/json;charset=utf-8',
  )
}

export async function generateTestPlan(options: {
  document: ArchitectureDocument
  notes?: string
  providerId?: AiProviderId
  enrichWithAi?: boolean
}): Promise<ArchitectureTestPlan> {
  const structural = buildStructuralTestPlan(options.document)
  if (!options.enrichWithAi) return structural

  const settings = loadAiSettings()
  const provider = options.providerId ?? settings.selectedProvider
  const info = getProvider(provider)
  const brief = buildArchitectureBrief(options.document)
  const prompt = [
    'Produce an end-to-end test plan for this architecture.',
    'Cover sequence-flow journeys, component smoke tests, integration contracts, and NFRs.',
    'Keep case ids stable (E2E-1, CT-1, CMP-1, NFR-1). Use Given/When/Then style in steps.',
    options.notes?.trim() ? `Tester notes: ${options.notes.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  let response: Awaited<ReturnType<typeof aiFetch>>
  try {
    response = await aiFetch('testplan', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        context: summarizeForTestPlan(brief, structural),
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
    throw new Error(payload.error || `${info.label} test plan failed (${response.status})`)
  }
  if (!payload.text) return structural
  try {
    return { ...normalizeTestPlan(parseJsonObject(payload.text), structural), source: 'ai' }
  } catch {
    return structural
  }
}

function e2eSuites(flows: SequenceFlowBrief[]): TestSuite[] {
  return flows.slice(0, 12).map((flow, index) => {
    const happySteps: TestStep[] = flow.steps.map((step) => ({
      action: `Send ${step.protocol} “${step.message}” from ${step.from} to ${step.to} (${step.frequency}).`,
      expected: `${step.to} accepts the message, processes it, and the hop completes without error.`,
    }))
    happySteps.push({
      action: 'Observe the end-to-end outcome on the last participant.',
      expected: 'The journey completes with the business result implied by the sequence; no hop is skipped.',
    })

    const failHop = flow.steps[Math.max(0, Math.ceil(flow.steps.length / 2) - 1)]
    const cases: TestCase[] = [
      {
        id: `E2E-${index + 1}`,
        title: `Happy path — ${flow.name}`,
        priority: index === 0 ? 'P0' : 'P1',
        components: flow.participants,
        preconditions: [
          `All participants are available: ${flow.participants.join(', ')}.`,
          'Test credentials and sample payload for this journey are prepared.',
        ],
        steps: happySteps,
        data: flow.script.split('\n')[0] || flow.summary,
      },
    ]
    if (failHop) {
      cases.push({
        id: `E2E-${index + 1}F`,
        title: `Fault injection — ${failHop.to} unavailable on ${flow.name}`,
        priority: 'P1',
        components: flow.participants,
        preconditions: [`${failHop.to} can be stopped, blocked, or made to return an error.`],
        steps: [
          {
            action: `Start the ${flow.name} journey through ${failHop.from}.`,
            expected: 'Upstream hops succeed until the injected fault.',
          },
          {
            action: `Fail or timeout ${failHop.to} while processing “${failHop.message}”.`,
            expected: 'The hop errors visibly; retry or dead-letter behaviour matches the integration design; no silent drop.',
          },
        ],
      })
    }
    return {
      id: `suite-e2e-${flow.id}`,
      name: `E2E — ${flow.name}`,
      kind: 'e2e',
      objective: flow.summary || `Prove the ${flow.name} journey across ${flow.participants.join(' → ')}.`,
      cases,
    }
  })
}

function contractSuite(brief: ArchitectureBrief): TestSuite {
  const cases: TestCase[] = brief.integrations.slice(0, 20).map((item, index) => ({
    id: `CT-${index + 1}`,
    title: `${item.sourceLabel} → ${item.targetLabel} (${item.protocol})`,
    priority: item.frequency === 'real-time' || item.frequency === 'near-real-time' ? 'P0' : 'P1',
    components: [item.sourceLabel, item.targetLabel],
    preconditions: [`${item.sourceLabel} and ${item.targetLabel} are reachable over ${item.protocol}.`],
    steps: [
      {
        action: `Publish a valid ${item.dataFormat} ${item.label} message from ${item.sourceLabel} to ${item.targetLabel}.`,
        expected: `${item.targetLabel} accepts the contract and processes it (${item.frequency}).`,
      },
      {
        action: 'Publish a payload that violates the schema or required fields.',
        expected: 'The call is rejected or sent to an error path; the target store is unchanged.',
      },
    ],
    data: item.description || item.label,
  }))
  return {
    id: 'suite-contract',
    name: 'Integration contracts',
    kind: 'contract',
    objective: 'Prove each modelled integration accepts valid traffic and rejects invalid payloads.',
    cases,
  }
}

function componentSuite(brief: ArchitectureBrief): TestSuite {
  const cases: TestCase[] = brief.systems.slice(0, 24).map((system, index) => ({
    id: `CMP-${index + 1}`,
    title: `Smoke — ${system.label}`,
    priority: 'P2',
    components: [system.label],
    preconditions: [`${system.label} is deployed in the test environment (${system.environment ?? system.typeLabel}).`],
    steps: [
      {
        action: `Health-check or start ${system.label}.`,
        expected: 'The component is up and reports ready.',
      },
      {
        action: system.api
          ? `Call a documented ${system.api.methods[0] ?? 'GET'} operation on ${system.label}.`
          : `Exercise the primary function of ${system.label}.`,
        expected: system.api
          ? 'The API responds according to its contract.'
          : `${system.label} performs its documented role without error.`,
      },
    ],
  }))
  return {
    id: 'suite-component',
    name: 'Component smoke',
    kind: 'component',
    objective: 'Confirm each architecture component is present and callable before E2E runs.',
    cases,
  }
}

function nfrSuite(nfrs: NfrBrief[], doc: ArchitectureDocument): TestSuite {
  const fromTemplates = doc.systems.flatMap((system) =>
    parseAppliedNfrs(system.properties).map((nfr) => ({
      id: nfr.itemId,
      category: nfr.category,
      requirement: `${system.label}: ${nfr.requirement}`,
      rationale: nfr.rationale,
      source: 'architecture' as const,
    })),
  )
  const all = [...nfrs, ...fromTemplates].filter(
    (item, index, list) => list.findIndex((row) => row.requirement === item.requirement) === index,
  )
  const cases: TestCase[] = all.slice(0, 16).map((nfr, index) => ({
    id: `NFR-${index + 1}`,
    title: `${nfr.category} — ${nfr.requirement.slice(0, 80)}${nfr.requirement.length > 80 ? '…' : ''}`,
    priority: nfr.category === 'Security' || nfr.category === 'Reliability' ? 'P0' : 'P1',
    components: [],
    preconditions: [nfr.rationale || 'NFR is in scope for this architecture.'],
    steps: [
      {
        action: `Design and execute a test that would fail if this NFR is not met: ${nfr.requirement}`,
        expected: 'Measured result meets the NFR (SLO, control, or quality attribute).',
      },
    ],
  }))
  return {
    id: 'suite-nfr',
    name: 'Non-functional tests',
    kind: 'nfr',
    objective: 'Verify quality attributes applied to the architecture and its components.',
    cases,
  }
}

function summarizeForTestPlan(brief: ArchitectureBrief, structural: ArchitectureTestPlan): string {
  const lines = [
    `Name: ${brief.title}`,
    brief.description,
    `Structural plan already derived ${structural.suites.length} suites / ${structural.suites.reduce((sum, suite) => sum + suite.cases.length, 0)} cases.`,
    '',
    'Sequence flows:',
    ...brief.sequenceFlows.slice(0, 12).map(
      (flow) => `- ${flow.name}: ${flow.steps.map((step) => `${step.from}-[${step.protocol}]->${step.to}`).join(' | ')}`,
    ),
    '',
    'Components:',
    ...brief.systems.slice(0, 30).map((system) => `- ${system.label} (${system.typeLabel})`),
    '',
    'NFRs:',
    ...brief.nfrs.slice(0, 16).map((nfr) => `- [${nfr.category}] ${nfr.requirement}`),
  ]
  const text = lines.join('\n')
  return text.length > 22000 ? `${text.slice(0, 21800)}\n…(truncated)` : text
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? trimmed).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('no json')
  return JSON.parse(candidate.slice(start, end + 1))
}

function normalizeTestPlan(raw: unknown, fallback: ArchitectureTestPlan): ArchitectureTestPlan {
  if (!raw || typeof raw !== 'object') return fallback
  const input = raw as Record<string, unknown>
  const suites = Array.isArray(input.suites)
    ? input.suites
        .map((suite, suiteIndex) => normalizeSuite(suite, suiteIndex))
        .filter((suite): suite is TestSuite => Boolean(suite))
    : []
  if (suites.length === 0) return fallback
  return {
    title: asString(input.title) || fallback.title,
    objective: asString(input.objective) || fallback.objective,
    scope: stringList(input.scope).length ? stringList(input.scope) : fallback.scope,
    suites,
    source: 'ai',
  }
}

function normalizeSuite(raw: unknown, index: number): TestSuite | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const name = asString(input.name)
  const cases = Array.isArray(input.cases)
    ? input.cases
        .map((item, caseIndex) => normalizeCase(item, caseIndex))
        .filter((item): item is TestCase => Boolean(item))
    : []
  if (!name || cases.length === 0) return null
  const kindRaw = asString(input.kind).toLowerCase()
  const kind: TestSuiteKind =
    kindRaw === 'e2e' || kindRaw === 'contract' || kindRaw === 'component' || kindRaw === 'nfr' ? kindRaw : 'e2e'
  return {
    id: asString(input.id) || `suite-${index + 1}`,
    name,
    kind,
    objective: asString(input.objective),
    cases,
  }
}

function normalizeCase(raw: unknown, index: number): TestCase | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const title = asString(input.title)
  const steps = Array.isArray(input.steps)
    ? input.steps
        .map((step) => {
          if (!step || typeof step !== 'object') return null
          const row = step as Record<string, unknown>
          const action = asString(row.action)
          const expected = asString(row.expected)
          if (!action || !expected) return null
          return { action, expected }
        })
        .filter((step): step is TestStep => Boolean(step))
    : []
  if (!title || steps.length === 0) return null
  const priorityRaw = asString(input.priority).toUpperCase()
  return {
    id: asString(input.id) || `TC-${index + 1}`,
    title,
    priority: priorityRaw === 'P0' || priorityRaw === 'P1' || priorityRaw === 'P2' ? priorityRaw : 'P1',
    components: stringList(input.components),
    preconditions: stringList(input.preconditions),
    steps,
    data: asString(input.data) || undefined,
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(asString).filter(Boolean)
}
