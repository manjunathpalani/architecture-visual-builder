import type { ArchitectureDocument, Integration, SequenceFlowStep, SystemNode } from '../types'
import type { DrawingElement } from '../types/diagram'

function stamp(doc: ArchitectureDocument): ArchitectureDocument {
  return {
    ...doc,
    metadata: { ...doc.metadata, updatedAt: new Date().toISOString() },
  }
}

function zone(id: string, x: number, y: number, w: number, h: number, color: string): DrawingElement {
  return {
    id,
    type: 'rectangle',
    points: [
      { x, y },
      { x: x + w, y: y + h },
    ],
    color,
    strokeWidth: 2,
    fill: `${color}12`,
  }
}

function label(id: string, x: number, y: number, text: string, color: string): DrawingElement {
  return {
    id,
    type: 'text',
    points: [{ x, y }],
    color,
    strokeWidth: 1,
    text,
    fontSize: 13,
  }
}

function edge(
  id: string,
  source: string,
  target: string,
  name: string,
  protocol: Integration['protocol'] = 'Custom',
  extra?: Partial<Integration>,
): Integration {
  return {
    id,
    source,
    target,
    label: name,
    direction: extra?.direction ?? 'outbound',
    protocol,
    frequency: extra?.frequency ?? 'real-time',
    dataFormat: extra?.dataFormat ?? 'JSON',
    description: extra?.description ?? name,
    ...extra,
  }
}

function step(
  id: string,
  name: string,
  x: number,
  y: number,
  description: string,
  shape: 'process' | 'decision' | 'actor' | 'queue' | 'datastore' = 'process',
  extra?: Partial<SystemNode>,
): SystemNode {
  return {
    id,
    type: extra?.type ?? 'diagram',
    label: name,
    category: extra?.category ?? 'Business',
    position: { x, y },
    properties: {
      shape,
      description,
      width: shape === 'decision' ? '170' : shape === 'actor' ? '140' : '180',
      height: shape === 'decision' ? '110' : '80',
      ...extra?.properties,
    },
    subDiagram: extra?.subDiagram,
  }
}

function hops(...items: Array<[string, string]>): SequenceFlowStep[] {
  return items.map(([systemId, label], index) => ({
    id: `seq-${systemId}-${index + 1}`,
    systemId,
    label,
  }))
}

function validationInternals(): NonNullable<SystemNode['subDiagram']> {
  return {
    name: 'Input validation',
    description: 'Schema, completeness, format, and duplicate checks before rules run',
    systems: [
      step('val-schema', 'Schema check', 60, 120, 'Validate payload against the process contract', 'process'),
      step('val-required', 'Required fields', 300, 120, 'Reject missing mandatory attributes', 'process'),
      step('val-format', 'Format & range', 540, 120, 'Types, lengths, dates, and allowed values', 'process'),
      step('val-duplicate', 'Duplicate check', 780, 40, 'Detect replayed or already-open cases', 'process'),
      step('val-result', 'Validation result', 780, 200, 'Pass, fail, or return for correction', 'decision'),
    ],
    integrations: [
      edge('val-e1', 'val-schema', 'val-required', 'Valid schema', 'Custom', {
        description: 'Continue only when the message matches the process schema',
      }),
      edge('val-e2', 'val-required', 'val-format', 'Complete', 'Custom'),
      edge('val-e3', 'val-format', 'val-duplicate', 'In range', 'Custom'),
      edge('val-e4', 'val-duplicate', 'val-result', 'Uniqueness result', 'Custom'),
    ],
  }
}

