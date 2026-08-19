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

export function createAwsLandingZone(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'aws-users',
      type: 'diagram',
      label: 'Users / Clients',
      category: 'Software Engineering',
      position: { x: 40, y: 200 },
      properties: { shape: 'c4-person', description: 'Browser, mobile, and partner consumers' },
    },
    {
      id: 'aws-r53',
      type: 'aws',
      label: 'Amazon Route 53',
      category: 'AWS',
      position: { x: 280, y: 80 },
      properties: { vendor: 'AWS', service: 'Route 53', description: 'Public DNS and health checks' },
    },
    {
      id: 'aws-cdn',
      type: 'aws',
      label: 'Amazon CloudFront',
      category: 'AWS',
      position: { x: 280, y: 220 },
      properties: { vendor: 'AWS', service: 'CloudFront', description: 'Global CDN and TLS termination' },
    },
    {
      id: 'aws-waf',
      type: 'aws',
      label: 'AWS WAF',
      category: 'AWS',
      position: { x: 280, y: 360 },
      properties: { vendor: 'AWS', service: 'WAF', description: 'Layer 7 protection in front of the load balancer' },
    },
    {
      id: 'aws-alb',
      type: 'aws',
      label: 'Application Load Balancer',
      category: 'AWS',
      position: { x: 560, y: 200 },
      properties: {
        vendor: 'AWS',
        service: 'ALB',
        environment: 'Public subnet',
        description: 'HTTP routing into the private application tier',
      },
    },
    {
      id: 'aws-nat',
      type: 'aws',
      label: 'NAT Gateway',
      category: 'AWS',
      position: { x: 560, y: 380 },
      properties: { vendor: 'AWS', service: 'NAT Gateway', environment: 'Public subnet', description: 'Outbound internet for private workloads' },
    },
    {
      id: 'aws-eks',
      type: 'aws',
      label: 'Amazon EKS',
      category: 'AWS',
      position: { x: 840, y: 160 },
      properties: {
        vendor: 'AWS',
        service: 'EKS',
        environment: 'Private subnet',
        description: 'Container platform for web and API workloads',
      },
    },
    {
      id: 'aws-lambda',
      type: 'aws',
      label: 'AWS Lambda',
      category: 'AWS',
      position: { x: 840, y: 340 },
      properties: { vendor: 'AWS', service: 'Lambda', description: 'Event workers and async jobs' },
    },
    {
      id: 'aws-rds',
      type: 'aws',
      label: 'Amazon RDS',
      category: 'AWS',
      position: { x: 1120, y: 120 },
      properties: { vendor: 'AWS', service: 'RDS', environment: 'Data subnet', description: 'Primary relational database' },
    },
    {
      id: 'aws-s3',
      type: 'aws',
      label: 'Amazon S3',
      category: 'AWS',
      position: { x: 1120, y: 280 },
      properties: { vendor: 'AWS', service: 'S3', description: 'Object storage for static and backup data' },
    },
    {
      id: 'aws-iam',
      type: 'aws',
      label: 'AWS IAM',
      category: 'AWS',
      position: { x: 840, y: 500 },
      properties: { vendor: 'AWS', service: 'IAM', description: 'Identity, roles, and least-privilege access' },
    },
    {
      id: 'aws-cw',
      type: 'aws',
      label: 'Amazon CloudWatch',
      category: 'AWS',
      position: { x: 1120, y: 440 },
      properties: { vendor: 'AWS', service: 'CloudWatch', description: 'Logs, metrics, and alarms' },
    },
  ]

  return stamp({
    metadata: {
      name: 'AWS Landing Zone',
      description:
        'Reference AWS infrastructure: edge (DNS/CDN/WAF), public ALB/NAT, private compute, data stores, and shared identity/observability.',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('aws-int-dns', 'aws-users', 'aws-r53', 'Resolve hostname', 'REST API', { frequency: 'real-time' }),
      edge('aws-int-cdn', 'aws-r53', 'aws-cdn', 'Alias to distribution', 'REST API'),
      edge('aws-int-waf', 'aws-cdn', 'aws-waf', 'Filtered origin fetch', 'REST API'),
      edge('aws-int-alb', 'aws-waf', 'aws-alb', 'HTTPS to ALB', 'REST API'),
      edge('aws-int-eks', 'aws-alb', 'aws-eks', 'Target group traffic', 'REST API'),
      edge('aws-int-db', 'aws-eks', 'aws-rds', 'App queries', 'ODBC/JDBC'),
      edge('aws-int-obj', 'aws-eks', 'aws-s3', 'Read/write objects', 'REST API'),
      edge('aws-int-events', 'aws-eks', 'aws-lambda', 'Async jobs', 'Webhook', { frequency: 'event-driven' }),
      edge('aws-int-out', 'aws-eks', 'aws-nat', 'Egress to internet', 'REST API'),
      edge('aws-int-id', 'aws-eks', 'aws-iam', 'Assume roles', 'REST API'),
      edge('aws-int-obs', 'aws-eks', 'aws-cw', 'Metrics and logs', 'REST API', { frequency: 'near-real-time' }),
    ],
    drawings: [
      zone('aws-z-edge', 250, 40, 250, 420, '#ff9900'),
      label('aws-l-edge', 262, 52, 'Edge', '#b45309'),
      zone('aws-z-pub', 530, 40, 250, 420, '#0ea5e9'),
      label('aws-l-pub', 542, 52, 'Public subnet', '#0369a1'),
      zone('aws-z-priv', 810, 40, 250, 420, '#6366f1'),
      label('aws-l-priv', 822, 52, 'Private subnet', '#4338ca'),
      zone('aws-z-data', 1090, 40, 250, 320, '#10b981'),
      label('aws-l-data', 1102, 52, 'Data subnet', '#047857'),
    ],
  })
}

