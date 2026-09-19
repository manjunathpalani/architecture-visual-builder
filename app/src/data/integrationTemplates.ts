import type { ArchitectureDocument, Integration, SystemNode } from '../types'
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

/** MuleSoft-style experience / process / system APIs */
export function createApiLedConnectivity(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'al-mobile',
      type: 'diagram',
      label: 'Mobile app',
      category: 'Software Engineering',
      position: { x: 40, y: 80 },
      properties: { shape: 'c4-person', description: 'Customer mobile channel' },
    },
    {
      id: 'al-web',
      type: 'diagram',
      label: 'Web portal',
      category: 'Software Engineering',
      position: { x: 40, y: 220 },
      properties: { shape: 'c4-person', description: 'Browser storefront and account' },
    },
    {
      id: 'al-partner',
      type: 'external',
      label: 'Partner channel',
      category: 'External',
      position: { x: 40, y: 360 },
      properties: { description: 'B2B partners consuming experience APIs' },
    },
    {
      id: 'al-exp-shop',
      type: 'middleware',
      label: 'Shop Experience API',
      category: 'Middleware',
      position: { x: 340, y: 80 },
      properties: {
        componentType: 'api',
        description: 'Channel-shaped API for browse, cart, and checkout',
      },
    },
    {
      id: 'al-exp-account',
      type: 'middleware',
      label: 'Account Experience API',
      category: 'Middleware',
      position: { x: 340, y: 240 },
      properties: {
        componentType: 'api',
        description: 'Profile, orders, and preferences for digital channels',
      },
    },
    {
      id: 'al-exp-partner',
      type: 'middleware',
      label: 'Partner Experience API',
      category: 'Middleware',
      position: { x: 340, y: 400 },
      properties: {
        componentType: 'api',
        description: 'Coarse-grained partner contract; versioned and throttled',
      },
    },
    {
      id: 'al-proc-order',
      type: 'middleware',
      label: 'Order Process API',
      category: 'Middleware',
      position: { x: 660, y: 120 },
      properties: {
        componentType: 'api',
        description: 'Orchestrates cart, payment, ATP, and fulfillment across systems',
      },
    },
    {
      id: 'al-proc-customer',
      type: 'middleware',
      label: 'Customer Process API',
      category: 'Middleware',
      position: { x: 660, y: 300 },
      properties: {
        componentType: 'api',
        description: 'Composes CRM, identity, and consent into a customer 360',
      },
    },
    {
      id: 'al-sys-crm',
      type: 'middleware',
      label: 'CRM System API',
      category: 'Middleware',
      position: { x: 980, y: 40 },
      properties: { componentType: 'api', description: 'Unlocks Salesforce without exposing CRM quirks' },
    },
    {
      id: 'al-sys-erp',
      type: 'middleware',
      label: 'ERP System API',
      category: 'Middleware',
      position: { x: 980, y: 180 },
      properties: { componentType: 'api', description: 'Canonical order and inventory operations on SAP' },
    },
    {
      id: 'al-sys-pim',
      type: 'middleware',
      label: 'PIM System API',
      category: 'Middleware',
      position: { x: 980, y: 320 },
      properties: { componentType: 'api', description: 'Product master and catalog reads' },
    },
    {
      id: 'al-sys-pay',
      type: 'middleware',
      label: 'Payments System API',
      category: 'Middleware',
      position: { x: 980, y: 460 },
      properties: { componentType: 'api', description: 'Tokenized capture and refund against the PSP' },
    },
    {
      id: 'al-crm',
      type: 'saas',
      label: 'Salesforce CRM',
      category: 'SaaS',
      position: { x: 1280, y: 40 },
      properties: { vendor: 'Salesforce', description: 'Accounts, contacts, and cases' },
    },
    {
      id: 'al-erp',
      type: 'onpremise',
      label: 'SAP S/4HANA',
      category: 'On-Premise',
      position: { x: 1280, y: 180 },
      properties: { vendor: 'SAP', description: 'System of record for orders, stock, and finance' },
    },
    {
      id: 'al-pim',
      type: 'saas',
      label: 'Product PIM',
      category: 'SaaS',
      position: { x: 1280, y: 320 },
      properties: { description: 'Product master and digital assets' },
    },
    {
      id: 'al-psp',
      type: 'external',
      label: 'Payment service',
      category: 'External',
      position: { x: 1280, y: 460 },
      properties: { description: 'Card capture, 3DS, and settlement' },
    },
  ]

  return stamp({
    metadata: {
      name: 'API-led connectivity',
      description:
        'Experience, process, and system API layers so channels reuse composed capabilities instead of calling systems of record directly',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('al-i-mob-shop', 'al-mobile', 'al-exp-shop', 'Shop API', 'REST API'),
      edge('al-i-web-shop', 'al-web', 'al-exp-shop', 'Shop API', 'REST API'),
      edge('al-i-web-acct', 'al-web', 'al-exp-account', 'Account API', 'REST API'),
      edge('al-i-ptn-exp', 'al-partner', 'al-exp-partner', 'Partner API', 'REST API'),
      edge('al-i-shop-ord', 'al-exp-shop', 'al-proc-order', 'Place / quote order', 'REST API'),
      edge('al-i-shop-cust', 'al-exp-shop', 'al-proc-customer', 'Customer context', 'REST API'),
      edge('al-i-acct-cust', 'al-exp-account', 'al-proc-customer', 'Profile compose', 'REST API'),
      edge('al-i-acct-ord', 'al-exp-account', 'al-proc-order', 'Order history', 'REST API'),
      edge('al-i-ptn-ord', 'al-exp-partner', 'al-proc-order', 'Partner order', 'REST API'),
      edge('al-i-ord-crm', 'al-proc-order', 'al-sys-crm', 'Opportunity / case', 'REST API'),
      edge('al-i-ord-erp', 'al-proc-order', 'al-sys-erp', 'Create sales order', 'REST API'),
      edge('al-i-ord-pim', 'al-proc-order', 'al-sys-pim', 'Catalog / ATP', 'REST API'),
      edge('al-i-ord-pay', 'al-proc-order', 'al-sys-pay', 'Authorize payment', 'REST API'),
      edge('al-i-cust-crm', 'al-proc-customer', 'al-sys-crm', 'Customer master', 'REST API'),
      edge('al-i-sys-crm', 'al-sys-crm', 'al-crm', 'Salesforce API', 'REST API'),
      edge('al-i-sys-erp', 'al-sys-erp', 'al-erp', 'SAP OData / IDoc', 'REST API'),
      edge('al-i-sys-pim', 'al-sys-pim', 'al-pim', 'PIM API', 'REST API'),
      edge('al-i-sys-pay', 'al-sys-pay', 'al-psp', 'PSP API', 'REST API'),
    ],
    drawings: [
      zone('al-z-ch', 20, 40, 260, 460, '#ec4899'),
      label('al-z-ch-l', 32, 52, 'Channels', '#be185d'),
      zone('al-z-ex', 320, 40, 280, 460, '#6366f1'),
      label('al-z-ex-l', 332, 52, 'Experience APIs', '#4338ca'),
      zone('al-z-pr', 640, 40, 280, 460, '#0ea5e9'),
      label('al-z-pr-l', 652, 52, 'Process APIs', '#0369a1'),
      zone('al-z-sy', 960, 20, 280, 540, '#f59e0b'),
      label('al-z-sy-l', 972, 32, 'System APIs', '#b45309'),
      zone('al-z-sor', 1260, 20, 260, 540, '#64748b'),
      label('al-z-sor-l', 1272, 32, 'Systems of record', '#334155'),
      label('al-title', 40, 530, 'API-led connectivity — channels never call systems of record directly', '#334155'),
    ],
  })
}