function rulesInternals(): NonNullable<SystemNode['subDiagram']> {
  return {
    name: 'Business rules',
    description: 'Eligibility, policy limits, and decision-table evaluation',
    systems: [
      step('rul-pack', 'Load rule pack', 60, 120, 'Select the versioned rule set for this process', 'process'),
      step('rul-elig', 'Eligibility rules', 300, 40, 'Who may start or continue this process', 'process'),
      step('rul-policy', 'Policy & limits', 300, 200, 'Amounts, SLAs, jurisdictions, and mandates', 'process'),
      step('rul-table', 'Decision table', 540, 120, 'Condition/action matrix for the current case', 'process'),
      step('rul-score', 'Score / outcome', 780, 120, 'Approve, refer, or reject with reasons', 'decision'),
    ],
    integrations: [
      edge('rul-e1', 'rul-pack', 'rul-elig', 'Apply eligibility', 'Custom'),
      edge('rul-e2', 'rul-pack', 'rul-policy', 'Apply policy', 'Custom'),
      edge('rul-e3', 'rul-elig', 'rul-table', 'Eligible facts', 'Custom'),
      edge('rul-e4', 'rul-policy', 'rul-table', 'Policy facts', 'Custom'),
      edge('rul-e5', 'rul-table', 'rul-score', 'Rule hits', 'Custom'),
    ],
  }
}