export function createAzureLandingZone(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'az-users',
      type: 'diagram',
      label: 'Users / Partners',
      category: 'Software Engineering',
      position: { x: 40, y: 220 },
      properties: { shape: 'c4-person', description: 'Corporate and internet users' },
    },
    {
      id: 'az-fd',
      type: 'azure',
      label: 'Azure Front Door',
      category: 'Azure',
      position: { x: 280, y: 120 },
      properties: { vendor: 'Microsoft Azure', service: 'Front Door', description: 'Global anycast entry and TLS' },
    },
    {
      id: 'az-fw',
      type: 'azure',
      label: 'Azure Firewall',
      category: 'Azure',
      position: { x: 280, y: 320 },
      properties: { vendor: 'Microsoft Azure', service: 'Firewall', environment: 'Hub VNet', description: 'Central egress and threat filtering' },
    },
    {
      id: 'az-agw',
      type: 'azure',
      label: 'Application Gateway',
      category: 'Azure',
      position: { x: 560, y: 160 },
      properties: {
        vendor: 'Microsoft Azure',
        service: 'Application Gateway',
        environment: 'Spoke VNet',
        description: 'WAF-enabled regional load balancer',
        componentType: 'api',
      },
    },
    {
      id: 'az-aks',
      type: 'azure',
      label: 'Azure Kubernetes (AKS)',
      category: 'Azure',
      position: { x: 840, y: 140 },
      properties: { vendor: 'Microsoft Azure', service: 'AKS', environment: 'Spoke VNet', description: 'Application cluster' },
    },
    {
      id: 'az-fn',
      type: 'azure',
      label: 'Azure Functions',
      category: 'Azure',
      position: { x: 840, y: 320 },
      properties: { vendor: 'Microsoft Azure', service: 'Functions', description: 'Serverless integrations and jobs' },
    },
    {
      id: 'az-sql',
      type: 'azure',
      label: 'Azure SQL Database',
      category: 'Azure',
      position: { x: 1120, y: 120 },
      properties: { vendor: 'Microsoft Azure', service: 'SQL Database', description: 'Managed relational data' },
    },
    {
      id: 'az-blob',
      type: 'azure',
      label: 'Azure Blob Storage',
      category: 'Azure',
      position: { x: 1120, y: 280 },
      properties: { vendor: 'Microsoft Azure', service: 'Blob Storage', description: 'Documents and static assets' },
    },
    {
      id: 'az-kv',
      type: 'azure',
      label: 'Azure Key Vault',
      category: 'Azure',
      position: { x: 840, y: 480 },
      properties: { vendor: 'Microsoft Azure', service: 'Key Vault', description: 'Secrets, keys, and certificates' },
    },
    {
      id: 'az-entra',
      type: 'azure',
      label: 'Microsoft Entra ID',
      category: 'Azure',
      position: { x: 560, y: 400 },
      properties: { vendor: 'Microsoft Azure', service: 'Entra ID', description: 'Identity and access for users and workloads' },
    },
    {
      id: 'az-mon',
      type: 'azure',
      label: 'Azure Monitor',
      category: 'Azure',
      position: { x: 1120, y: 440 },
      properties: { vendor: 'Microsoft Azure', service: 'Monitor', description: 'Logs, metrics, and alerts' },
    },
  ]

  return stamp({
    metadata: {
      name: 'Azure Landing Zone',
      description:
        'Hub-and-spoke Azure infrastructure: Front Door and Firewall at the hub, Application Gateway and AKS in the spoke, plus identity and observability.',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('az-int-fd', 'az-users', 'az-fd', 'HTTPS entry', 'REST API'),
      edge('az-int-agw', 'az-fd', 'az-agw', 'Origin to App Gateway', 'REST API'),
      edge('az-int-aks', 'az-agw', 'az-aks', 'Backend pool', 'REST API'),
      edge('az-int-sql', 'az-aks', 'az-sql', 'Private SQL traffic', 'ODBC/JDBC'),
      edge('az-int-blob', 'az-aks', 'az-blob', 'Blob I/O', 'REST API'),
      edge('az-int-fn', 'az-aks', 'az-fn', 'Event jobs', 'Webhook', { frequency: 'event-driven' }),
      edge('az-int-kv', 'az-aks', 'az-kv', 'Fetch secrets', 'REST API'),
      edge('az-int-id', 'az-users', 'az-entra', 'Authenticate', 'REST API'),
      edge('az-int-id2', 'az-aks', 'az-entra', 'Workload identity', 'REST API'),
      edge('az-int-fw', 'az-aks', 'az-fw', 'Filtered egress', 'REST API'),
      edge('az-int-mon', 'az-aks', 'az-mon', 'Telemetry', 'REST API', { frequency: 'near-real-time' }),
    ],
    drawings: [
      zone('az-z-hub', 250, 40, 250, 400, '#0078d4'),
      label('az-l-hub', 262, 52, 'Hub VNet', '#0c4a6e'),
      zone('az-z-spoke', 530, 40, 530, 400, '#6366f1'),
      label('az-l-spoke', 542, 52, 'Spoke VNet — application', '#3730a3'),
      zone('az-z-data', 1090, 40, 250, 320, '#10b981'),
      label('az-l-data', 1102, 52, 'Data services', '#047857'),
    ],
  })
}

