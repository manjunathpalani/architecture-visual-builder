import type { ArchitectureDocument, Integration, SystemNode } from '../types'
import type { DiagramPath, DrawingElement, SubDiagram } from '../types/diagram'
import { addSystemsInView, getDiagramView } from './diagramNavigation'
import { generateId } from './jsonIO'

export type AgentPlanStepKind = 'think' | 'tool' | 'gate' | 'handoff'

export interface AgentPlanStep {
  id: string
  kind: AgentPlanStepKind
  title: string
  /** What this step does, or the tool it calls. */
  detail: string
}

export interface AgentPlan {
  name: string
  goal: string
  model: string
  tools: string[]
  steps: AgentPlanStep[]
}

export const AGENT_PLAN_STEP_KINDS: Array<{ id: AgentPlanStepKind; label: string; hint: string }> = [
  { id: 'think', label: 'Think', hint: 'Reason or decide the next action' },
  { id: 'tool', label: 'Tool', hint: 'Call a tool or API' },
  { id: 'gate', label: 'Gate', hint: 'Policy check or human approval' },
  { id: 'handoff', label: 'Hand off', hint: 'Pass the work to a person or another agent' },
]

export function createPlanStep(kind: AgentPlanStepKind = 'think', title = ''): AgentPlanStep {
  return { id: generateId('step'), kind, title, detail: '' }
}

export function defaultAgentPlan(): AgentPlan {
  return {
    name: 'Support agent',
    goal: 'Resolve a customer request, or hand it to a person when the policy says so.',
    model: 'SpaceXAI',
    tools: ['Search knowledge', 'Create ticket'],
    steps: [
      { id: generateId('step'), kind: 'think', title: 'Understand the request', detail: 'Read the goal and pull the facts already known.' },
      { id: generateId('step'), kind: 'tool', title: 'Search knowledge', detail: 'Search knowledge' },
      { id: generateId('step'), kind: 'gate', title: 'Needs a person?', detail: 'Escalate writes, refunds, and anything the policy denies.' },
      { id: generateId('step'), kind: 'handoff', title: 'Reply or hand off', detail: 'Send the answer, or pass the case to the queue.' },
    ],
  }
}

