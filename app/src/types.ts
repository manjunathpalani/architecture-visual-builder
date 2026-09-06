import type { DrawingElement, SubDiagram } from './types/diagram'

export type SystemType =
  | 'saas'
  | 'aws'
  | 'azure'
  | 'powerplatform'
  | 'cloud'
  | 'onpremise'
  | 'middleware'
  | 'database'
  | 'external'
  | 'diagram'
  | 'note'
  | 'group'
  | 'shape'

/** Geometric drawing shapes (resizable + connectable) */
export type DrawingShapeKind =
  | 'rectangle'
  | 'rounded-rect'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'hexagon'
  | 'cylinder'
  | 'parallelogram'

export type DiagramShape =
  | 'actor'
  | 'class'
  | 'interface'
  | 'component'
  | 'process'
  | 'decision'
  | 'package'
  | 'datastore'
  | 'queue'
  | 'c4-person'
  | 'c4-system'
  | 'c4-container'

export type FlowNodeType = 'integration' | 'diagram' | 'annotation' | 'group' | 'shape'

export const DRAWING_SHAPE_KINDS: DrawingShapeKind[] = [
  'rectangle',
  'rounded-rect',
  'ellipse',
  'diamond',
  'triangle',
  'hexagon',
  'cylinder',
  'parallelogram',
]

export const DRAWING_SHAPE_LABELS: Record<DrawingShapeKind, string> = {
  rectangle: 'Rectangle',
  'rounded-rect': 'Rounded Rect',
  ellipse: 'Ellipse',
  diamond: 'Diamond',
  triangle: 'Triangle',
  hexagon: 'Hexagon',
  cylinder: 'Cylinder',
  parallelogram: 'Parallelogram',
}

export type IntegrationDirection = 'inbound' | 'outbound' | 'bidirectional' | 'none'

export const ARROW_DIRECTION_OPTIONS: Array<{
  id: IntegrationDirection
  label: string
  hint: string
  symbol: string
}> = [
  { id: 'outbound', label: 'To target', hint: 'Arrow points at the destination', symbol: 'A → B' },
  { id: 'inbound', label: 'To source', hint: 'Arrow points at the source', symbol: 'A ← B' },
  { id: 'bidirectional', label: 'Both ways', hint: 'Arrows on both ends', symbol: 'A ↔ B' },
  { id: 'none', label: 'No arrow', hint: 'Plain line with no arrowhead', symbol: 'A — B' },
]

export type IntegrationProtocol =
  | 'REST API'
  | 'SOAP'
  | 'GraphQL'
  | 'SFTP'
  | 'Kafka'
  | 'MQTT'
  | 'Webhook'
  | 'ODBC/JDBC'
  | 'File Transfer'
  | 'Custom'

export type IntegrationFrequency =
  | 'real-time'
  | 'near-real-time'
  | 'batch'
  | 'event-driven'
  | 'scheduled'

export type EdgeRouting = 'bezier' | 'smoothstep' | 'step' | 'straight'

export const EDGE_ROUTING_OPTIONS: Array<{ id: EdgeRouting; label: string; hint: string }> = [
  { id: 'bezier', label: 'Curved', hint: 'Smooth curve between boxes' },
  { id: 'smoothstep', label: 'Rounded orthogonal', hint: 'Right-angle turns with rounded corners' },
  { id: 'step', label: 'Orthogonal', hint: 'Right-angle routing' },
  { id: 'straight', label: 'Straight', hint: 'Direct line' },
]

export function parseEdgeRouting(value?: string): EdgeRouting {
  if (value === 'bezier' || value === 'smoothstep' || value === 'step' || value === 'straight') {
    return value
  }
  return 'bezier'
}

export interface Position {
  x: number
  y: number
}

export interface SystemProperties {
  vendor?: string
  environment?: string
  region?: string
  owner?: string
  description?: string
  color?: string
  fontSize?: string
  fontFamily?: string
  fontWeight?: string
  fontStyle?: string
  textColor?: string
  width?: string
  height?: string
  gitAzureProject?: string
  gitAzureRepoId?: string
  jiraIssueKey?: string
  jiraIssueSummary?: string
  jiraIssueUrl?: string
  adoProject?: string
  adoWorkItemId?: string
  adoWorkItemTitle?: string
  adoWorkItemUrl?: string
  [key: string]: string | undefined
}