export function createKubernetesPlatform(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'k8s-users',
      type: 'diagram',
      label: 'Developers / Users',
      category: 'Software Engineering',
      position: { x: 60, y: 180 },
      properties: { shape: 'c4-person', description: 'End users and platform engineers' },
    },
    {
      id: 'k8s-gitops',
      type: 'cloud',
      label: 'GitOps / CI-CD',
      category: 'Infrastructure',
      position: { x: 60, y: 360 },
      properties: { description: 'Source control and continuous delivery into the cluster' },
    },
    {
      id: 'k8s-ingress',
      type: 'cloud',
      label: 'Ingress Controller',
      category: 'Infrastructure',
      position: { x: 340, y: 160 },
      properties: { componentType: 'api', description: 'North-south HTTP routing and TLS' },
    },
    {
      id: 'k8s-api',
      type: 'diagram',
      label: 'API Services',
      category: 'Software Engineering',
      position: { x: 620, y: 80 },
      properties: { shape: 'c4-container', description: 'Stateless HTTP services' },
    },
    {
      id: 'k8s-workers',
      type: 'diagram',
      label: 'Worker Services',
      category: 'Software Engineering',
      position: { x: 620, y: 240 },
      properties: { shape: 'c4-container', description: 'Background consumers and jobs' },
    },
    {
      id: 'k8s-redis',
      type: 'database',
      label: 'Redis Cache',
      category: 'Database',
      position: { x: 900, y: 80 },
      properties: { description: 'Session and hot-path cache' },
    },
    {
      id: 'k8s-pg',
      type: 'database',
      label: 'PostgreSQL',
      category: 'Database',
      position: { x: 900, y: 240 },
      properties: { description: 'Primary datastore' },
    },
    {
      id: 'k8s-reg',
      type: 'cloud',
      label: 'Container Registry',
      category: 'Infrastructure',
      position: { x: 340, y: 360 },
      properties: { description: 'Trusted image repository' },
    },
    {
      id: 'k8s-secrets',
      type: 'cloud',
      label: 'Secrets Store',
      category: 'Infrastructure',
      position: { x: 620, y: 400 },
      properties: { description: 'Sealed secrets / external secrets operator' },
    },
    {
      id: 'k8s-obs',
      type: 'cloud',
      label: 'Prometheus / Grafana',
      category: 'Infrastructure',
      position: { x: 900, y: 400 },
      properties: { description: 'Metrics, logs, and dashboards' },
    },
  ]

  return stamp({
    metadata: {
      name: 'Kubernetes Platform',
      description:
        'Cluster-level infrastructure: ingress, workloads, data, registry, secrets, GitOps, and observability.',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('k8s-int-in', 'k8s-users', 'k8s-ingress', 'HTTPS', 'REST API'),
      edge('k8s-int-api', 'k8s-ingress', 'k8s-api', 'Service routes', 'REST API'),
      edge('k8s-int-cache', 'k8s-api', 'k8s-redis', 'Cache get/set', 'REST API'),
      edge('k8s-int-db', 'k8s-api', 'k8s-pg', 'SQL', 'ODBC/JDBC'),
      edge('k8s-int-jobs', 'k8s-api', 'k8s-workers', 'Domain events', 'Kafka', { frequency: 'event-driven', dataFormat: 'Avro' }),
      edge('k8s-int-wdb', 'k8s-workers', 'k8s-pg', 'Write projections', 'ODBC/JDBC'),
      edge('k8s-int-git', 'k8s-gitops', 'k8s-api', 'Deploy manifests', 'REST API', { frequency: 'event-driven' }),
      edge('k8s-int-img', 'k8s-gitops', 'k8s-reg', 'Push images', 'REST API'),
      edge('k8s-int-pull', 'k8s-api', 'k8s-reg', 'Pull images', 'REST API'),
      edge('k8s-int-sec', 'k8s-api', 'k8s-secrets', 'Mount secrets', 'REST API'),
      edge('k8s-int-obs', 'k8s-api', 'k8s-obs', 'Scrape metrics', 'REST API', { frequency: 'near-real-time' }),
    ],
    drawings: [
      zone('k8s-z-edge', 310, 40, 250, 220, '#0ea5e9'),
      label('k8s-l-edge', 322, 52, 'North-south edge', '#0369a1'),
      zone('k8s-z-work', 590, 40, 250, 280, '#6366f1'),
      label('k8s-l-work', 602, 52, 'Workloads', '#4338ca'),
      zone('k8s-z-data', 870, 40, 250, 280, '#10b981'),
      label('k8s-l-data', 882, 52, 'Stateful services', '#047857'),
    ],
  })
}