/** Central ESB / iPaaS hub with canonical model */
export function createHubAndSpoke(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'hs-crm',
      type: 'saas',
      label: 'Salesforce CRM',
      category: 'SaaS',
      position: { x: 40, y: 80 },
      properties: { vendor: 'Salesforce', description: 'Leads, accounts, and opportunities' },
    },
    {
      id: 'hs-hcm',
      type: 'saas',
      label: 'Workday HCM',
      category: 'SaaS',
      position: { x: 40, y: 280 },
      properties: { vendor: 'Workday', description: 'Worker and organization master' },
    },
    {
      id: 'hs-wms',
      type: 'onpremise',
      label: 'Warehouse WMS',
      category: 'On-Premise',
      position: { x: 40, y: 480 },
      properties: { description: 'Inventory, picks, and shipments' },
    },
    {
      id: 'hs-hub',
      type: 'middleware',
      label: 'Integration hub (ESB / iPaaS)',
      category: 'Middleware',
      position: { x: 460, y: 260 },
      properties: {
        description: 'Canonical model, routing, transformation, retry, and replay',
      },
      subDiagram: {
        name: 'Hub internals',
        description: 'VETRO pipeline inside the hub',
        systems: [
          {
            id: 'hs-val',
            type: 'middleware',
            label: 'Validate',
            category: 'Middleware',
            position: { x: 40, y: 80 },
            properties: { description: 'Schema, auth, and duplicate checks' },
          },
          {
            id: 'hs-enr',
            type: 'middleware',
            label: 'Enrich',
            category: 'Middleware',
            position: { x: 280, y: 80 },
            properties: { description: 'Lookup keys and reference data' },
          },
          {
            id: 'hs-xfm',
            type: 'middleware',
            label: 'Transform',
            category: 'Middleware',
            position: { x: 520, y: 80 },
            properties: { description: 'Map to the canonical model' },
          },
          {
            id: 'hs-rte',
            type: 'middleware',
            label: 'Route',
            category: 'Middleware',
            position: { x: 760, y: 80 },
            properties: { description: 'Content-based and recipient list routing' },
          },
          {
            id: 'hs-ops',
            type: 'middleware',
            label: 'Operate',
            category: 'Middleware',
            position: { x: 1000, y: 80 },
            properties: { description: 'Retry, DLQ, idempotency, and audit' },
          },
        ],
        integrations: [
          edge('hs-s-1', 'hs-val', 'hs-enr', 'Valid payload', 'REST API', { frequency: 'event-driven' }),
          edge('hs-s-2', 'hs-enr', 'hs-xfm', 'Enriched', 'REST API', { frequency: 'event-driven' }),
          edge('hs-s-3', 'hs-xfm', 'hs-rte', 'Canonical', 'REST API', { frequency: 'event-driven' }),
          edge('hs-s-4', 'hs-rte', 'hs-ops', 'Routed jobs', 'REST API', { frequency: 'event-driven' }),
        ],
      },
    },
    {
      id: 'hs-erp',
      type: 'onpremise',
      label: 'SAP ERP',
      category: 'On-Premise',
      position: { x: 860, y: 80 },
      properties: { vendor: 'SAP', description: 'Orders, finance, and master data' },
    },
    {
      id: 'hs-mdm',
      type: 'database',
      label: 'Master data',
      category: 'Database',
      position: { x: 860, y: 260 },
      properties: { description: 'Canonical customer, product, and location keys' },
    },
    {
      id: 'hs-dw',
      type: 'database',
      label: 'Analytics warehouse',
      category: 'Database',
      position: { x: 860, y: 440 },
      properties: { description: 'Conformed dimensions fed from the hub' },
    },
  ]

  return stamp({
    metadata: {
      name: 'Hub-and-spoke integration',
      description:
        'Spokes talk only to a central hub that owns the canonical model, routing, and operational policies (VETRO)',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('hs-i-crm', 'hs-crm', 'hs-hub', 'Account / opportunity events', 'Webhook', {
        frequency: 'event-driven',
      }),
      edge('hs-i-hcm', 'hs-hcm', 'hs-hub', 'Worker sync', 'REST API', { frequency: 'batch' }),
      edge('hs-i-wms', 'hs-wms', 'hs-hub', 'Stock / ASN', 'SFTP', { frequency: 'batch', dataFormat: 'CSV' }),
      edge('hs-i-erp', 'hs-hub', 'hs-erp', 'Orders & master data', 'REST API'),
      edge('hs-i-mdm', 'hs-hub', 'hs-mdm', 'Canonical keys', 'REST API', { direction: 'bidirectional' }),
      edge('hs-i-dw', 'hs-hub', 'hs-dw', 'Conformed feed', 'Kafka', { frequency: 'near-real-time' }),
    ],
    drawings: [
      zone('hs-z-spk', 20, 40, 280, 560, '#ec4899'),
      label('hs-z-spk-l', 32, 52, 'Spokes', '#be185d'),
      zone('hs-z-hub', 420, 200, 320, 220, '#6366f1'),
      label('hs-z-hub-l', 432, 212, 'Hub (canonical + VETRO)', '#4338ca'),
      zone('hs-z-tgt', 840, 40, 280, 560, '#0ea5e9'),
      label('hs-z-tgt-l', 852, 52, 'Systems of record / analytics', '#0369a1'),
      label('hs-title', 40, 630, 'Hub-and-spoke — no point-to-point between spokes; drill into the hub for VETRO', '#334155'),
    ],
  })
}

