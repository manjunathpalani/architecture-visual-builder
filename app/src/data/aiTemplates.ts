import type { ArchitectureDocument, Integration, SystemNode } from '../types'
import type { DrawingElement } from '../types/diagram'

function stamp(doc: ArchitectureDocument): ArchitectureDocument {
  return {
    ...doc,
    metadata: { ...doc.metadata, updatedAt: new Date().toISOString() },
  }
}

function zone(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): DrawingElement {
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
  protocol: Integration['protocol'] = 'REST API',
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

const CHAT_API = `{
  "title": "Enterprise Copilot API",
  "version": "1.0.0",
  "baseUrl": "https://api.example.com/ai/v1",
  "description": "Grounded chat, retrieval, and feedback for the enterprise copilot",
  "specFormat": "simple",
  "endpoints": [
    { "method": "POST", "path": "/chat", "summary": "Turn-based grounded completion" },
    { "method": "POST", "path": "/retrieve", "summary": "Hybrid search over the knowledge index" },
    { "method": "POST", "path": "/feedback", "summary": "Thumbs / citation quality signal" }
  ]
}`

/** Enterprise RAG / GenAI copilot platform */
export function createEnterpriseRag(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'ai-users',
      type: 'diagram',
      label: 'Employees',
      category: 'Software Engineering',
      position: { x: 40, y: 100 },
      properties: { shape: 'c4-person', description: 'Internal users asking grounded questions in chat and apps' },
    },
    {
      id: 'ai-customers',
      type: 'diagram',
      label: 'Customers',
      category: 'Software Engineering',
      position: { x: 40, y: 280 },
      properties: { shape: 'c4-person', description: 'External users on the support copilot (restricted corpus)' },
    },
    {
      id: 'ai-copilot-studio',
      type: 'powerplatform',
      label: 'Copilot Studio',
      category: 'Power Platform',
      position: { x: 40, y: 460 },
      properties: {
        vendor: 'Microsoft Power Platform',
        service: 'Copilot Studio',
        color: '#5B2C6F',
        description: 'Low-code channel that calls the same enterprise orchestrator',
      },
    },
    {
      id: 'ai-chat',
      type: 'diagram',
      label: 'Copilot UI',
      category: 'Software Engineering',
      position: { x: 300, y: 80 },
      properties: {
        shape: 'c4-container',
        description: 'Web chat, citations, and conversation history',
        environment: 'Azure App Service',
      },
    },
    {
      id: 'ai-apim',
      type: 'azure',
      label: 'Azure API Management',
      category: 'Azure',
      position: { x: 300, y: 260 },
      properties: {
        vendor: 'Microsoft Azure',
        service: 'API Management',
        componentType: 'api',
        description: 'Auth, quota, and copilot API façade',
        interfaceSpec: CHAT_API,
      },
    },
    {
      id: 'ai-orchestrator',
      type: 'middleware',
      label: 'Prompt Orchestrator',
      category: 'Middleware',
      position: { x: 560, y: 80 },
      properties: {
        description: 'Routing, tool calls, retrieval, prompt assembly, and answer synthesis',
        environment: 'AKS',
      },
    },
    {
      id: 'ai-safety',
      type: 'azure',
      label: 'Content Safety',
      category: 'Azure',
      position: { x: 560, y: 260 },
      properties: {
        vendor: 'Microsoft Azure',
        color: '#be185d',
        description: 'Prompt/response filtering, jailbreak and PII screens',
      },
    },
    {
      id: 'ai-llm-gw',
      type: 'middleware',
      label: 'LLM Gateway',
      category: 'Middleware',
      position: { x: 560, y: 440 },
      properties: {
        description: 'Model router with failover, token budgets, and provider keys',
        environment: 'Cloud',
      },
      subDiagram: {
        name: 'LLM Gateway Internals',
        description: 'Multi-model routing behind a single completion contract',
        systems: [
          {
            id: 'ai-gw-router',
            type: 'diagram',
            label: 'Model Router',
            category: 'Software Engineering',
            position: { x: 80, y: 140 },
            properties: { shape: 'process', description: 'Pick model by task, latency, and cost' },
          },
          {
            id: 'ai-gw-xai',
            type: 'saas',
            label: 'SpaceXAI / Grok',
            category: 'SaaS',
            position: { x: 340, y: 40 },
            properties: { vendor: 'xAI', description: 'Primary reasoning and generation model' },
          },
          {
            id: 'ai-gw-aoai',
            type: 'azure',
            label: 'Azure OpenAI',
            category: 'Azure',
            position: { x: 340, y: 200 },
            properties: { vendor: 'Microsoft Azure', description: 'Enterprise GPT deployment in the tenant' },
          },
          {
            id: 'ai-gw-embed',
            type: 'cloud',
            label: 'Embedding Model',
            category: 'Cloud',
            position: { x: 340, y: 360 },
            properties: { description: 'Dedicated embedding endpoint for index and query' },
          },
          {
            id: 'ai-gw-meter',
            type: 'diagram',
            label: 'Token Meter',
            category: 'Software Engineering',
            position: { x: 80, y: 320 },
            properties: { shape: 'component', description: 'Per-app budgets, caching, and retry policy' },
          },
        ],
        integrations: [
          edge('ai-gw-int-xai', 'ai-gw-router', 'ai-gw-xai', 'Chat completions', 'REST API'),
          edge('ai-gw-int-aoai', 'ai-gw-router', 'ai-gw-aoai', 'Failover / GPT tasks', 'REST API'),
          edge('ai-gw-int-emb', 'ai-gw-router', 'ai-gw-embed', 'Embed query/doc', 'REST API'),
          edge('ai-gw-int-meter', 'ai-gw-router', 'ai-gw-meter', 'Count tokens', 'Custom'),
        ],
      },
    },
    {
      id: 'ai-embed',
      type: 'cloud',
      label: 'Embedding Service',
      category: 'Cloud',
      position: { x: 840, y: 60 },
      properties: { description: 'Chunk and embed documents and user queries' },
    },
    {
      id: 'ai-vector',
      type: 'database',
      label: 'Vector Index',
      category: 'Database',
      position: { x: 840, y: 220 },
      properties: { description: 'Hybrid (vector + keyword) retrieval store' },
    },
    {
      id: 'ai-indexer',
      type: 'azure',
      label: 'RAG Indexer',
      category: 'Azure',
      position: { x: 840, y: 380 },
      properties: {
        vendor: 'Microsoft Azure',
        service: 'Data Factory',
        description: 'Crawl, chunk, ACL stamp, and refresh the knowledge index',
      },
    },
    {
      id: 'ai-blob',
      type: 'azure',
      label: 'Azure Blob Storage',
      category: 'Azure',
      position: { x: 840, y: 540 },
      properties: {
        vendor: 'Microsoft Azure',
        service: 'Blob Storage',
        description: 'Canonical files, parsed text, and citation payloads',
      },
    },
    {
      id: 'ai-sharepoint',
      type: 'saas',
      label: 'SharePoint / Files',
      category: 'SaaS',
      position: { x: 1120, y: 60 },
      properties: { vendor: 'Microsoft', description: 'Policies, manuals, and approved knowledge' },
    },
    {
      id: 'ai-dataverse',
      type: 'powerplatform',
      label: 'Dataverse',
      category: 'Power Platform',
      position: { x: 1120, y: 220 },
      properties: {
        vendor: 'Microsoft Power Platform',
        service: 'Dataverse',
        color: '#0284C7',
        description: 'CRM and case records used as grounded facts',
      },
    },
    {
      id: 'ai-entra',
      type: 'azure',
      label: 'Microsoft Entra ID',
      category: 'Azure',
      position: { x: 1120, y: 380 },
      properties: {
        vendor: 'Microsoft Azure',
        service: 'Entra ID',
        description: 'User identity, app roles, and document ACLs on retrieve',
      },
    },
    {
      id: 'ai-obs',
      type: 'azure',
      label: 'Azure Monitor',
      category: 'Azure',
      position: { x: 1120, y: 540 },
      properties: {
        vendor: 'Microsoft Azure',
        service: 'Monitor',
        description: 'Traces, token cost, groundedness, and eval scores',
      },
    },
    {
      id: 'ai-note',
      type: 'note',
      label: 'Grounding rule',
      category: 'Drawing',
      position: { x: 300, y: 520 },
      properties: {
        content:
          'Answers must cite retrieved chunks. Strip secrets before the model. Enforce document ACLs at retrieve time, not only in the UI.',
      },
    },
  ]

  return stamp({
    metadata: {
      name: 'Enterprise RAG Copilot',
      description:
        'Sample GenAI architecture: channels and APIM in front of a prompt orchestrator, RAG index, multi-model LLM gateway, and identity-aware knowledge sources.',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('ai-int-emp-ui', 'ai-users', 'ai-chat', 'Chat session', 'REST API'),
      edge('ai-int-cust-api', 'ai-customers', 'ai-apim', 'Support copilot API', 'REST API'),
      edge('ai-int-studio', 'ai-copilot-studio', 'ai-apim', 'Low-code channel', 'REST API'),
      edge('ai-int-ui-api', 'ai-chat', 'ai-apim', 'Chat / retrieve / feedback', 'REST API'),
      edge('ai-int-api-orch', 'ai-apim', 'ai-orchestrator', 'Grounded completion', 'REST API'),
      edge('ai-int-orch-safe', 'ai-orchestrator', 'ai-safety', 'Screen prompt & answer', 'REST API'),
      edge('ai-int-orch-llm', 'ai-orchestrator', 'ai-llm-gw', 'Complete with tools', 'REST API'),
      edge('ai-int-orch-vec', 'ai-orchestrator', 'ai-vector', 'Hybrid retrieve', 'REST API'),
      edge('ai-int-query-emb', 'ai-orchestrator', 'ai-embed', 'Embed query', 'REST API'),
      edge('ai-int-idx-src', 'ai-sharepoint', 'ai-indexer', 'Crawl documents', 'REST API', {
        frequency: 'scheduled',
        direction: 'outbound',
      }),
      edge('ai-int-idx-crm', 'ai-dataverse', 'ai-indexer', 'Sync cases', 'REST API', { frequency: 'near-real-time' }),
      edge('ai-int-idx-blob', 'ai-indexer', 'ai-blob', 'Store parsed text', 'REST API', { frequency: 'batch' }),
      edge('ai-int-idx-emb', 'ai-indexer', 'ai-embed', 'Embed chunks', 'REST API', { frequency: 'batch' }),
      edge('ai-int-idx-vec', 'ai-indexer', 'ai-vector', 'Upsert vectors + ACLs', 'REST API', { frequency: 'batch' }),
      edge('ai-int-id-ui', 'ai-chat', 'ai-entra', 'Sign-in / token', 'REST API'),
      edge('ai-int-id-orch', 'ai-orchestrator', 'ai-entra', 'On-behalf-of retrieve', 'REST API'),
      edge('ai-int-obs', 'ai-orchestrator', 'ai-obs', 'Traces and evals', 'REST API', { frequency: 'near-real-time' }),
      edge('ai-int-obs-gw', 'ai-llm-gw', 'ai-obs', 'Token & latency', 'REST API', { frequency: 'near-real-time' }),
    ],
    drawings: [
      zone('ai-z-ch', 20, 40, 240, 560, '#ec4899'),
      label('ai-l-ch', 32, 52, 'Channels', '#9d174d'),
      zone('ai-z-exp', 280, 40, 240, 360, '#6366f1'),
      label('ai-l-exp', 292, 52, 'Experience', '#3730a3'),
      zone('ai-z-orch', 540, 40, 240, 540, '#8b5cf6'),
      label('ai-l-orch', 552, 52, 'Orchestration & models', '#5b21b6'),
      zone('ai-z-know', 820, 40, 240, 620, '#10b981'),
      label('ai-l-know', 832, 52, 'Knowledge & retrieval', '#047857'),
      zone('ai-z-src', 1100, 40, 240, 620, '#0ea5e9'),
      label('ai-l-src', 1112, 52, 'Sources · identity · ops', '#0369a1'),
    ],
  })
}