/** Straight-through process with validation, rules, and exception path */
export function createStraightThroughProcess(): ArchitectureDocument {
  const systems: SystemNode[] = [
    step('stp-actor', 'Requester', 48, 48, 'Customer, partner, or system that starts the process', 'actor'),
    step('stp-start', 'Start process', 48, 220, 'Create the process instance and correlation id', 'process'),
    step('stp-capture', 'Capture request', 268, 220, 'Collect the payload, documents, and context', 'process'),
    {
      ...step('stp-validate', 'Validate input', 488, 220, 'Schema, completeness, format, and duplicate checks', 'process'),
      subDiagram: validationInternals(),
    },
    {
      ...step('stp-rules', 'Apply business rules', 708, 220, 'Eligibility, policy, and decision-table evaluation', 'process'),
      subDiagram: rulesInternals(),
    },
    step('stp-decision', 'Pass controls?', 948, 208, 'Route on validation and rule outcomes', 'decision'),
    step('stp-execute', 'Execute process', 1168, 140, 'Straight-through fulfillment when controls pass', 'process'),
    step('stp-complete', 'Complete', 1388, 140, 'Close the instance and emit completion events', 'process'),
    step('stp-exception', 'Exception queue', 948, 400, 'Hold failed or referred work for operations', 'queue'),
    step('stp-repair', 'Correct & resubmit', 1168, 400, 'Fix data or policy exceptions and re-enter controls', 'process'),
    {
      id: 'stp-brms',
      type: 'middleware',
      label: 'Rules engine (BRMS)',
      category: 'Middleware',
      position: { x: 708, y: 40 },
      properties: {
        description: 'Versioned rule packs and decision tables used by the apply-rules step',
        width: '200',
        height: '80',
      },
    },
    {
      id: 'stp-audit',
      type: 'database',
      label: 'Process & rule audit',
      category: 'Database',
      position: { x: 488, y: 400 },
      properties: {
        description: 'Validation results, rule hits, and process trail',
        width: '190',
        height: '80',
      },
    },
  ]

  const integrations: Integration[] = [
    edge('stp-e0', 'stp-actor', 'stp-start', 'Submit', 'REST API', { dataFormat: 'JSON' }),
    edge('stp-e1', 'stp-start', 'stp-capture', 'Instance created', 'Custom'),
    edge('stp-e2', 'stp-capture', 'stp-validate', 'Validate payload', 'Custom', {
      description: 'Run schema, required-field, format, and duplicate checks',
      sequenceFlow: hops(
        ['val-schema', 'Schema check'],
        ['val-required', 'Required fields'],
        ['val-format', 'Format & range'],
        ['val-duplicate', 'Duplicate check'],
      ),
    }),
    edge('stp-e3', 'stp-validate', 'stp-rules', 'Apply rules', 'Custom', {
      description: 'Evaluate eligibility, policy limits, and the decision table',
      sequenceFlow: hops(
        ['rul-pack', 'Load rule pack'],
        ['rul-elig', 'Eligibility rules'],
        ['rul-policy', 'Policy & limits'],
        ['rul-table', 'Decision table'],
        ['rul-score', 'Score / outcome'],
      ),
    }),
    edge('stp-e4', 'stp-rules', 'stp-decision', 'Control outcome', 'Custom'),
    edge('stp-e5', 'stp-decision', 'stp-execute', 'Pass', 'Custom', {
      description: 'Validation and rules both passed — continue straight through',
    }),
    edge('stp-e6', 'stp-execute', 'stp-complete', 'Fulfilled', 'Custom'),
    edge('stp-e7', 'stp-decision', 'stp-exception', 'Fail / refer', 'Custom', {
      description: 'Validation failure or rule referral — park for correction',
    }),
    edge('stp-e8', 'stp-exception', 'stp-repair', 'Work item', 'Custom'),
    edge('stp-e9', 'stp-repair', 'stp-validate', 'Resubmit', 'Custom', { description: 'Re-enter validation and rules' }),
    edge('stp-e10', 'stp-rules', 'stp-brms', 'Evaluate rule pack', 'REST API', { direction: 'bidirectional' }),
    edge('stp-e11', 'stp-validate', 'stp-audit', 'Validation log', 'Custom', { frequency: 'event-driven' }),
    edge('stp-e12', 'stp-rules', 'stp-audit', 'Rule hits', 'Custom', { frequency: 'event-driven' }),
  ]

  return stamp({
    metadata: {
      name: 'Straight-through process',
      description:
        'BPM straight-through process: capture, validate, apply business rules, then execute or park exceptions',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations,
    drawings: [
      zone('stp-z-intake', 24, 180, 430, 180, '#7c3aed'),
      label('stp-z-intake-l', 36, 198, '1. Intake', '#7c3aed'),
      zone('stp-z-controls', 468, 180, 450, 180, '#2563eb'),
      label('stp-z-controls-l', 480, 198, '2. Validation & rules', '#2563eb'),
      zone('stp-z-outcome', 928, 100, 640, 260, '#059669'),
      label('stp-z-outcome-l', 940, 118, '3. Outcome', '#059669'),
      zone('stp-z-exception', 928, 372, 440, 160, '#d97706'),
      label('stp-z-exception-l', 940, 390, 'Exception path', '#d97706'),
    ],
  })
}

/** Request / approval process with auto-rules and a human gate */
export function createApprovalProcess(): ArchitectureDocument {
  const systems: SystemNode[] = [
    step('ap-requester', 'Requester', 48, 48, 'Employee or partner submitting the request', 'actor'),
    step('ap-submit', 'Submit request', 48, 240, 'Create the request case and attach evidence', 'process'),
    {
      ...step('ap-validate', 'Validate request', 280, 240, 'Completeness, identity, and document checks', 'process'),
      subDiagram: validationInternals(),
    },
    {
      ...step('ap-rules', 'Apply approval rules', 512, 240, 'Limits, delegations, and auto-approve policy', 'process'),
      subDiagram: rulesInternals(),
    },
    step('ap-route', 'Auto-approve?', 744, 228, 'Auto-approve, reject, or send to a human', 'decision'),
    step('ap-approver', 'Approver', 976, 48, 'Named manager or four-eyes reviewer', 'actor'),
    step('ap-review', 'Human review', 976, 228, 'Inspect rule reasons and evidence', 'process'),
    step('ap-gate', 'Approved?', 1208, 228, 'Human approve or reject', 'decision'),
    step('ap-execute', 'Execute change', 1440, 140, 'Provision, pay, or update the system of record', 'process'),
    step('ap-reject', 'Notify & close', 1440, 340, 'Return reasons and close the case', 'process'),
    {
      id: 'ap-brms',
      type: 'middleware',
      label: 'Policy / BRMS',
      category: 'Middleware',
      position: { x: 512, y: 48 },
      properties: {
        description: 'Approval limits, SOD, and auto-approve thresholds',
        width: '190',
        height: '80',
      },
    },
    {
      id: 'ap-work',
      type: 'saas',
      label: 'Task inbox',
      category: 'SaaS',
      position: { x: 976, y: 400 },
      properties: {
        vendor: 'ServiceNow / Power Automate',
        description: 'Human approval work queue with SLA',
        width: '190',
        height: '80',
      },
    },
  ]

  const integrations: Integration[] = [
    edge('ap-e0', 'ap-requester', 'ap-submit', 'Submit', 'REST API'),
    edge('ap-e1', 'ap-submit', 'ap-validate', 'Validate', 'Custom', {
      sequenceFlow: hops(
        ['val-schema', 'Schema check'],
        ['val-required', 'Required fields'],
        ['val-format', 'Format & range'],
        ['val-duplicate', 'Duplicate check'],
      ),
    }),
    edge('ap-e2', 'ap-validate', 'ap-rules', 'Evaluate policy', 'Custom', {
      sequenceFlow: hops(
        ['rul-pack', 'Load rule pack'],
        ['rul-elig', 'Eligibility rules'],
        ['rul-policy', 'Policy & limits'],
        ['rul-table', 'Decision table'],
      ),
    }),
    edge('ap-e3', 'ap-rules', 'ap-route', 'Rule outcome', 'Custom'),
    edge('ap-e4', 'ap-route', 'ap-execute', 'Within auto-limit', 'Custom', {
      description: 'Rules auto-approve — no human step',
    }),
    edge('ap-e5', 'ap-route', 'ap-reject', 'Hard reject', 'Custom', {
      description: 'Failed validation or mandatory policy block',
    }),
    edge('ap-e6', 'ap-route', 'ap-review', 'Refer to human', 'Custom', {
      description: 'Over limit, missing evidence, or SOD conflict',
    }),
    edge('ap-e7', 'ap-approver', 'ap-review', 'Open task', 'Webhook'),
    edge('ap-e8', 'ap-review', 'ap-gate', 'Decision', 'Custom'),
    edge('ap-e9', 'ap-gate', 'ap-execute', 'Approved', 'Custom'),
    edge('ap-e10', 'ap-gate', 'ap-reject', 'Rejected', 'Custom'),
    edge('ap-e11', 'ap-rules', 'ap-brms', 'Decision table', 'REST API', { direction: 'bidirectional' }),
    edge('ap-e12', 'ap-review', 'ap-work', 'Assign inbox item', 'REST API', { direction: 'bidirectional' }),
  ]

  return stamp({
    metadata: {
      name: 'Approval process with rules',
      description:
        'BPM approval: validate the request, apply policy rules, auto-approve in-limit work, and send exceptions to a human gate',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations,
    drawings: [
      zone('ap-z-auto', 24, 196, 880, 200, '#2563eb'),
      label('ap-z-auto-l', 36, 214, 'Automated controls — validation & rules', '#2563eb'),
      zone('ap-z-human', 952, 196, 430, 200, '#d97706'),
      label('ap-z-human-l', 964, 214, 'Human gate', '#d97706'),
      zone('ap-z-done', 1408, 100, 260, 360, '#059669'),
      label('ap-z-done-l', 1420, 118, 'Outcome', '#059669'),
    ],
  })
}

/** Swimlane onboarding process across customer, operations, and systems */
export function createOnboardingProcess(): ArchitectureDocument {
  const systems: SystemNode[] = [
    step('ob-customer', 'Applicant', 48, 72, 'Person starting onboarding', 'actor'),
    step('ob-apply', 'Start application', 260, 80, 'Enter identity and product choice', 'process'),
    step('ob-docs', 'Provide documents', 700, 80, 'Upload ID, address, and consents', 'process'),
    step('ob-outcome', 'Receive outcome', 1380, 80, 'Approved, referred, or rejected notice', 'process'),

    step('ob-kyc', 'KYC review', 940, 248, 'Operations checks high-risk or failed rules', 'process'),
    step('ob-except', 'Handle exception', 1160, 248, 'Request more evidence or override with reason', 'process'),

    step('ob-capture', 'Capture case', 260, 420, 'Create the onboarding case in the BPM engine', 'process'),
    {
      ...step('ob-validate', 'Validate data & docs', 500, 420, 'Schema, document quality, and completeness', 'process'),
      subDiagram: validationInternals(),
    },
    {
      ...step('ob-rules', 'KYC / policy rules', 740, 420, 'Sanctions, risk score, product eligibility', 'process'),
      subDiagram: rulesInternals(),
    },
    step('ob-decide', 'Straight-through?', 980, 408, 'Auto-provision, refer to KYC, or reject', 'decision'),
    step('ob-provision', 'Provision account', 1220, 420, 'Create customer, entitlements, and welcome pack', 'process'),
    {
      id: 'ob-core',
      type: 'saas',
      label: 'Core / CRM',
      category: 'SaaS',
      position: { x: 1440, y: 420 },
      properties: { description: 'System of record updated on successful onboarding', width: '170', height: '80' },
    },
  ]

  const integrations: Integration[] = [
    edge('ob-e0', 'ob-customer', 'ob-apply', 'Start', 'REST API'),
    edge('ob-e1', 'ob-apply', 'ob-capture', 'Create case', 'REST API'),
    edge('ob-e2', 'ob-capture', 'ob-validate', 'Validate', 'Custom', {
      sequenceFlow: hops(
        ['val-schema', 'Schema check'],
        ['val-required', 'Required fields'],
        ['val-format', 'Format & range'],
      ),
    }),
    edge('ob-e3', 'ob-validate', 'ob-docs', 'Need documents', 'Webhook'),
    edge('ob-e4', 'ob-docs', 'ob-validate', 'Documents received', 'REST API'),
    edge('ob-e5', 'ob-validate', 'ob-rules', 'Run KYC rules', 'Custom', {
      sequenceFlow: hops(
        ['rul-pack', 'Load rule pack'],
        ['rul-elig', 'Eligibility rules'],
        ['rul-policy', 'Policy & limits'],
        ['rul-table', 'Decision table'],
        ['rul-score', 'Score / outcome'],
      ),
    }),
    edge('ob-e6', 'ob-rules', 'ob-decide', 'Risk outcome', 'Custom'),
    edge('ob-e7', 'ob-decide', 'ob-provision', 'Low risk — STP', 'Custom'),
    edge('ob-e8', 'ob-decide', 'ob-kyc', 'Refer to operations', 'Custom'),
    edge('ob-e9', 'ob-decide', 'ob-outcome', 'Reject', 'Webhook'),
    edge('ob-e10', 'ob-kyc', 'ob-except', 'More evidence', 'Custom'),
    edge('ob-e11', 'ob-except', 'ob-validate', 'Resubmit pack', 'Custom'),
    edge('ob-e12', 'ob-kyc', 'ob-provision', 'Manual approve', 'Custom'),
    edge('ob-e13', 'ob-provision', 'ob-core', 'Create customer', 'REST API'),
    edge('ob-e14', 'ob-provision', 'ob-outcome', 'Welcome', 'Webhook'),
  ]

  return stamp({
    metadata: {
      name: 'Onboarding process (swimlanes)',
      description:
        'BPM onboarding across customer, operations, and systems lanes, with validation, KYC rules, and a straight-through vs refer decision',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations,
    drawings: [
      zone('ob-z-cust', 24, 32, 1600, 160, '#7c3aed'),
      label('ob-z-cust-l', 36, 50, 'Customer', '#7c3aed'),
      zone('ob-z-ops', 24, 208, 1600, 160, '#d97706'),
      label('ob-z-ops-l', 36, 226, 'Operations', '#d97706'),
      zone('ob-z-sys', 24, 384, 1600, 180, '#2563eb'),
      label('ob-z-sys-l', 36, 402, 'Systems — capture, validate, rules, provision', '#2563eb'),
    ],
  })
}

/** Case / exception process with classification rules */
export function createCaseProcess(): ArchitectureDocument {
  const systems: SystemNode[] = [
    step('cs-channel', 'Channel / intake', 48, 80, 'Portal, email, chat, or system event', 'actor'),
    step('cs-intake', 'Log case', 48, 260, 'Create the case and attach the trigger payload', 'process'),
    {
      ...step('cs-classify', 'Classify (rules)', 280, 260, 'Type, severity, and owning queue from a rule pack', 'process'),
      subDiagram: rulesInternals(),
    },
    {
      ...step('cs-validate', 'Validate case data', 512, 260, 'Required evidence and data quality for that case type', 'process'),
      subDiagram: validationInternals(),
    },
    step('cs-route', 'How to handle?', 744, 248, 'Standard, specialist, or reject', 'decision'),
    step('cs-standard', 'Standard resolve', 976, 140, 'Scripted steps for the classified type', 'process'),
    step('cs-specialist', 'Specialist investigate', 976, 280, 'Human investigation with extra rules checks', 'process'),
    step('cs-reject', 'Return to channel', 976, 420, 'Invalid or duplicate — close with reason', 'process'),
    step('cs-close', 'Close & notify', 1208, 210, 'Outcome, SLA stamp, and notification', 'process'),
    {
      id: 'cs-kb',
      type: 'database',
      label: 'Rules & playbooks',
      category: 'Database',
      position: { x: 280, y: 48 },
      properties: {
        description: 'Classification rules, validation contracts, and resolution playbooks',
        width: '200',
        height: '80',
      },
    },
  ]

  const integrations: Integration[] = [
    edge('cs-e0', 'cs-channel', 'cs-intake', 'Open case', 'REST API'),
    edge('cs-e1', 'cs-intake', 'cs-classify', 'Classify', 'Custom', {
      sequenceFlow: hops(
        ['rul-pack', 'Load rule pack'],
        ['rul-table', 'Decision table'],
        ['rul-score', 'Score / outcome'],
      ),
    }),
    edge('cs-e2', 'cs-classify', 'cs-validate', 'Validate for type', 'Custom', {
      sequenceFlow: hops(
        ['val-required', 'Required fields'],
        ['val-format', 'Format & range'],
        ['val-duplicate', 'Duplicate check'],
      ),
    }),
    edge('cs-e3', 'cs-validate', 'cs-route', 'Routing facts', 'Custom'),
    edge('cs-e4', 'cs-route', 'cs-standard', 'Standard type', 'Custom'),
    edge('cs-e5', 'cs-route', 'cs-specialist', 'High risk / unknown', 'Custom'),
    edge('cs-e6', 'cs-route', 'cs-reject', 'Invalid / duplicate', 'Custom'),
    edge('cs-e7', 'cs-standard', 'cs-close', 'Resolved', 'Custom'),
    edge('cs-e8', 'cs-specialist', 'cs-close', 'Resolved', 'Custom'),
    edge('cs-e9', 'cs-reject', 'cs-channel', 'Notify', 'Webhook'),
    edge('cs-e10', 'cs-close', 'cs-channel', 'Outcome', 'Webhook'),
    edge('cs-e11', 'cs-classify', 'cs-kb', 'Load playbook', 'ODBC/JDBC', { direction: 'bidirectional' }),
    edge('cs-e12', 'cs-validate', 'cs-kb', 'Type contract', 'REST API'),
  ]

  return stamp({
    metadata: {
      name: 'Case process with classification rules',
      description:
        'BPM case handling: classify with rules, validate for that case type, then route to standard, specialist, or reject',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations,
    drawings: [
      zone('cs-z-ctrl', 24, 208, 680, 200, '#2563eb'),
      label('cs-z-ctrl-l', 36, 226, 'Classification rules & validation', '#2563eb'),
      zone('cs-z-work', 720, 100, 680, 380, '#059669'),
      label('cs-z-work-l', 732, 118, 'Route and resolve', '#059669'),
    ],
  })
}