/** Event backbone with producers, broker, and consumers */
export function createEventDrivenBackbone(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'ed-oms',
      type: 'cloud',
      label: 'Order management',
      category: 'Cloud',
      position: { x: 40, y: 80 },
      properties: { description: 'Publishes OrderPlaced / OrderShipped facts' },
    },
    {
      id: 'ed-crm',
      type: 'saas',
      label: 'CRM',
      category: 'SaaS',
      position: { x: 40, y: 260 },
      properties: { description: 'Publishes CustomerUpdated events' },
    },
    {
      id: 'ed-iot',
      type: 'external',
      label: 'IoT / edge',
      category: 'External',
      position: { x: 40, y: 440 },
      properties: { description: 'Telemetry and device state changes' },
    },
    {
      id: 'ed-bus',
      type: 'middleware',
      label: 'Event backbone',
      category: 'Middleware',
      position: { x: 400, y: 240 },
      properties: {
        description: 'Kafka / Event Hubs topics with partitioning, retention, and DLQ',
      },
    },
    {
      id: 'ed-stream',
      type: 'middleware',
      label: 'Stream processor',
      category: 'Middleware',
      position: { x: 720, y: 240 },
      properties: { description: 'Join, window, and enrich events before fan-out' },
    },
    {
      id: 'ed-inv',
      type: 'cloud',
      label: 'Inventory service',
      category: 'Cloud',
      position: { x: 1040, y: 40 },
      properties: { description: 'Reserves stock from OrderPlaced' },
    },
    {
      id: 'ed-nfy',
      type: 'cloud',
      label: 'Notification service',
      category: 'Cloud',
      position: { x: 1040, y: 180 },
      properties: { description: 'Email / push from domain events' },
    },
    {
      id: 'ed-wms',
      type: 'onpremise',
      label: 'Warehouse',
      category: 'On-Premise',
      position: { x: 1040, y: 320 },
      properties: { description: 'Picks and ASNs from OrderShipped' },
    },
    {
      id: 'ed-lake',
      type: 'database',
      label: 'Event lake',
      category: 'Database',
      position: { x: 1040, y: 460 },
      properties: { description: 'Immutable event store for analytics and replay' },
    },
  ]

  return stamp({
    metadata: {
      name: 'Event-driven backbone',
      description:
        'Producers publish facts to a durable event backbone; consumers subscribe independently (pub/sub, no temporal coupling)',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('ed-i-oms', 'ed-oms', 'ed-bus', 'OrderPlaced / OrderShipped', 'Kafka', {
        frequency: 'event-driven',
      }),
      edge('ed-i-crm', 'ed-crm', 'ed-bus', 'CustomerUpdated', 'Kafka', { frequency: 'event-driven' }),
      edge('ed-i-iot', 'ed-iot', 'ed-bus', 'Device telemetry', 'MQTT', { frequency: 'real-time' }),
      edge('ed-i-proc', 'ed-bus', 'ed-stream', 'Domain topics', 'Kafka', { frequency: 'event-driven' }),
      edge('ed-i-inv', 'ed-stream', 'ed-inv', 'Reserve stock', 'Kafka', { frequency: 'event-driven' }),
      edge('ed-i-nfy', 'ed-stream', 'ed-nfy', 'Notify customer', 'Kafka', { frequency: 'event-driven' }),
      edge('ed-i-wms', 'ed-stream', 'ed-wms', 'Fulfillment jobs', 'Kafka', { frequency: 'event-driven' }),
      edge('ed-i-lake', 'ed-bus', 'ed-lake', 'Archive / replay', 'Kafka', { frequency: 'near-real-time' }),
    ],
    drawings: [
      zone('ed-z-p', 20, 40, 260, 540, '#ec4899'),
      label('ed-z-p-l', 32, 52, 'Producers', '#be185d'),
      zone('ed-z-b', 380, 180, 280, 220, '#6366f1'),
      label('ed-z-b-l', 392, 192, 'Event backbone', '#4338ca'),
      zone('ed-z-s', 700, 180, 260, 220, '#0ea5e9'),
      label('ed-z-s-l', 712, 192, 'Processing', '#0369a1'),
      zone('ed-z-c', 1020, 20, 280, 560, '#10b981'),
      label('ed-z-c-l', 1032, 32, 'Consumers', '#047857'),
      label('ed-title', 40, 610, 'Event-driven — producers do not know consumers; replay from the backbone', '#334155'),
    ],
  })
}