/** Cloud-agnostic MLOps / model lifecycle platform */
export function createMlOpsPlatform(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'ml-sources',
      type: 'database',
      label: 'Source Systems',
      category: 'Database',
      position: { x: 40, y: 160 },
      properties: { description: 'Operational DBs, files, and event streams used as training inputs' },
    },
    {
      id: 'ml-lake',
      type: 'database',
      label: 'Data Lake',
      category: 'Database',
      position: { x: 300, y: 80 },
      properties: { description: 'Curated bronze/silver/gold training and feature datasets' },
    },
    {
      id: 'ml-feat',
      type: 'database',
      label: 'Feature Store',
      category: 'Database',
      position: { x: 300, y: 280 },
      properties: { description: 'Offline training features and online low-latency serving' },
    },
    {
      id: 'ml-train',
      type: 'cloud',
      label: 'Training Cluster',
      category: 'Cloud',
      position: { x: 560, y: 80 },
      properties: { description: 'GPU/CPU jobs, hyperparameter search, and notebooks' },
    },
    {
      id: 'ml-exp',
      type: 'cloud',
      label: 'Experiment Tracking',
      category: 'Cloud',
      position: { x: 560, y: 280 },
      properties: { description: 'Runs, metrics, artifacts, and lineage' },
    },
    {
      id: 'ml-cicd',
      type: 'cloud',
      label: 'ML CI / CD',
      category: 'Infrastructure',
      position: { x: 560, y: 460 },
      properties: { description: 'Test, package, and promote models as versioned artifacts' },
    },
    {
      id: 'ml-registry',
      type: 'cloud',
      label: 'Model Registry',
      category: 'Cloud',
      position: { x: 820, y: 160 },
      properties: { description: 'Approved model versions, signatures, and stage (staging/prod)' },
    },
    {
      id: 'ml-online',
      type: 'diagram',
      label: 'Online Inference',
      category: 'Software Engineering',
      position: { x: 1080, y: 80 },
      properties: { shape: 'c4-container', componentType: 'api', description: 'Real-time predict API behind the gateway' },
    },
    {
      id: 'ml-batch',
      type: 'diagram',
      label: 'Batch Scoring',
      category: 'Software Engineering',
      position: { x: 1080, y: 240 },
      properties: { shape: 'process', description: 'Scheduled scoring onto the lake / warehouse' },
    },
    {
      id: 'ml-apps',
      type: 'saas',
      label: 'Consuming Apps',
      category: 'SaaS',
      position: { x: 1340, y: 80 },
      properties: { description: 'Digital channels and core systems calling predictions' },
    },
    {
      id: 'ml-monitor',
      type: 'cloud',
      label: 'Model Monitor',
      category: 'Infrastructure',
      position: { x: 1080, y: 420 },
      properties: { description: 'Drift, data quality, latency, and fairness alerts' },
    },
    {
      id: 'ml-note',
      type: 'note',
      label: 'Promotion gate',
      category: 'Drawing',
      position: { x: 820, y: 360 },
      properties: {
        content: 'Only registry “Production” versions are served. Retrain when drift or eval gates fail.',
      },
    },
  ]

  return stamp({
    metadata: {
      name: 'MLOps Platform',
      description:
        'Sample ML lifecycle: sources and lake into a feature store, training and experiments, registry, online/batch serving, and drift monitoring.',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('ml-int-src', 'ml-sources', 'ml-lake', 'Ingest', 'File Transfer', { frequency: 'batch', dataFormat: 'CSV' }),
      edge('ml-int-feat', 'ml-lake', 'ml-feat', 'Materialize features', 'ODBC/JDBC', { frequency: 'batch' }),
      edge('ml-int-train', 'ml-feat', 'ml-train', 'Offline training set', 'ODBC/JDBC', { frequency: 'batch' }),
      edge('ml-int-runs', 'ml-train', 'ml-exp', 'Log metrics', 'REST API'),
      edge('ml-int-reg', 'ml-exp', 'ml-registry', 'Register candidate', 'REST API', { frequency: 'event-driven' }),
      edge('ml-int-cd', 'ml-cicd', 'ml-registry', 'Promote version', 'REST API', { frequency: 'event-driven' }),
      edge('ml-int-online', 'ml-registry', 'ml-online', 'Deploy model', 'REST API', { frequency: 'event-driven' }),
      edge('ml-int-batch', 'ml-registry', 'ml-batch', 'Score job image', 'REST API', { frequency: 'scheduled' }),
      edge('ml-int-onfeat', 'ml-online', 'ml-feat', 'Online features', 'REST API'),
      edge('ml-int-apps', 'ml-apps', 'ml-online', 'Predict', 'REST API'),
      edge('ml-int-bscore', 'ml-batch', 'ml-lake', 'Write scores', 'File Transfer', { frequency: 'scheduled' }),
      edge('ml-int-mon1', 'ml-online', 'ml-monitor', 'Live telemetry', 'REST API', { frequency: 'near-real-time' }),
      edge('ml-int-mon2', 'ml-batch', 'ml-monitor', 'Batch data quality', 'REST API', { frequency: 'scheduled' }),
    ],
    drawings: [
      zone('ml-z-data', 20, 40, 500, 380, '#10b981'),
      label('ml-l-data', 32, 52, 'Data & features', '#047857'),
      zone('ml-z-train', 540, 40, 260, 540, '#6366f1'),
      label('ml-l-train', 552, 52, 'Train & promote', '#3730a3'),
      zone('ml-z-reg', 820, 40, 220, 280, '#8b5cf6'),
      label('ml-l-reg', 832, 52, 'Registry', '#5b21b6'),
      zone('ml-z-serve', 1060, 40, 500, 320, '#0ea5e9'),
      label('ml-l-serve', 1072, 52, 'Serve', '#0369a1'),
      zone('ml-z-ops', 1060, 380, 240, 200, '#f59e0b'),
      label('ml-l-ops', 1072, 392, 'Observe', '#b45309'),
    ],
  })
}