export const COLOR_PRESETS = [
  '#6366f1', '#ff9900', '#0078d4', '#0ea5e9', '#f59e0b',
  '#8b5cf6', '#10b981', '#64748b', '#ec4899', '#ef4444',
  '#fbbf24', '#14b8a6', '#f97316', '#a855f7', '#06b6d4',
  '#334155',
]

export interface SystemNode {
  id: string
  type: SystemType
  label: string
  category: string
  position: Position
  properties?: SystemProperties
  subDiagram?: SubDiagram
}

export interface Integration {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label: string
  direction: IntegrationDirection
  protocol: IntegrationProtocol
  frequency: IntegrationFrequency
  dataFormat?: string
  description?: string
  interfaceSpec?: string
  color?: string
  changeStatus?: 'unchanged' | 'new' | 'modified' | 'retired'
  routing?: EdgeRouting
  waypoints?: Position[]
  jiraIssueKey?: string
  jiraIssueSummary?: string
  jiraIssueUrl?: string
  adoProject?: string
  adoWorkItemId?: string
  adoWorkItemTitle?: string
  adoWorkItemUrl?: string
}

export interface ArchitectureMetadata {
  name: string
  description?: string
  version: string
  updatedAt: string
}

export type AuditKind =
  | 'add'
  | 'remove'
  | 'update'
  | 'move'
  | 'connect'
  | 'draw'
  | 'import'
  | 'ai'
  | 'navigate'

export interface AuditEvent {
  id: string
  at: string
  actor: string
  kind: AuditKind
  summary: string
  details: string[]
}

export interface ArchitectureDocument {
  metadata: ArchitectureMetadata
  systems: SystemNode[]
  integrations: Integration[]
  drawings?: DrawingElement[]
  audit?: AuditEvent[]
}

export interface PaletteItem {
  type: SystemType
  label: string
  category: string
  flowType?: FlowNodeType
  defaultProperties?: SystemProperties
  defaultSize?: { width: number; height: number }
}

export const SYSTEM_TYPE_CONFIG: Record<
  SystemType,
  { label: string; color: string; icon: string }
> = {
  saas: { label: 'SaaS', color: '#6366f1', icon: '☁️' },
  aws: { label: 'AWS', color: '#ff9900', icon: '🟠' },
  azure: { label: 'Azure', color: '#0078d4', icon: '🔷' },
  powerplatform: { label: 'Power Platform', color: '#742774', icon: '⬡' },
  cloud: { label: 'Cloud', color: '#0ea5e9', icon: '⛅' },
  onpremise: { label: 'On-Premise', color: '#f59e0b', icon: '🏢' },
  middleware: { label: 'Middleware', color: '#8b5cf6', icon: '🔗' },
  database: { label: 'Database', color: '#10b981', icon: '🗄️' },
  external: { label: 'External', color: '#64748b', icon: '🌐' },
  diagram: { label: 'Diagram', color: '#ec4899', icon: '◇' },
  note: { label: 'Note', color: '#fbbf24', icon: '📝' },
  group: { label: 'Group', color: '#94a3b8', icon: '▢' },
  shape: { label: 'Shape', color: '#64748b', icon: '◇' },
}

export const PALETTE_CATEGORY_ORDER = [
  'SaaS',
  'Microsoft 365',
  'AWS',
  'Azure',
  'Power Platform',
  'Cloud',
  'Infrastructure',
  'On-Premise',
  'Middleware',
  'Database',
  'External',
  'Software Engineering',
  'Drawing',
]