/** Incremental replacement of a monolith behind a facade */
export function createStranglerFig(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'sf-ch',
      type: 'diagram',
      label: 'Channels',
      category: 'Software Engineering',
      position: { x: 40, y: 220 },
      properties: { shape: 'c4-person', description: 'Web, mobile, and partner traffic' },
    },
    {
      id: 'sf-gw',
      type: 'middleware',
      label: 'Strangler router / API gateway',
      category: 'Middleware',
      position: { x: 340, y: 220 },
      properties: {
        componentType: 'api',
        description: 'Routes by URI / capability: new services first, legacy as default',
      },
    },
    {
      id: 'sf-acl',
      type: 'middleware',
      label: 'Anti-corruption layer',
      category: 'Middleware',
      position: { x: 660, y: 80 },
      properties: {
        description: 'Translates new-domain models to legacy contracts so the monolith stays isolated',
      },
    },
    {
      id: 'sf-ord',
      type: 'cloud',
      label: 'Order service (new)',
      category: 'Cloud',
      position: { x: 660, y: 240 },
      properties: { description: 'Extracted order capability; source of truth for new orders' },
    },
    {
      id: 'sf-cat',
      type: 'cloud',
      label: 'Catalog service (new)',
      category: 'Cloud',
      position: { x: 660, y: 400 },
      properties: { description: 'Extracted product/catalog capability' },
    },
    {
      id: 'sf-mono',
      type: 'onpremise',
      label: 'Legacy monolith',
      category: 'On-Premise',
      position: { x: 980, y: 160 },
      properties: { description: 'Remaining capabilities not yet extracted; shrinks over time' },
    },
    {
      id: 'sf-db',
      type: 'database',
      label: 'Legacy database',
      category: 'Database',
      position: { x: 980, y: 360 },
      properties: { description: 'Shared store during transition; new services own their data' },
    },
  ]

  return stamp({
    metadata: {
      name: 'Strangler fig + ACL',
      description:
        'Route new capabilities to extracted services while an anti-corruption layer protects the remaining monolith',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('sf-i-ch', 'sf-ch', 'sf-gw', 'HTTPS', 'REST API'),
      edge('sf-i-new-ord', 'sf-gw', 'sf-ord', ' /orders*  (new)', 'REST API'),
      edge('sf-i-new-cat', 'sf-gw', 'sf-cat', '/catalog*  (new)', 'REST API'),
      edge('sf-i-legacy', 'sf-gw', 'sf-acl', 'Default / remaining', 'REST API'),
      edge('sf-i-acl', 'sf-acl', 'sf-mono', 'Legacy SOAP / RPC', 'SOAP', { dataFormat: 'XML' }),
      edge('sf-i-ord-acl', 'sf-ord', 'sf-acl', 'Need legacy customer', 'REST API', {
        frequency: 'event-driven',
      }),
      edge('sf-i-mono-db', 'sf-mono', 'sf-db', 'JDBC', 'ODBC/JDBC'),
      edge('sf-i-ord-db', 'sf-ord', 'sf-db', 'Read replica (temporary)', 'ODBC/JDBC', {
        frequency: 'near-real-time',
      }),
    ],
    drawings: [
      zone('sf-z-edge', 20, 160, 260, 220, '#ec4899'),
      label('sf-z-edge-l', 32, 172, 'Edge', '#be185d'),
      zone('sf-z-r', 320, 160, 260, 220, '#6366f1'),
      label('sf-z-r-l', 332, 172, 'Strangler router', '#4338ca'),
      zone('sf-z-n', 640, 40, 260, 480, '#10b981'),
      label('sf-z-n-l', 652, 52, 'New bounded contexts', '#047857'),
      zone('sf-z-l', 960, 100, 260, 380, '#64748b'),
      label('sf-z-l-l', 972, 112, 'Legacy (shrinking)', '#334155'),
      label('sf-title', 40, 560, 'Strangler fig — extract capabilities behind a router; ACL isolates legacy models', '#334155'),
    ],
  })
}