/** Agentic AI runtime with tools, memory, and human approval */
export function createAgenticAi(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'ag-user',
      type: 'diagram',
      label: 'Knowledge Worker',
      category: 'Software Engineering',
      position: { x: 40, y: 200 },
      properties: { shape: 'c4-person', description: 'Asks the agent to complete a multi-step task' },
    },
    {
      id: 'ag-ui',
      type: 'diagram',
      label: 'Agent Workbench',
      category: 'Software Engineering',
      position: { x: 300, y: 200 },
      properties: { shape: 'c4-container', description: 'Task UI, traces, and approval inbox' },
    },
    {
      id: 'ag-runtime',
      type: 'middleware',
      label: 'Agent Runtime',
      category: 'Middleware',
      position: { x: 560, y: 80 },
      properties: { description: 'Planner, executor, and policy loop for multi-step goals' },
      subDiagram: {
        name: 'Agent Runtime Internals',
        description: 'Plan → act → observe loop with policy checks',
        systems: [
          {
            id: 'ag-sub-planner',
            type: 'diagram',
            label: 'Planner',
            category: 'Software Engineering',
            position: { x: 80, y: 120 },
            properties: { shape: 'process', description: 'Decompose goal into tool-using steps' },
          },
          {
            id: 'ag-sub-exec',
            type: 'diagram',
            label: 'Executor',
            category: 'Software Engineering',
            position: { x: 300, y: 120 },
            properties: { shape: 'component', description: 'Call tools and write observations' },
          },
          {
            id: 'ag-sub-policy',
            type: 'diagram',
            label: 'Policy Guard',
            category: 'Software Engineering',
            position: { x: 300, y: 300 },
            properties: { shape: 'decision', description: 'Allow, deny, or escalate to a human' },
          },
        ],
        integrations: [
          edge('ag-sub-plan', 'ag-sub-planner', 'ag-sub-exec', 'Next action', 'Custom'),
          edge('ag-sub-pol', 'ag-sub-exec', 'ag-sub-policy', 'Authorize tool', 'Custom'),
          edge('ag-sub-back', 'ag-sub-exec', 'ag-sub-planner', 'Observation', 'Custom', { direction: 'inbound' }),
        ],
      },
    },
    {
      id: 'ag-llm',
      type: 'saas',
      label: 'LLM Gateway',
      category: 'SaaS',
      position: { x: 560, y: 280 },
      properties: { vendor: 'xAI', description: 'Reasoning model for plan and synthesis' },
    },
    {
      id: 'ag-hitl',
      type: 'diagram',
      label: 'Human Approval',
      category: 'Software Engineering',
      position: { x: 560, y: 440 },
      properties: { shape: 'actor', description: 'Required for write actions and spend over policy' },
    },
    {
      id: 'ag-tools',
      type: 'middleware',
      label: 'MCP / Tool Gateway',
      category: 'Middleware',
      position: { x: 840, y: 80 },
      properties: {
        componentType: 'api',
        description: 'Catalog of MCP servers and enterprise tools with auth scopes',
      },
    },
    {
      id: 'ag-apis',
      type: 'cloud',
      label: 'Enterprise APIs',
      category: 'Cloud',
      position: { x: 1100, y: 80 },
      properties: { componentType: 'api', description: 'CRM, ITSM, ERP, and internal HTTP APIs' },
    },
    {
      id: 'ag-search',
      type: 'database',
      label: 'Knowledge Search',
      category: 'Database',
      position: { x: 1100, y: 240 },
      properties: { description: 'RAG / intranet search used as a read tool' },
    },
    {
      id: 'ag-memory',
      type: 'database',
      label: 'Agent Memory',
      category: 'Database',
      position: { x: 840, y: 280 },
      properties: { description: 'Short-term thread state and long-term task memory' },
    },
    {
      id: 'ag-audit',
      type: 'cloud',
      label: 'Audit & Traces',
      category: 'Infrastructure',
      position: { x: 840, y: 440 },
      properties: { description: 'Tool calls, prompts, decisions, and human overrides' },
    },
    {
      id: 'ag-note',
      type: 'note',
      label: 'Tool policy',
      category: 'Drawing',
      position: { x: 1100, y: 400 },
      properties: {
        content: 'Read tools auto-run. Write / payment / delete tools require Human Approval. Log every tool call.',
      },
    },
  ]

  return stamp({
    metadata: {
      name: 'Agentic AI Runtime',
      description:
        'Sample agent architecture: workbench, planner/executor runtime, MCP tool gateway, enterprise APIs, memory, LLM, and human-in-the-loop.',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('ag-int-ui', 'ag-user', 'ag-ui', 'Goal / follow-up', 'REST API'),
      edge('ag-int-run', 'ag-ui', 'ag-runtime', 'Start / resume task', 'REST API'),
      edge('ag-int-llm', 'ag-runtime', 'ag-llm', 'Plan & synthesize', 'REST API'),
      edge('ag-int-tools', 'ag-runtime', 'ag-tools', 'Invoke tool', 'REST API'),
      edge('ag-int-hitl', 'ag-runtime', 'ag-hitl', 'Escalate write action', 'Webhook', { frequency: 'event-driven' }),
      edge('ag-int-mem', 'ag-runtime', 'ag-memory', 'Read/write state', 'REST API', { direction: 'bidirectional' }),
      edge('ag-int-api', 'ag-tools', 'ag-apis', 'Scoped API call', 'REST API'),
      edge('ag-int-search', 'ag-tools', 'ag-search', 'Retrieve context', 'REST API'),
      edge('ag-int-audit', 'ag-runtime', 'ag-audit', 'Trace step', 'REST API', { frequency: 'near-real-time' }),
      edge('ag-int-tool-audit', 'ag-tools', 'ag-audit', 'Tool audit', 'REST API', { frequency: 'near-real-time' }),
    ],
    drawings: [
      zone('ag-z-ch', 20, 40, 500, 360, '#ec4899'),
      label('ag-l-ch', 32, 52, 'User experience', '#9d174d'),
      zone('ag-z-rt', 540, 40, 260, 540, '#8b5cf6'),
      label('ag-l-rt', 552, 52, 'Agent runtime', '#5b21b6'),
      zone('ag-z-tools', 820, 40, 500, 220, '#6366f1'),
      label('ag-l-tools', 832, 52, 'Tools', '#3730a3'),
      zone('ag-z-mem', 820, 260, 240, 160, '#10b981'),
      label('ag-l-mem', 832, 272, 'Memory', '#047857'),
      zone('ag-z-gov', 820, 420, 240, 160, '#f59e0b'),
      label('ag-l-gov', 832, 432, 'Governance', '#b45309'),
    ],
  })
}