export function createAgentPlanDocument(plan: AgentPlan): ArchitectureDocument {
  const built = buildAgentPlanDiagram(plan)
  return {
    metadata: {
      name: plan.name.trim() || 'Agent plan',
      description: plan.goal.trim(),
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems: built.systems,
    integrations: built.integrations,
    drawings: built.drawings,
  }
}

/** Drop an agent on the open canvas and keep the plan inside it. */
export function insertAgentPlan(
  document: ArchitectureDocument,
  path: DiagramPath,
  plan: AgentPlan,
): { document: ArchitectureDocument; systemId: string; label: string } {
  const viewRight = rightEdge(document, path)
  const label = plan.name.trim() || 'Agent'
  const systemId = generateId('agent')
  const built = buildAgentPlanDiagram(plan)
  const agent: SystemNode = {
    id: systemId,
    type: 'diagram',
    label,
    category: 'Software Engineering',
    position: { x: viewRight, y: 80 },
    properties: {
      shape: 'c4-container',
      description: plan.goal.trim() || 'Agent plan',
      vendor: plan.model.trim() || undefined,
      service: plan.tools.filter(Boolean).join(', ') || undefined,
      width: '220',
      height: '120',
    },
    subDiagram: {
      name: `${label} plan`,
      description: plan.goal.trim(),
      systems: built.systems,
      integrations: built.integrations,
      drawings: built.drawings,
    },
  }
  return {
    document: addSystemsInView(document, path, [agent]),
    systemId,
    label,
  }
}

function buildAgentPlanDiagram(plan: AgentPlan): SubDiagram {
  const name = plan.name.trim() || 'Agent'
  const goal = plan.goal.trim()
  const steps = plan.steps.filter((step) => step.title.trim() || step.detail.trim())
  const tools = uniqueTools(plan, steps)
  const systems: SystemNode[] = []
  const integrations: Integration[] = []

  const agentId = generateId('agent')
  systems.push({
    id: agentId,
    type: 'diagram',
    label: name,
    category: 'Software Engineering',
    position: { x: 40, y: 150 },
    properties: {
      shape: 'c4-container',
      description: goal || 'Runs the plan from the first step to the last.',
      vendor: plan.model.trim() || undefined,
      width: '200',
      height: '110',
    },
  })

  const toolIds = new Map<string, string>()
  tools.forEach((tool, index) => {
    const id = generateId('tool')
    toolIds.set(tool.toLowerCase(), id)
    systems.push({
      id,
      type: 'middleware',
      label: tool,
      category: 'Middleware',
      position: { x: 40 + index * 200, y: 400 },
      properties: {
        componentType: 'api',
        description: `Tool available to ${name}`,
        width: '170',
        height: '80',
      },
    })
    integrations.push(flowEdge(generateId('int'), agentId, id, 'May call', 'The agent can use this tool when a step asks for it.'))
  })

  let previous = agentId
  steps.forEach((step, index) => {
    const id = generateId('step')
    const title = step.title.trim() || stepLabel(step.kind)
    systems.push({
      id,
      type: 'diagram',
      label: title,
      category: 'Software Engineering',
      position: { x: 300 + index * 230, y: step.kind === 'gate' ? 130 : 150 },
      properties: {
        shape: shapeFor(step.kind),
        description: step.detail.trim() || title,
        width: step.kind === 'gate' ? '170' : '190',
        height: step.kind === 'gate' ? '120' : '90',
      },
    })
    integrations.push(
      flowEdge(
        generateId('int'),
        previous,
        id,
        index === 0 ? 'Start plan' : 'Next',
        step.detail.trim() || title,
      ),
    )
    if (step.kind === 'tool') {
      const toolName = (step.detail.trim() || step.title.trim()).toLowerCase()
      const toolId = toolIds.get(toolName) ?? [...toolIds.values()][0]
      if (toolId) {
        integrations.push(flowEdge(generateId('int'), id, toolId, 'Call tool', `Invoke ${step.detail.trim() || step.title.trim()}`))
      }
    }
    previous = id
  })

  const width = Math.max(640, 340 + steps.length * 230)
  const drawings: DrawingElement[] = [
    {
      id: generateId('draw'),
      type: 'rectangle',
      points: [
        { x: 24, y: 48 },
        { x: width, y: 340 },
      ],
      color: '#6366f1',
      strokeWidth: 2,
      fill: '#6366f112',
    },
    {
      id: generateId('draw'),
      type: 'text',
      points: [{ x: 40, y: 68 }],
      color: '#4338ca',
      strokeWidth: 1,
      text: goal ? `Plan — ${goal}` : 'Agent plan',
      fontSize: 14,
    },
  ]
  if (tools.length > 0) {
    drawings.push({
      id: generateId('draw'),
      type: 'rectangle',
      points: [
        { x: 24, y: 360 },
        { x: Math.max(width, 40 + tools.length * 200), y: 520 },
      ],
      color: '#0ea5e9',
      strokeWidth: 2,
      fill: '#0ea5e912',
    })
    drawings.push({
      id: generateId('draw'),
      type: 'text',
      points: [{ x: 40, y: 380 }],
      color: '#0369a1',
      strokeWidth: 1,
      text: 'Tools',
      fontSize: 13,
    })
  }

  return {
    name: `${name} plan`,
    description: goal,
    systems,
    integrations,
    drawings,
  }
}

function flowEdge(id: string, source: string, target: string, label: string, description: string): Integration {
  return {
    id,
    source,
    target,
    label,
    direction: 'outbound',
    protocol: 'Custom',
    frequency: 'real-time',
    dataFormat: 'n/a',
    description,
    routing: 'smoothstep',
  }
}

function shapeFor(kind: AgentPlanStepKind): string {
  if (kind === 'gate') return 'decision'
  if (kind === 'tool') return 'component'
  if (kind === 'handoff') return 'actor'
  return 'process'
}

function stepLabel(kind: AgentPlanStepKind): string {
  return AGENT_PLAN_STEP_KINDS.find((item) => item.id === kind)?.label ?? 'Step'
}

function uniqueTools(plan: AgentPlan, steps: AgentPlanStep[]): string[] {
  const seen = new Set<string>()
  const tools: string[] = []
  const push = (value: string) => {
    const name = value.trim()
    if (!name) return
    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    tools.push(name)
  }
  plan.tools.forEach(push)
  steps.filter((step) => step.kind === 'tool').forEach((step) => push(step.detail || step.title))
  return tools
}

function rightEdge(document: ArchitectureDocument, path: DiagramPath): number {
  const systems = getDiagramView(document, path).systems
  return systems.reduce((max, system) => {
    const width = Number(system.properties?.width ?? 180)
    return Math.max(max, system.position.x + (Number.isFinite(width) ? width : 180))
  }, 40) + 80
}