/** Orchestrated saga with compensations */
export function createSagaOrchestration(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'sg-ch',
      type: 'diagram',
      label: 'Checkout',
      category: 'Software Engineering',
      position: { x: 40, y: 220 },
      properties: { shape: 'c4-person', description: 'Customer places an order' },
    },
    {
      id: 'sg-api',
      type: 'middleware',
      label: 'Order API',
      category: 'Middleware',
      position: { x: 300, y: 220 },
      properties: { componentType: 'api', description: 'Accepts PlaceOrder; starts the saga' },
    },
    {
      id: 'sg-orch',
      type: 'middleware',
      label: 'Saga orchestrator',
      category: 'Middleware',
      position: { x: 560, y: 220 },
      properties: {
        description: 'Commands steps in order; on failure runs compensating transactions',
      },
    },
    {
      id: 'sg-pay',
      type: 'cloud',
      label: 'Payment service',
      category: 'Cloud',
      position: { x: 860, y: 40 },
      properties: { description: 'Authorize / capture; compensate with void or refund' },
    },
    {
      id: 'sg-inv',
      type: 'cloud',
      label: 'Inventory service',
      category: 'Cloud',
      position: { x: 860, y: 180 },
      properties: { description: 'Reserve stock; compensate with release' },
    },
    {
      id: 'sg-ship',
      type: 'cloud',
      label: 'Shipping service',
      category: 'Cloud',
      position: { x: 860, y: 320 },
      properties: { description: 'Book carrier; compensate with cancel booking' },
    },
    {
      id: 'sg-ord',
      type: 'database',
      label: 'Order store',
      category: 'Database',
      position: { x: 860, y: 460 },
      properties: { description: 'Saga state and order status' },
    },
  ]

  return stamp({
    metadata: {
      name: 'Saga orchestration',
      description:
        'Long-running business transaction split across services: the orchestrator sequences commands and compensations',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('sg-i-ch', 'sg-ch', 'sg-api', 'Place order', 'REST API'),
      edge('sg-i-start', 'sg-api', 'sg-orch', 'Start saga', 'REST API', { frequency: 'event-driven' }),
      edge('sg-i-pay', 'sg-orch', 'sg-pay', 'Authorize', 'REST API'),
      edge('sg-i-inv', 'sg-orch', 'sg-inv', 'Reserve', 'REST API'),
      edge('sg-i-ship', 'sg-orch', 'sg-ship', 'Book shipment', 'REST API'),
      edge('sg-i-state', 'sg-orch', 'sg-ord', 'Saga state', 'REST API', { direction: 'bidirectional' }),
      edge('sg-i-pay-c', 'sg-orch', 'sg-pay', 'Compensate: void', 'REST API', {
        frequency: 'event-driven',
        description: 'Compensation path when a later step fails',
      }),
      edge('sg-i-inv-c', 'sg-orch', 'sg-inv', 'Compensate: release', 'REST API', {
        frequency: 'event-driven',
        description: 'Compensation path when shipping or payment fails',
      }),
    ],
    drawings: [
      zone('sg-z-in', 20, 160, 220, 220, '#ec4899'),
      label('sg-z-in-l', 32, 172, 'Intake', '#be185d'),
      zone('sg-z-o', 520, 160, 260, 220, '#6366f1'),
      label('sg-z-o-l', 532, 172, 'Orchestrator', '#4338ca'),
      zone('sg-z-p', 840, 20, 280, 560, '#0ea5e9'),
      label('sg-z-p-l', 852, 32, 'Participants + compensations', '#0369a1'),
      label('sg-title', 40, 610, 'Saga — no distributed 2PC; compensate on failure instead of locking', '#334155'),
    ],
  })
}