/** Azure AI Foundry / Azure OpenAI landing zone style sample */
export function createAzureAiLanding(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'azai-users',
      type: 'diagram',
      label: 'Users / Apps',
      category: 'Software Engineering',
      position: { x: 40, y: 200 },
      properties: { shape: 'c4-person', description: 'Employees and line-of-business applications' },
    },
    {
      id: 'azai-fd',
      type: 'azure',
      label: 'Azure Front Door',
      category: 'Azure',
      position: { x: 300, y: 80 },
      properties: { vendor: 'Microsoft Azure', service: 'Front Door', description: 'Global entry, TLS, and WAF' },
    },
    {
      id: 'azai-apim',
      type: 'azure',
      label: 'Azure API Management',
      category: 'Azure',
      position: { x: 300, y: 260 },
      properties: {
        vendor: 'Microsoft Azure',
        service: 'API Management',
        componentType: 'api',
        description: 'Subscription keys, quotas, and AI API products',
        interfaceSpec: CHAT_API,
      },
    },
    {
      id: 'azai-studio',
      type: 'powerplatform',
      label: 'Copilot Studio',
      category: 'Power Platform',
      position: { x: 300, y: 440 },
      properties: {
        vendor: 'Microsoft Power Platform',
        service: 'Copilot Studio',
        color: '#5B2C6F',
        description: 'Maker-built copilots calling Azure AI backends',
      },
    },
    {
      id: 'azai-foundry',
      type: 'azure',
      label: 'Azure AI Foundry',
      category: 'Azure',
      position: { x: 580, y: 160 },
      properties: {
        vendor: 'Microsoft Azure',
        description: 'Prompt flow, evaluations, and project hub',
      },
    },
    {
      id: 'azai-aoai',
      type: 'azure',
      label: 'Azure OpenAI',
      category: 'Azure',
      position: { x: 580, y: 340 },
      properties: {
        vendor: 'Microsoft Azure',
        description: 'GPT / embedding deployments in the tenant',
      },
    },
    {
      id: 'azai-safety',
      type: 'azure',
      label: 'Azure AI Content Safety',
      category: 'Azure',
      position: { x: 580, y: 500 },
      properties: { vendor: 'Microsoft Azure', color: '#be185d', description: 'Input and output filters' },
    },
    {
      id: 'azai-search',
      type: 'azure',
      label: 'Azure AI Search',
      category: 'Azure',
      position: { x: 860, y: 80 },
      properties: {
        vendor: 'Microsoft Azure',
        description: 'Vector + semantic retrieval for RAG',
      },
    },
    {
      id: 'azai-docint',
      type: 'azure',
      label: 'Document Intelligence',
      category: 'Azure',
      position: { x: 860, y: 240 },
      properties: { vendor: 'Microsoft Azure', description: 'OCR and structured extraction for ingest' },
    },
    {
      id: 'azai-blob',
      type: 'azure',
      label: 'Azure Blob Storage',
      category: 'Azure',
      position: { x: 860, y: 400 },
      properties: { vendor: 'Microsoft Azure', service: 'Blob Storage', description: 'Corpus, parsed text, and eval sets' },
    },
    {
      id: 'azai-kv',
      type: 'azure',
      label: 'Azure Key Vault',
      category: 'Azure',
      position: { x: 1120, y: 160 },
      properties: { vendor: 'Microsoft Azure', service: 'Key Vault', description: 'Model keys and connection secrets' },
    },
    {
      id: 'azai-entra',
      type: 'azure',
      label: 'Microsoft Entra ID',
      category: 'Azure',
      position: { x: 1120, y: 320 },
      properties: { vendor: 'Microsoft Azure', service: 'Entra ID', description: 'User and managed-identity access' },
    },
    {
      id: 'azai-mon',
      type: 'azure',
      label: 'Azure Monitor',
      category: 'Azure',
      position: { x: 1120, y: 480 },
      properties: { vendor: 'Microsoft Azure', service: 'Monitor', description: 'Token use, latency, content-safety hits' },
    },
  ]

  return stamp({
    metadata: {
      name: 'Azure AI Landing Zone',
      description:
        'Sample Azure AI platform: Front Door and APIM in front of AI Foundry, Azure OpenAI, AI Search, Document Intelligence, Content Safety, Key Vault, and Entra ID.',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('azai-int-fd', 'azai-users', 'azai-fd', 'HTTPS', 'REST API'),
      edge('azai-int-apim', 'azai-fd', 'azai-apim', 'API product', 'REST API'),
      edge('azai-int-studio', 'azai-studio', 'azai-apim', 'Copilot actions', 'REST API'),
      edge('azai-int-foundry', 'azai-apim', 'azai-foundry', 'Prompt flow', 'REST API'),
      edge('azai-int-aoai', 'azai-foundry', 'azai-aoai', 'Completions / embeddings', 'REST API'),
      edge('azai-int-safe', 'azai-foundry', 'azai-safety', 'Screen I/O', 'REST API'),
      edge('azai-int-search', 'azai-foundry', 'azai-search', 'Retrieve', 'REST API'),
      edge('azai-int-doc', 'azai-blob', 'azai-docint', 'Extract', 'REST API', { frequency: 'batch' }),
      edge('azai-int-index', 'azai-docint', 'azai-search', 'Index documents', 'REST API', { frequency: 'batch' }),
      edge('azai-int-blob', 'azai-foundry', 'azai-blob', 'Eval / files', 'REST API'),
      edge('azai-int-kv', 'azai-foundry', 'azai-kv', 'Fetch secrets', 'REST API'),
      edge('azai-int-id', 'azai-users', 'azai-entra', 'Authenticate', 'REST API'),
      edge('azai-int-id2', 'azai-foundry', 'azai-entra', 'Managed identity', 'REST API'),
      edge('azai-int-mon', 'azai-foundry', 'azai-mon', 'Telemetry', 'REST API', { frequency: 'near-real-time' }),
      edge('azai-int-mon2', 'azai-aoai', 'azai-mon', 'Token metrics', 'REST API', { frequency: 'near-real-time' }),
    ],
    drawings: [
      zone('azai-z-edge', 280, 40, 240, 540, '#0078d4'),
      label('azai-l-edge', 292, 52, 'Edge & channels', '#0c4a6e'),
      zone('azai-z-ai', 560, 40, 240, 600, '#8b5cf6'),
      label('azai-l-ai', 572, 52, 'Azure AI platform', '#5b21b6'),
      zone('azai-z-data', 840, 40, 240, 500, '#10b981'),
      label('azai-l-data', 852, 52, 'Knowledge', '#047857'),
      zone('azai-z-sec', 1100, 40, 250, 580, '#f59e0b'),
      label('azai-l-sec', 1112, 52, 'Identity · secrets · ops', '#b45309'),
    ],
  })
}