export const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'saas', label: 'SaaS Platform', category: 'SaaS' },
  { type: 'saas', label: 'Salesforce', category: 'SaaS', defaultProperties: { vendor: 'Salesforce' } },
  { type: 'saas', label: 'Dynamics 365', category: 'SaaS', defaultProperties: { vendor: 'Microsoft', service: 'Dynamics 365' } },
  { type: 'saas', label: 'Dataverse', category: 'SaaS', defaultProperties: { vendor: 'Microsoft', service: 'Dataverse' } },
  { type: 'saas', label: 'Workday', category: 'SaaS', defaultProperties: { vendor: 'Workday' } },
  { type: 'saas', label: 'ServiceNow', category: 'SaaS', defaultProperties: { vendor: 'ServiceNow' } },
  { type: 'saas', label: 'Jira', category: 'SaaS', defaultProperties: { vendor: 'Atlassian', service: 'Jira' } },
  { type: 'saas', label: 'Azure DevOps', category: 'SaaS', defaultProperties: { vendor: 'Microsoft Azure', service: 'Azure DevOps' } },

  { type: 'aws', label: 'AWS Lambda', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'Lambda' } },
  { type: 'aws', label: 'Amazon S3', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'S3' } },
  { type: 'aws', label: 'Amazon EC2', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'EC2' } },
  { type: 'aws', label: 'AWS API Gateway', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'API Gateway', componentType: 'api' } },
  { type: 'aws', label: 'Amazon SQS', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'SQS' } },
  { type: 'aws', label: 'Amazon SNS', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'SNS' } },
  { type: 'aws', label: 'Amazon MSK (Kafka)', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'MSK' } },
  { type: 'aws', label: 'Amazon EventBridge', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'EventBridge' } },
  { type: 'aws', label: 'Amazon RDS', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'RDS' } },
  { type: 'aws', label: 'AWS Step Functions', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'Step Functions' } },
  { type: 'aws', label: 'Amazon CloudWatch', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'CloudWatch' } },
  { type: 'aws', label: 'AWS Cognito', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'Cognito' } },
  { type: 'aws', label: 'Amazon CloudFront', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'CloudFront' } },
  { type: 'aws', label: 'Amazon Route 53', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'Route 53' } },
  { type: 'aws', label: 'AWS WAF', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'WAF' } },
  { type: 'aws', label: 'Application Load Balancer', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'ALB' } },
  { type: 'aws', label: 'NAT Gateway', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'NAT Gateway' } },
  { type: 'aws', label: 'Amazon EKS', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'EKS' } },
  { type: 'aws', label: 'AWS IAM', category: 'AWS', defaultProperties: { vendor: 'AWS', service: 'IAM' } },

  { type: 'powerplatform', label: 'Power Platform', category: 'Power Platform', defaultProperties: { vendor: 'Microsoft Power Platform', service: 'Power Platform', color: '#742774' } },
  { type: 'powerplatform', label: 'Power Apps', category: 'Power Platform', defaultProperties: { vendor: 'Microsoft Power Platform', service: 'Power Apps', color: '#742774' } },
  { type: 'powerplatform', label: 'Canvas App', category: 'Power Platform', defaultProperties: { vendor: 'Microsoft Power Platform', service: 'Canvas App', color: '#742774' } },
  { type: 'powerplatform', label: 'Model-driven App', category: 'Power Platform', defaultProperties: { vendor: 'Microsoft Power Platform', service: 'Model-driven App', color: '#5B2C6F' } },
  { type: 'powerplatform', label: 'Power Automate', category: 'Power Platform', defaultProperties: { vendor: 'Microsoft Power Platform', service: 'Power Automate', color: '#0066FF' } },
  { type: 'powerplatform', label: 'Power Automate Desktop', category: 'Power Platform', defaultProperties: { vendor: 'Microsoft Power Platform', service: 'Power Automate Desktop', color: '#0066FF' } },
  { type: 'powerplatform', label: 'Power BI', category: 'Power Platform', defaultProperties: { vendor: 'Microsoft Power Platform', service: 'Power BI', color: '#B45309' } },
  { type: 'powerplatform', label: 'Power Pages', category: 'Power Platform', defaultProperties: { vendor: 'Microsoft Power Platform', service: 'Power Pages', color: '#0EA5E9' } },
  { type: 'powerplatform', label: 'Dataverse', category: 'Power Platform', defaultProperties: { vendor: 'Microsoft Power Platform', service: 'Dataverse', color: '#0284C7' } },
  { type: 'powerplatform', label: 'Copilot Studio', category: 'Power Platform', defaultProperties: { vendor: 'Microsoft Power Platform', service: 'Copilot Studio', color: '#5B2C6F' } },
  { type: 'powerplatform', label: 'AI Builder', category: 'Power Platform', defaultProperties: { vendor: 'Microsoft Power Platform', service: 'AI Builder', color: '#C43B8C' } },
  { type: 'powerplatform', label: 'Custom Connector', category: 'Power Platform', defaultProperties: { vendor: 'Microsoft Power Platform', service: 'Custom Connector', color: '#742774', componentType: 'api' } },
  { type: 'powerplatform', label: 'On-premises Data Gateway', category: 'Power Platform', defaultProperties: { vendor: 'Microsoft Power Platform', service: 'Data Gateway', color: '#5B2C6F' } },

  { type: 'cloud', label: 'GCP Service', category: 'Cloud', defaultProperties: { vendor: 'Google Cloud' } },
  { type: 'cloud', label: 'API Component', category: 'Cloud', defaultProperties: { componentType: 'api' } },
  { type: 'cloud', label: 'Generic API Gateway', category: 'Cloud', defaultProperties: { componentType: 'api' } },
  { type: 'cloud', label: 'Message Queue', category: 'Cloud' },

  { type: 'cloud', label: 'Virtual Network / VPC', category: 'Infrastructure' },
  { type: 'cloud', label: 'Load Balancer', category: 'Infrastructure' },
  { type: 'cloud', label: 'WAF / Firewall', category: 'Infrastructure' },
  { type: 'cloud', label: 'CDN', category: 'Infrastructure' },
  { type: 'cloud', label: 'DNS', category: 'Infrastructure' },
  { type: 'cloud', label: 'VPN Gateway', category: 'Infrastructure' },
  { type: 'cloud', label: 'Kubernetes Cluster', category: 'Infrastructure' },
  { type: 'cloud', label: 'Container Registry', category: 'Infrastructure' },
  { type: 'cloud', label: 'Secrets / Vault', category: 'Infrastructure' },
  { type: 'cloud', label: 'Observability', category: 'Infrastructure' },
  { type: 'cloud', label: 'CI / CD', category: 'Infrastructure' },
  { type: 'group', label: 'Landing Zone', category: 'Infrastructure', flowType: 'group', defaultProperties: { zone: 'Landing Zone' }, defaultSize: { width: 360, height: 220 } },
  { type: 'group', label: 'Public Subnet', category: 'Infrastructure', flowType: 'group', defaultProperties: { zone: 'Public' }, defaultSize: { width: 280, height: 180 } },
  { type: 'group', label: 'Private Subnet', category: 'Infrastructure', flowType: 'group', defaultProperties: { zone: 'Private' }, defaultSize: { width: 280, height: 180 } },
  { type: 'group', label: 'Hub Network', category: 'Infrastructure', flowType: 'group', defaultProperties: { zone: 'Hub' }, defaultSize: { width: 300, height: 200 } },
  { type: 'group', label: 'Spoke Network', category: 'Infrastructure', flowType: 'group', defaultProperties: { zone: 'Spoke' }, defaultSize: { width: 300, height: 200 } },
  { type: 'group', label: 'DMZ', category: 'Infrastructure', flowType: 'group', defaultProperties: { zone: 'DMZ' }, defaultSize: { width: 260, height: 160 } },

  { type: 'onpremise', label: 'ERP System', category: 'On-Premise' },
  { type: 'onpremise', label: 'Legacy App', category: 'On-Premise' },
  { type: 'onpremise', label: 'Mainframe', category: 'On-Premise' },
  { type: 'middleware', label: 'iPaaS / ESB', category: 'Middleware' },
  { type: 'middleware', label: 'MuleSoft', category: 'Middleware', defaultProperties: { vendor: 'MuleSoft' } },
  { type: 'middleware', label: 'Boomi', category: 'Middleware', defaultProperties: { vendor: 'Boomi' } },
  { type: 'database', label: 'SQL Database', category: 'Database' },
  { type: 'database', label: 'Data Warehouse', category: 'Database' },
  { type: 'external', label: 'Partner API', category: 'External', defaultProperties: { componentType: 'api' } },

  { type: 'diagram', label: 'Actor / User', category: 'Software Engineering', flowType: 'diagram', defaultProperties: { shape: 'actor' } },
  { type: 'diagram', label: 'UML Class', category: 'Software Engineering', flowType: 'diagram', defaultProperties: { shape: 'class' } },
  { type: 'diagram', label: 'Interface', category: 'Software Engineering', flowType: 'diagram', defaultProperties: { shape: 'interface', componentType: 'api' } },
  { type: 'diagram', label: 'Component', category: 'Software Engineering', flowType: 'diagram', defaultProperties: { shape: 'component' } },
  { type: 'diagram', label: 'Process', category: 'Software Engineering', flowType: 'diagram', defaultProperties: { shape: 'process' } },
  { type: 'diagram', label: 'Decision', category: 'Software Engineering', flowType: 'diagram', defaultProperties: { shape: 'decision' } },
  { type: 'diagram', label: 'Package / Module', category: 'Software Engineering', flowType: 'diagram', defaultProperties: { shape: 'package' } },
  { type: 'diagram', label: 'Data Store', category: 'Software Engineering', flowType: 'diagram', defaultProperties: { shape: 'datastore' } },
  { type: 'diagram', label: 'Message Queue', category: 'Software Engineering', flowType: 'diagram', defaultProperties: { shape: 'queue' } },
  { type: 'diagram', label: 'C4 Person', category: 'Software Engineering', flowType: 'diagram', defaultProperties: { shape: 'c4-person' } },
  { type: 'diagram', label: 'C4 System', category: 'Software Engineering', flowType: 'diagram', defaultProperties: { shape: 'c4-system' } },
  { type: 'diagram', label: 'C4 Container', category: 'Software Engineering', flowType: 'diagram', defaultProperties: { shape: 'c4-container' } },

  { type: 'note', label: 'Sticky Note', category: 'Drawing', flowType: 'annotation', defaultProperties: { content: 'Add your note here...' }, defaultSize: { width: 180, height: 120 } },
  { type: 'note', label: 'Text Label', category: 'Drawing', flowType: 'annotation', defaultProperties: { content: 'Label text' }, defaultSize: { width: 140, height: 60 } },
  { type: 'group', label: 'Boundary Zone', category: 'Drawing', flowType: 'group', defaultProperties: {}, defaultSize: { width: 320, height: 200 } },
  { type: 'group', label: 'SaaS Zone', category: 'Drawing', flowType: 'group', defaultProperties: { zone: 'SaaS' }, defaultSize: { width: 280, height: 180 } },
  { type: 'group', label: 'Cloud Zone', category: 'Drawing', flowType: 'group', defaultProperties: { zone: 'Cloud' }, defaultSize: { width: 280, height: 180 } },
  { type: 'group', label: 'On-Premise Zone', category: 'Drawing', flowType: 'group', defaultProperties: { zone: 'On-Premise' }, defaultSize: { width: 280, height: 180 } },

  { type: 'shape', label: 'Rectangle', category: 'Drawing', flowType: 'shape', defaultProperties: { shape: 'rectangle' }, defaultSize: { width: 160, height: 100 } },
  { type: 'shape', label: 'Rounded Rect', category: 'Drawing', flowType: 'shape', defaultProperties: { shape: 'rounded-rect' }, defaultSize: { width: 160, height: 100 } },
  { type: 'shape', label: 'Ellipse', category: 'Drawing', flowType: 'shape', defaultProperties: { shape: 'ellipse' }, defaultSize: { width: 160, height: 100 } },
  { type: 'shape', label: 'Diamond', category: 'Drawing', flowType: 'shape', defaultProperties: { shape: 'diamond' }, defaultSize: { width: 140, height: 140 } },
  { type: 'shape', label: 'Triangle', category: 'Drawing', flowType: 'shape', defaultProperties: { shape: 'triangle' }, defaultSize: { width: 140, height: 120 } },
  { type: 'shape', label: 'Hexagon', category: 'Drawing', flowType: 'shape', defaultProperties: { shape: 'hexagon' }, defaultSize: { width: 160, height: 120 } },
  { type: 'shape', label: 'Cylinder', category: 'Drawing', flowType: 'shape', defaultProperties: { shape: 'cylinder' }, defaultSize: { width: 120, height: 140 } },
  { type: 'shape', label: 'Parallelogram', category: 'Drawing', flowType: 'shape', defaultProperties: { shape: 'parallelogram' }, defaultSize: { width: 160, height: 90 } },
]

export function getFlowNodeType(systemType: SystemType): FlowNodeType {
  if (systemType === 'diagram') return 'diagram'
  if (systemType === 'note') return 'annotation'
  if (systemType === 'group') return 'group'
  if (systemType === 'shape') return 'shape'
  return 'integration'
}