/** Channel-specific backends in front of shared services */
export function createBackendForFrontend(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'bf-web',
      type: 'diagram',
      label: 'Web app',
      category: 'Software Engineering',
      position: { x: 40, y: 60 },
      properties: { shape: 'c4-person', description: 'Browser SPA' },
    },
    {
      id: 'bf-mob',
      type: 'diagram',
      label: 'Mobile app',
      category: 'Software Engineering',
      position: { x: 40, y: 220 },
      properties: { shape: 'c4-person', description: 'iOS / Android clients' },
    },
    {
      id: 'bf-ptn',
      type: 'external',
      label: 'Partner apps',
      category: 'External',
      position: { x: 40, y: 380 },
      properties: { description: 'Third-party integrators' },
    },
    {
      id: 'bf-bff-web',
      type: 'middleware',
      label: 'Web BFF',
      category: 'Middleware',
      position: { x: 360, y: 60 },
      properties: { componentType: 'api', description: 'Aggregates pages; SSR-friendly payloads' },
    },
    {
      id: 'bf-bff-mob',
      type: 'middleware',
      label: 'Mobile BFF',
      category: 'Middleware',
      position: { x: 360, y: 220 },
      properties: { componentType: 'api', description: 'Chatty-to-chunky; battery-aware batching' },
    },
    {
      id: 'bf-bff-ptn',
      type: 'middleware',
      label: 'Partner BFF',
      category: 'Middleware',
      position: { x: 360, y: 380 },
      properties: { componentType: 'api', description: 'Stable partner contract, versioning, quotas' },
    },
    {
      id: 'bf-id',
      type: 'cloud',
      label: 'Identity',
      category: 'Cloud',
      position: { x: 680, y: 40 },
      properties: { description: 'OIDC / tokens for all BFFs' },
    },
    {
      id: 'bf-cat',
      type: 'cloud',
      label: 'Catalog service',
      category: 'Cloud',
      position: { x: 680, y: 180 },
      properties: { description: 'Products and pricing' },
    },
    {
      id: 'bf-ord',
      type: 'cloud',
      label: 'Order service',
      category: 'Cloud',
      position: { x: 680, y: 320 },
      properties: { description: 'Cart and checkout' },
    },
    {
      id: 'bf-prof',
      type: 'cloud',
      label: 'Profile service',
      category: 'Cloud',
      position: { x: 680, y: 460 },
      properties: { description: 'Customer profile and preferences' },
    },
  ]

  return stamp({
    metadata: {
      name: 'Backend for frontend',
      description:
        'Each channel has a dedicated BFF that aggregates shared backend services into channel-shaped contracts',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('bf-i-web', 'bf-web', 'bf-bff-web', 'Page APIs', 'REST API'),
      edge('bf-i-mob', 'bf-mob', 'bf-bff-mob', 'Mobile APIs', 'REST API'),
      edge('bf-i-ptn', 'bf-ptn', 'bf-bff-ptn', 'Partner APIs', 'REST API'),
      edge('bf-i-w-id', 'bf-bff-web', 'bf-id', 'Auth', 'REST API'),
      edge('bf-i-m-id', 'bf-bff-mob', 'bf-id', 'Auth', 'REST API'),
      edge('bf-i-p-id', 'bf-bff-ptn', 'bf-id', 'Auth', 'REST API'),
      edge('bf-i-w-c', 'bf-bff-web', 'bf-cat', 'Catalog', 'REST API'),
      edge('bf-i-w-o', 'bf-bff-web', 'bf-ord', 'Orders', 'REST API'),
      edge('bf-i-w-p', 'bf-bff-web', 'bf-prof', 'Profile', 'REST API'),
      edge('bf-i-m-c', 'bf-bff-mob', 'bf-cat', 'Catalog', 'REST API'),
      edge('bf-i-m-o', 'bf-bff-mob', 'bf-ord', 'Orders', 'REST API'),
      edge('bf-i-m-p', 'bf-bff-mob', 'bf-prof', 'Profile', 'REST API'),
      edge('bf-i-p-c', 'bf-bff-ptn', 'bf-cat', 'Catalog', 'REST API'),
      edge('bf-i-p-o', 'bf-bff-ptn', 'bf-ord', 'Orders', 'REST API'),
    ],
    drawings: [
      zone('bf-z-ch', 20, 20, 240, 500, '#ec4899'),
      label('bf-z-ch-l', 32, 32, 'Channels', '#be185d'),
      zone('bf-z-b', 340, 20, 260, 500, '#6366f1'),
      label('bf-z-b-l', 352, 32, 'BFFs (per channel)', '#4338ca'),
      zone('bf-z-s', 660, 20, 280, 560, '#0ea5e9'),
      label('bf-z-s-l', 672, 32, 'Shared backend services', '#0369a1'),
      label('bf-title', 40, 560, 'BFF — do not share one API across web, mobile, and partners', '#334155'),
    ],
  })
}