/** End-to-end SDLC with specialized AI agents and human gates */
export function createSdlcAiAgents(): ArchitectureDocument {
  const git = {
    gitProvider: 'github',
    gitRepo: 'contoso/product-platform',
    gitBranch: 'main',
  }

  const systems: SystemNode[] = [
    {
      id: 'sdlc-po',
      type: 'diagram',
      label: 'Product Owner',
      category: 'Software Engineering',
      position: { x: 48, y: 24 },
      properties: { shape: 'c4-person', description: 'Owns outcomes, backlog, and production go/no-go' },
    },
    {
      id: 'sdlc-eng',
      type: 'diagram',
      label: 'Engineer / Architect',
      category: 'Software Engineering',
      position: { x: 280, y: 24 },
      properties: { shape: 'c4-person', description: 'Reviews agent work, merges code, and approves architecture' },
    },

    {
      id: 'sdlc-z-intake',
      type: 'group',
      label: '1. Intake',
      category: 'Drawing',
      position: { x: 24, y: 120 },
      properties: { zone: 'Intake', color: '#8b5cf6', width: '232', height: '380' },
    },
    {
      id: 'sdlc-z-design',
      type: 'group',
      label: '2. Design',
      category: 'Drawing',
      position: { x: 272, y: 120 },
      properties: { zone: 'Design', color: '#6366f1', width: '232', height: '380' },
    },
    {
      id: 'sdlc-z-build',
      type: 'group',
      label: '3. Build',
      category: 'Drawing',
      position: { x: 520, y: 120 },
      properties: { zone: 'Build', color: '#0ea5e9', width: '232', height: '380' },
    },
    {
      id: 'sdlc-z-verify',
      type: 'group',
      label: '4. Verify',
      category: 'Drawing',
      position: { x: 768, y: 120 },
      properties: { zone: 'Verify', color: '#10b981', width: '232', height: '380' },
    },
    {
      id: 'sdlc-z-release',
      type: 'group',
      label: '5. Release',
      category: 'Drawing',
      position: { x: 1016, y: 120 },
      properties: { zone: 'Release', color: '#f59e0b', width: '232', height: '380' },
    },
    {
      id: 'sdlc-z-operate',
      type: 'group',
      label: '6. Operate',
      category: 'Drawing',
      position: { x: 1264, y: 120 },
      properties: { zone: 'Operate', color: '#ef4444', width: '232', height: '380' },
    },

    {
      id: 'sdlc-backlog',
      type: 'saas',
      label: 'Backlog / ADO',
      category: 'SaaS',
      position: { x: 48, y: 180 },
      properties: {
        vendor: 'Microsoft Azure',
        service: 'Azure DevOps',
        description: 'Epics, features, and work items that start the SDLC',
        adoProject: 'product-platform',
      },
    },
    {
      id: 'sdlc-product-agent',
      type: 'cloud',
      label: 'Product Agent',
      category: 'AI',
      position: { x: 48, y: 340 },
      properties: {
        vendor: 'xAI',
        description: 'Turns outcomes into stories, acceptance criteria, and a feature definition',
        changeStatus: 'new',
      },
    },

    {
      id: 'sdlc-avb',
      type: 'diagram',
      label: 'Architecture Visual Builder',
      category: 'Software Engineering',
      position: { x: 296, y: 180 },
      properties: {
        shape: 'c4-container',
        description: 'Current vs future architecture, new/update marks, and Feature & apply',
        ...git,
        gitPath: 'architecture',
      },
    },
    {
      id: 'sdlc-arch-agent',
      type: 'cloud',
      label: 'Architecture Agent',
      category: 'AI',
      position: { x: 296, y: 340 },
      properties: {
        vendor: 'xAI',
        description: 'Proposes target architecture, marks new vs update, and drafts the feature definition',
        changeStatus: 'new',
        ...git,
        gitPath: 'architecture',
      },
    },

    {
      id: 'sdlc-git',
      type: 'cloud',
      label: 'Git / GitHub',
      category: 'Infrastructure',
      position: { x: 544, y: 180 },
      properties: {
        description: 'Source of truth for application and IaC',
        ...git,
        gitPath: 'src',
      },
    },
    {
      id: 'sdlc-vscode',
      type: 'diagram',
      label: 'VS Code / IDE',
      category: 'Software Engineering',
      position: { x: 544, y: 280 },
      properties: {
        shape: 'component',
        description: 'Human and coding-agent workspace linked to Feature & apply',
        ...git,
        gitPath: 'src',
      },
    },
    {
      id: 'sdlc-code-agent',
      type: 'cloud',
      label: 'Coding Agent',
      category: 'AI',
      position: { x: 544, y: 400 },
      properties: {
        vendor: 'xAI',
        description: 'Implements scoped code changes from a Feature & apply instruction',
        changeStatus: 'new',
        ...git,
        gitPath: 'src',
      },
    },

    {
      id: 'sdlc-ci',
      type: 'cloud',
      label: 'CI Pipeline',
      category: 'Infrastructure',
      position: { x: 792, y: 180 },
      properties: {
        description: 'Build, unit test, and quality gates on every pull request',
        changeStatus: 'modified',
        ...git,
        gitPath: '.github/workflows',
      },
    },
    {
      id: 'sdlc-review-agent',
      type: 'cloud',
      label: 'Review Agent',
      category: 'AI',
      position: { x: 792, y: 300 },
      properties: {
        vendor: 'xAI',
        description: 'PR review for correctness, tests, and architecture fit',
        changeStatus: 'new',
        ...git,
        gitPath: 'src',
      },
    },
    {
      id: 'sdlc-test-agent',
      type: 'cloud',
      label: 'Test Agent',
      category: 'AI',
      position: { x: 792, y: 400 },
      properties: {
        vendor: 'xAI',
        description: 'Generates and runs tests against acceptance criteria',
        changeStatus: 'new',
        ...git,
        gitPath: 'tests',
      },
    },

    {
      id: 'sdlc-registry',
      type: 'cloud',
      label: 'Artifact Registry',
      category: 'Infrastructure',
      position: { x: 1040, y: 180 },
      properties: { description: 'Images, packages, and signed build outputs' },
    },
    {
      id: 'sdlc-cd',
      type: 'cloud',
      label: 'CD / Environments',
      category: 'Infrastructure',
      position: { x: 1040, y: 280 },
      properties: {
        description: 'Dev → test → prod with approvals',
        changeStatus: 'modified',
        ...git,
        gitPath: 'deploy',
      },
    },
    {
      id: 'sdlc-release-agent',
      type: 'cloud',
      label: 'Release Agent',
      category: 'AI',
      position: { x: 1040, y: 400 },
      properties: {
        vendor: 'xAI',
        description: 'Prepares release notes, checks gates, and drafts prod promotion',
        changeStatus: 'new',
        ...git,
        gitPath: 'deploy',
      },
    },

    {
      id: 'sdlc-obs',
      type: 'cloud',
      label: 'Observability',
      category: 'Infrastructure',
      position: { x: 1288, y: 180 },
      properties: { description: 'Logs, traces, metrics, and SLO burn' },
    },
    {
      id: 'sdlc-prod',
      type: 'cloud',
      label: 'Production App',
      category: 'Cloud',
      position: { x: 1288, y: 280 },
      properties: { description: 'Running workload that receives the SDLC output' },
    },
    {
      id: 'sdlc-sre-agent',
      type: 'cloud',
      label: 'SRE / Incident Agent',
      category: 'AI',
      position: { x: 1288, y: 400 },
      properties: {
        vendor: 'xAI',
        description: 'Triages incidents and opens follow-up work on the backlog',
        changeStatus: 'new',
      },
    },

    {
      id: 'sdlc-hitl',
      type: 'diagram',
      label: 'Human gates',
      category: 'Software Engineering',
      position: { x: 792, y: 24 },
      properties: {
        shape: 'decision',
        description: 'Required on architecture sign-off, merge, and production deploy',
      },
    },

    {
      id: 'sdlc-orch',
      type: 'middleware',
      label: 'SDLC Agent Orchestrator',
      category: 'Middleware',
      position: { x: 544, y: 540 },
      properties: {
        componentType: 'api',
        description: 'Routes Feature & apply work to the right stage agent with policy',
        changeStatus: 'new',
        ...git,
        gitPath: 'agents/orchestrator',
      },
      subDiagram: {
        name: 'SDLC agent runtime',
        description: 'Stage router, workers, and policy for coding-agent jobs',
        systems: [
          {
            id: 'sdlc-sub-router',
            type: 'diagram',
            label: 'Stage router',
            category: 'Software Engineering',
            position: { x: 80, y: 140 },
            properties: { shape: 'process', description: 'Map feature tasks to intake, design, code, test, release' },
          },
          {
            id: 'sdlc-sub-worker',
            type: 'diagram',
            label: 'Agent worker',
            category: 'Software Engineering',
            position: { x: 320, y: 80 },
            properties: { shape: 'component', description: 'Run one scoped instruction against a git path' },
          },
          {
            id: 'sdlc-sub-policy',
            type: 'diagram',
            label: 'Policy / HITL',
            category: 'Software Engineering',
            position: { x: 320, y: 240 },
            properties: { shape: 'decision', description: 'Block merge and prod without human approval' },
          },
        ],
        integrations: [
          edge('sdlc-sub-r-w', 'sdlc-sub-router', 'sdlc-sub-worker', 'Dispatch job', 'Custom'),
          edge('sdlc-sub-w-p', 'sdlc-sub-worker', 'sdlc-sub-policy', 'Authorize write', 'Custom'),
        ],
      },
    },
    {
      id: 'sdlc-llm',
      type: 'saas',
      label: 'LLM Gateway',
      category: 'SaaS',
      position: { x: 296, y: 540 },
      properties: { vendor: 'xAI', description: 'SpaceXAI / Azure OpenAI models used by every SDLC agent' },
    },
    {
      id: 'sdlc-mcp',
      type: 'middleware',
      label: 'MCP / Tool Gateway',
      category: 'Middleware',
      position: { x: 792, y: 540 },
      properties: {
        componentType: 'api',
        description: 'Git, CI, test, deploy, backlog, and Architecture Visual Builder tools',
        changeStatus: 'new',
      },
    },
    {
      id: 'sdlc-memory',
      type: 'database',
      label: 'Agent memory & traces',
      category: 'Database',
      position: { x: 1040, y: 540 },
      properties: { description: 'Feature packs, apply instructions, and audit of agent runs' },
    },
    {
      id: 'sdlc-id',
      type: 'cloud',
      label: 'Identity / Entra',
      category: 'Infrastructure',
      position: { x: 48, y: 540 },
      properties: { vendor: 'Microsoft Azure', description: 'Human and agent identities, PR and deploy RBAC' },
    },
    {
      id: 'sdlc-note',
      type: 'note',
      label: 'How to use',
      category: 'Drawing',
      position: { x: 1288, y: 540 },
      properties: {
        width: '220',
        height: '140',
        content:
          'Mark new vs update on the canvas, open the Feature & apply sub-tab, Generate instructions, then Apply to run coding agents in VS Code.',
      },
    },
  ]

  const now = new Date().toISOString()

  return stamp({
    metadata: {
      name: 'SDLC with AI Agents',
      description:
        'Comprehensive software delivery lifecycle: intake → design → build → verify → release → operate, each with a specialized AI agent, human gates, and Feature & apply work instructions.',
      version: '1.0.0',
      updatedAt: now,
    },
    systems,
    integrations: [
      edge('sdlc-i-po-bl', 'sdlc-po', 'sdlc-backlog', 'Outcome / feature', 'REST API'),
      edge('sdlc-i-po-hitl', 'sdlc-po', 'sdlc-hitl', 'Prod go/no-go', 'Custom', { frequency: 'event-driven' }),
      edge('sdlc-i-eng-avb', 'sdlc-eng', 'sdlc-avb', 'Edit architecture', 'Custom'),
      edge('sdlc-i-eng-vs', 'sdlc-eng', 'sdlc-vscode', 'Review / merge', 'Custom'),
      edge('sdlc-i-eng-hitl', 'sdlc-eng', 'sdlc-hitl', 'Approve merge', 'Custom', { frequency: 'event-driven' }),

      edge('sdlc-i-bl-prod', 'sdlc-backlog', 'sdlc-product-agent', 'Draft stories', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-prod-avb', 'sdlc-product-agent', 'sdlc-avb', 'Feature definition', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-avb-arch', 'sdlc-avb', 'sdlc-arch-agent', 'Propose to-be design', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-arch-avb', 'sdlc-arch-agent', 'sdlc-avb', 'New vs update marks', 'REST API', {
        changeStatus: 'new',
        direction: 'inbound',
      }),

      edge('sdlc-i-avb-orch', 'sdlc-avb', 'sdlc-orch', 'Apply work pack', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-orch-code', 'sdlc-orch', 'sdlc-code-agent', 'Coding job', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-code-git', 'sdlc-code-agent', 'sdlc-git', 'Commit / PR', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-vs-git', 'sdlc-vscode', 'sdlc-git', 'Push / pull', 'REST API', { direction: 'bidirectional' }),
      edge('sdlc-i-git-ci', 'sdlc-git', 'sdlc-ci', 'PR webhook', 'Webhook', { frequency: 'event-driven' }),

      edge('sdlc-i-orch-rev', 'sdlc-orch', 'sdlc-review-agent', 'Review job', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-rev-git', 'sdlc-review-agent', 'sdlc-git', 'PR comments', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-orch-test', 'sdlc-orch', 'sdlc-test-agent', 'Test job', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-test-ci', 'sdlc-test-agent', 'sdlc-ci', 'Test results', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-ci-hitl', 'sdlc-ci', 'sdlc-hitl', 'Merge gate', 'Webhook', { frequency: 'event-driven' }),

      edge('sdlc-i-ci-reg', 'sdlc-ci', 'sdlc-registry', 'Publish artifact', 'REST API'),
      edge('sdlc-i-reg-cd', 'sdlc-registry', 'sdlc-cd', 'Promote image', 'REST API'),
      edge('sdlc-i-orch-rel', 'sdlc-orch', 'sdlc-release-agent', 'Release job', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-rel-cd', 'sdlc-release-agent', 'sdlc-cd', 'Draft promotion', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-cd-hitl', 'sdlc-cd', 'sdlc-hitl', 'Prod approval', 'Webhook', { frequency: 'event-driven' }),
      edge('sdlc-i-cd-prod', 'sdlc-cd', 'sdlc-prod', 'Deploy', 'REST API'),

      edge('sdlc-i-prod-obs', 'sdlc-prod', 'sdlc-obs', 'Telemetry', 'REST API'),
      edge('sdlc-i-obs-sre', 'sdlc-obs', 'sdlc-sre-agent', 'Alert / SLO burn', 'Webhook', {
        frequency: 'event-driven',
        changeStatus: 'new',
      }),
      edge('sdlc-i-sre-bl', 'sdlc-sre-agent', 'sdlc-backlog', 'Open follow-up', 'REST API', { changeStatus: 'new' }),

      edge('sdlc-i-id-orch', 'sdlc-id', 'sdlc-orch', 'Agent identity', 'REST API'),
      edge('sdlc-i-llm-orch', 'sdlc-orch', 'sdlc-llm', 'Plan & generate', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-orch-mcp', 'sdlc-orch', 'sdlc-mcp', 'Tool call', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-mcp-git', 'sdlc-mcp', 'sdlc-git', 'Repo tools', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-mcp-ci', 'sdlc-mcp', 'sdlc-ci', 'Pipeline tools', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-mcp-avb', 'sdlc-mcp', 'sdlc-avb', 'Architecture tools', 'REST API', { changeStatus: 'new' }),
      edge('sdlc-i-orch-mem', 'sdlc-orch', 'sdlc-memory', 'Store apply pack', 'REST API', {
        changeStatus: 'new',
        direction: 'bidirectional',
      }),
    ],
    changeDesigns: [
      {
        id: 'design-sdlc-ai-agents',
        title: 'Embed AI agents in the SDLC',
        definition:
          'Add specialized AI agents for product, architecture, coding, review, test, release, and incidents. Humans keep merge and production gates. Feature & apply turns canvas new/update marks into scoped coding-agent jobs.',
        problem:
          'Design, code, review, and test are manual and sequential, so delivery lags and architecture drift is common.',
        proposedChange:
          'New: Architecture, Coding, Review, Test, Release, and SRE agents, plus the orchestrator and MCP gateway.\nUpdate: CI Pipeline and CD / Environments invoke those agents and keep human gates on merge and production.',
        acceptanceCriteria:
          'Each new agent has a git path; Generate produces a NEW or UPDATE instruction; Apply runs in VS Code without touching unrelated services; prod deploy still requires a human gate.',
        status: 'ready',
        createdAt: now,
        updatedAt: now,
        tasks: [
          {
            id: 'task-arch-agent',
            systemId: 'sdlc-arch-agent',
            systemLabel: 'Architecture Agent',
            changeKind: 'new',
            intent: 'Create the architecture agent that reads the canvas, marks new vs update, and drafts the feature definition.',
            status: 'pending',
          },
          {
            id: 'task-code-agent',
            systemId: 'sdlc-code-agent',
            systemLabel: 'Coding Agent',
            changeKind: 'new',
            intent: 'Create the coding agent that implements one Feature & apply instruction against src/ only.',
            status: 'pending',
          },
          {
            id: 'task-review-agent',
            systemId: 'sdlc-review-agent',
            systemLabel: 'Review Agent',
            changeKind: 'new',
            intent: 'Create the PR review agent that checks architecture fit, tests, and policy before merge.',
            status: 'pending',
          },
          {
            id: 'task-test-agent',
            systemId: 'sdlc-test-agent',
            systemLabel: 'Test Agent',
            changeKind: 'new',
            intent: 'Create the test agent that generates and runs tests from acceptance criteria in tests/.',
            status: 'pending',
          },
          {
            id: 'task-release-agent',
            systemId: 'sdlc-release-agent',
            systemLabel: 'Release Agent',
            changeKind: 'new',
            intent: 'Create the release agent that drafts promotions and never skips the prod human gate.',
            status: 'pending',
          },
          {
            id: 'task-ci',
            systemId: 'sdlc-ci',
            systemLabel: 'CI Pipeline',
            changeKind: 'update',
            intent: 'Update CI workflows to invoke review and test agents on each PR and fail the merge gate on policy deny.',
            status: 'pending',
          },
          {
            id: 'task-cd',
            systemId: 'sdlc-cd',
            systemLabel: 'CD / Environments',
            changeKind: 'update',
            intent: 'Update CD so the release agent can draft promotions while production still requires human approval.',
            status: 'pending',
          },
          {
            id: 'task-orch',
            systemId: 'sdlc-orch',
            systemLabel: 'SDLC Agent Orchestrator',
            changeKind: 'new',
            intent: 'Create the orchestrator that turns a Feature & apply pack into stage jobs with identity and audit.',
            status: 'pending',
          },
        ],
      },
    ],
  })
}