export function createHybridInfrastructure(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'hy-users',
      type: 'diagram',
      label: 'Corporate Users',
      category: 'Software Engineering',
      position: { x: 60, y: 180 },
      properties: { shape: 'c4-person', description: 'Campus and remote staff' },
    },
    {
      id: 'hy-ad',
      type: 'onpremise',
      label: 'Active Directory',
      category: 'On-Premise',
      position: { x: 320, y: 80 },
      properties: { description: 'On-prem identity source' },
    },
    {
      id: 'hy-apps',
      type: 'onpremise',
      label: 'Datacenter Apps',
      category: 'On-Premise',
      position: { x: 320, y: 240 },
      properties: { description: 'Line-of-business applications in the DC' },
    },
    {
      id: 'hy-fw',
      type: 'onpremise',
      label: 'DC Firewall',
      category: 'Infrastructure',
      position: { x: 320, y: 400 },
      properties: { description: 'Perimeter and inspection at the datacenter edge' },
    },
    {
      id: 'hy-link',
      type: 'cloud',
      label: 'ExpressRoute / Direct Connect',
      category: 'Infrastructure',
      position: { x: 620, y: 240 },
      properties: { description: 'Private circuit between DC and cloud hub' },
    },
    {
      id: 'hy-vpn',
      type: 'cloud',
      label: 'VPN Gateway',
      category: 'Infrastructure',
      position: { x: 620, y: 420 },
      properties: { description: 'Backup IPsec path and remote access' },
    },
    {
      id: 'hy-hub',
      type: 'cloud',
      label: 'Cloud Hub Network',
      category: 'Infrastructure',
      position: { x: 900, y: 180 },
      properties: { description: 'Shared services VNet / VPC — DNS, firewall, identity' },
    },
    {
      id: 'hy-spoke',
      type: 'cloud',
      label: 'App Spoke',
      category: 'Infrastructure',
      position: { x: 1180, y: 120 },
      properties: { description: 'Application landing zone in the cloud' },
    },
    {
      id: 'hy-id',
      type: 'azure',
      label: 'Entra ID / IAM',
      category: 'Azure',
      position: { x: 900, y: 360 },
      properties: { vendor: 'Microsoft Azure', service: 'Entra ID', description: 'Cloud identity, synced from AD' },
    },
    {
      id: 'hy-dns',
      type: 'cloud',
      label: 'Hybrid DNS',
      category: 'Infrastructure',
      position: { x: 1180, y: 320 },
      properties: { description: 'Conditional forwarders between on-prem and cloud' },
    },
  ]

  return stamp({
    metadata: {
      name: 'Hybrid Infrastructure',
      description:
        'Datacenter-to-cloud connectivity: identity, firewall, private circuit, backup VPN, hub shared services, and application spokes.',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('hy-int-user-ad', 'hy-users', 'hy-ad', 'Domain auth', 'REST API'),
      edge('hy-int-user-app', 'hy-users', 'hy-apps', 'Internal apps', 'REST API'),
      edge('hy-int-app-fw', 'hy-apps', 'hy-fw', 'Inspected egress', 'REST API'),
      edge('hy-int-fw-link', 'hy-fw', 'hy-link', 'Private circuit', 'Custom', { dataFormat: 'IP' }),
      edge('hy-int-fw-vpn', 'hy-fw', 'hy-vpn', 'IPsec backup', 'Custom', { dataFormat: 'IP' }),
      edge('hy-int-link-hub', 'hy-link', 'hy-hub', 'Hub peering', 'Custom', { dataFormat: 'IP' }),
      edge('hy-int-vpn-hub', 'hy-vpn', 'hy-hub', 'VPN into hub', 'Custom', { dataFormat: 'IP' }),
      edge('hy-int-hub-spoke', 'hy-hub', 'hy-spoke', 'Spoke peering', 'Custom', { dataFormat: 'IP' }),
      edge('hy-int-ad-id', 'hy-ad', 'hy-id', 'Identity sync', 'REST API', { frequency: 'scheduled' }),
      edge('hy-int-hub-dns', 'hy-hub', 'hy-dns', 'DNS resolution', 'REST API'),
      edge('hy-int-spoke-dns', 'hy-spoke', 'hy-dns', 'Private DNS', 'REST API'),
    ],
    drawings: [
      zone('hy-z-dc', 290, 40, 260, 460, '#f59e0b'),
      label('hy-l-dc', 302, 52, 'On-premise datacenter', '#b45309'),
      zone('hy-z-wan', 590, 40, 250, 460, '#64748b'),
      label('hy-l-wan', 602, 52, 'Connectivity', '#334155'),
      zone('hy-z-cloud', 870, 40, 540, 360, '#0ea5e9'),
      label('hy-l-cloud', 882, 52, 'Cloud landing zone', '#0369a1'),
    ],
  })
}