/** Scatter-gather / aggregator */
export function createScatterGather(): ArchitectureDocument {
  const systems: SystemNode[] = [
    {
      id: 'sc-req',
      type: 'cloud',
      label: 'Quote requestor',
      category: 'Cloud',
      position: { x: 40, y: 220 },
      properties: { description: 'Needs a best-price quote from multiple vendors' },
    },
    {
      id: 'sc-scatter',
      type: 'middleware',
      label: 'Scatter (recipient list)',
      category: 'Middleware',
      position: { x: 340, y: 220 },
      properties: { description: 'Fans the request to eligible vendors in parallel' },
    },
    {
      id: 'sc-a',
      type: 'external',
      label: 'Vendor A',
      category: 'External',
      position: { x: 640, y: 40 },
      properties: { description: 'REST quote API' },
    },
    {
      id: 'sc-b',
      type: 'external',
      label: 'Vendor B',
      category: 'External',
      position: { x: 640, y: 200 },
      properties: { description: 'SOAP quote API' },
    },
    {
      id: 'sc-c',
      type: 'external',
      label: 'Vendor C',
      category: 'External',
      position: { x: 640, y: 360 },
      properties: { description: 'File drop / batch quote' },
    },
    {
      id: 'sc-agg',
      type: 'middleware',
      label: 'Aggregator',
      category: 'Middleware',
      position: { x: 940, y: 220 },
      properties: {
        description: 'Correlates replies, applies timeout, picks best quote, returns one response',
      },
    },
  ]

  return stamp({
    metadata: {
      name: 'Scatter-gather',
      description:
        'Fan a request to many providers in parallel, then aggregate replies (timeout, correlation, best-of)',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations: [
      edge('sc-i-in', 'sc-req', 'sc-scatter', 'Quote request', 'REST API'),
      edge('sc-i-a', 'sc-scatter', 'sc-a', 'Ask A', 'REST API'),
      edge('sc-i-b', 'sc-scatter', 'sc-b', 'Ask B', 'SOAP', { dataFormat: 'XML' }),
      edge('sc-i-c', 'sc-scatter', 'sc-c', 'Ask C', 'SFTP', { frequency: 'near-real-time', dataFormat: 'CSV' }),
      edge('sc-i-ar', 'sc-a', 'sc-agg', 'Quote A', 'REST API'),
      edge('sc-i-br', 'sc-b', 'sc-agg', 'Quote B', 'SOAP', { dataFormat: 'XML' }),
      edge('sc-i-cr', 'sc-c', 'sc-agg', 'Quote C', 'SFTP', { frequency: 'near-real-time', dataFormat: 'CSV' }),
      edge('sc-i-out', 'sc-agg', 'sc-req', 'Best quote', 'REST API'),
    ],
    drawings: [
      zone('sc-z-r', 20, 160, 240, 220, '#ec4899'),
      label('sc-z-r-l', 32, 172, 'Requestor', '#be185d'),
      zone('sc-z-s', 320, 160, 250, 220, '#6366f1'),
      label('sc-z-s-l', 332, 172, 'Scatter', '#4338ca'),
      zone('sc-z-v', 620, 20, 240, 460, '#f59e0b'),
      label('sc-z-v-l', 632, 32, 'Providers', '#b45309'),
      zone('sc-z-a', 920, 160, 250, 220, '#10b981'),
      label('sc-z-a-l', 932, 172, 'Gather', '#047857'),
      label('sc-title', 40, 520, 'Scatter-gather — parallel fan-out with correlation, timeout, and aggregation', '#334155'),
    ],
  })
}