/** Multi-provider AI Agent orchestration */
export function createMultiProviderAgents(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'agent-user',
      type: 'diagram',
      label: 'User / App',
      category: 'Software Engineering',
      position: { x: 40, y: 200 },
      properties: { shape: 'c4-person', description: 'Interacts with AI agents' },
    },
    {
      id: 'agent-gateway',
      type: 'cloud',
      label: 'Agent Gateway',
      category: 'Cloud',
      position: { x: 300, y: 200 },
      properties: { componentType: 'api', description: 'Unified provider abstraction layer' },
    },
    {
      id: 'agent-grok',
      type: 'cloud',
      label: 'Grok Agent',
      category: 'AI',
      position: { x: 560, y: 80 },
      properties: {
        vendor: 'xAI',
        service: 'Grok',
        description: 'SpaceXAI reasoning and planning agent',
        icon: 'GrokAgentIcon',
      },
    },
    {
      id: 'agent-gemini',
      type: 'cloud',
      label: 'Gemini Agent',
      category: 'AI',
      position: { x: 560, y: 200 },
      properties: {
        vendor: 'Google',
        service: 'Gemini',
        description: 'Google Gemini multimodal agent',
        icon: 'GeminiAgentIcon',
      },
    },
    {
      id: 'agent-copilot',
      type: 'cloud',
      label: 'Copilot Agent',
      category: 'AI',
      position: { x: 560, y: 320 },
      properties: {
        vendor: 'Microsoft',
        service: 'Azure OpenAI',
        description: 'Azure OpenAI GPT agent for enterprise workflows',
        icon: 'CopilotAgentIcon',
      },
    },
    {
      id: 'agent-memory',
      type: 'database',
      label: 'Agent Memory',
      category: 'Database',
      position: { x: 840, y: 200 },
      properties: { description: 'Conversation state and tool results cache' },
    },
    {
      id: 'agent-tools',
      type: 'middleware',
      label: 'Tool / MCP Gateway',
      category: 'Middleware',
      position: { x: 1100, y: 200 },
      properties: { componentType: 'api', description: 'Orchestrates agent tool calls' },
    },
  ]

  return stamp({
    metadata: {
      name: 'Multi-Provider AI Agents',
      description: 'Flexible architecture supporting Grok, Gemini, and Azure OpenAI agents with shared memory and tools.',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('ag-int-req', 'agent-user', 'agent-gateway', 'Query / task', 'REST API'),
      edge('ag-int-grok', 'agent-gateway', 'agent-grok', 'Route to Grok', 'REST API'),
      edge('ag-int-gemini', 'agent-gateway', 'agent-gemini', 'Route to Gemini', 'REST API'),
      edge('ag-int-copilot', 'agent-gateway', 'agent-copilot', 'Route to Copilot', 'REST API'),
      edge('ag-int-mem-read', 'agent-grok', 'agent-memory', 'Read context', 'REST API'),
      edge('ag-int-mem-write', 'agent-grok', 'agent-memory', 'Write state', 'REST API', { direction: 'bidirectional' }),
      edge('ag-int-tools', 'agent-grok', 'agent-tools', 'Invoke tools', 'REST API'),
      edge('ag-int-resp', 'agent-grok', 'agent-user', 'Response', 'REST API', { direction: 'inbound' }),
    ],
  })
}