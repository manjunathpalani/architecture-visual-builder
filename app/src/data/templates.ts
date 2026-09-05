import type { ArchitectureDocument } from '../types'
import {
  createBankingEnterprise,
  createHealthcareEnterprise,
  createInsuranceEnterprise,
  createTelcoEnterprise,
} from './industryTemplates'
import {
  createAwsLandingZone,
  createAzureLandingZone,
  createHybridInfrastructure,
  createKubernetesPlatform,
} from './infrastructureTemplates'
import {
  createAgenticAi,
  createAzureAiLanding,
  createEnterpriseRag,
  createMlOpsPlatform,
} from './aiTemplates'
import sampleArchitecture from './sample-architecture.json'

export type ArchitectureTemplateId =
  | 'blank'
  | 'enterprise'
  | 'solution'
  | 'contextual'
  | 'functional'
  | 'integration'
  | 'banking'
  | 'healthcare'
  | 'insurance'
  | 'telco'
  | 'infra-aws'
  | 'infra-azure'
  | 'infra-kubernetes'
  | 'infra-hybrid'
  | 'ai-rag'
  | 'ai-mlops'
  | 'ai-agents'
  | 'ai-azure'

export type ArchitectureTemplateCategory =
  | 'General'
  | 'Architecture Style'
  | 'Industry'
  | 'Infrastructure'
  | 'AI'
  | 'Integration'

export interface TemplateSampleStats {
  systems: number
  integrations: number
  hasSubDiagram: boolean
}

export interface ArchitectureTemplate {
  id: ArchitectureTemplateId
  name: string
  category: ArchitectureTemplateCategory
  description: string
  /** Short bullet highlights shown in the picker */
  highlights: string[]
  icon: string
  /** Every template ships with an editable sample design on the canvas */
  hasSampleDesign: true
  /** One-line summary of the included sample design */
  sampleLabel: string
  create: () => ArchitectureDocument
}

function getSampleStats(doc: ArchitectureDocument): TemplateSampleStats {
  return {
    systems: doc.systems.length,
    integrations: doc.integrations.length,
    hasSubDiagram: doc.systems.some((s) => !!s.subDiagram),
  }
}

export function getTemplateSampleStats(id: ArchitectureTemplateId): TemplateSampleStats {
  return getSampleStats(createFromTemplate(id))
}

function stamp(doc: ArchitectureDocument): ArchitectureDocument {
  return {
    ...doc,
    metadata: {
      ...doc.metadata,
      updatedAt: new Date().toISOString(),
    },
  }
}

function cloneDoc(doc: ArchitectureDocument): ArchitectureDocument {
  return stamp(structuredClone(doc))
}

/** Enterprise Architecture — capability / application / data / technology layers */
function createEnterpriseArchitecture(): ArchitectureDocument {
  return stamp({
    metadata: {
      name: 'Enterprise Architecture',
      description:
        'Layered enterprise architecture: business capabilities, application portfolio, data platforms, and technology infrastructure',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems: [
      // —— Business capability layer ——
      {
        id: 'ea-cap-customer',
        type: 'diagram',
        label: 'Customer Experience',
        category: 'Software Engineering',
        position: { x: 80, y: 80 },
        properties: {
          shape: 'package',
          description: 'CRM, self-service, omnichannel engagement',
          owner: 'Chief Customer Officer',
        },
      },
      {
        id: 'ea-cap-ops',
        type: 'diagram',
        label: 'Operations',
        category: 'Software Engineering',
        position: { x: 300, y: 80 },
        properties: {
          shape: 'package',
          description: 'Order-to-cash, supply chain, fulfillment',
          owner: 'COO',
        },
      },
      {
        id: 'ea-cap-people',
        type: 'diagram',
        label: 'People & Finance',
        category: 'Software Engineering',
        position: { x: 520, y: 80 },
        properties: {
          shape: 'package',
          description: 'HCM, payroll, GL, AP/AR',
          owner: 'CFO / CHRO',
        },
      },
      {
        id: 'ea-cap-analytics',
        type: 'diagram',
        label: 'Insights & Analytics',
        category: 'Software Engineering',
        position: { x: 740, y: 80 },
        properties: {
          shape: 'package',
          description: 'BI, ML, enterprise reporting',
          owner: 'CDO',
        },
      },

      // —— Application portfolio ——
      {
        id: 'ea-app-crm',
        type: 'saas',
        label: 'CRM Platform',
        category: 'SaaS',
        position: { x: 80, y: 260 },
        properties: {
          vendor: 'Salesforce',
          environment: 'Production',
          description: 'Customer 360 and sales pipeline',
          owner: 'Sales Ops',
        },
      },
      {
        id: 'ea-app-erp',
        type: 'onpremise',
        label: 'ERP Core',
        category: 'On-Premise',
        position: { x: 300, y: 260 },
        properties: {
          vendor: 'SAP',
          environment: 'Production',
          description: 'Finance, procurement, inventory',
          owner: 'ERP Center of Excellence',
        },
      },
      {
        id: 'ea-app-hcm',
        type: 'saas',
        label: 'HCM Suite',
        category: 'SaaS',
        position: { x: 520, y: 260 },
        properties: {
          vendor: 'Workday',
          environment: 'Production',
          description: 'HR, talent, payroll',
          owner: 'HR Technology',
        },
      },
      {
        id: 'ea-app-itsm',
        type: 'saas',
        label: 'ITSM / Service Mgmt',
        category: 'SaaS',
        position: { x: 740, y: 260 },
        properties: {
          vendor: 'ServiceNow',
          environment: 'Production',
          description: 'Incidents, requests, CMDB',
          owner: 'IT Operations',
        },
      },

      // —— Integration & API layer ——
      {
        id: 'ea-int-ipaas',
        type: 'middleware',
        label: 'Enterprise iPaaS',
        category: 'Middleware',
        position: { x: 300, y: 420 },
        properties: {
          vendor: 'MuleSoft',
          environment: 'Cloud',
          description: 'Canonical integration and orchestration hub',
          owner: 'Integration CoE',
        },
      },
      {
        id: 'ea-int-apim',
        type: 'azure',
        label: 'API Management',
        category: 'Azure',
        position: { x: 520, y: 420 },
        properties: {
          vendor: 'Microsoft Azure',
          service: 'API Management',
          componentType: 'api',
          description: 'Enterprise API gateway and developer portal',
          owner: 'API Product Team',
        },
      },

      // —— Data platform ——
      {
        id: 'ea-data-lake',
        type: 'database',
        label: 'Data Lakehouse',
        category: 'Database',
        position: { x: 200, y: 580 },
        properties: {
          vendor: 'Snowflake',
          environment: 'Cloud',
          description: 'Enterprise analytical store',
          owner: 'Data Platform',
        },
      },
      {
        id: 'ea-data-mdm',
        type: 'database',
        label: 'Master Data Hub',
        category: 'Database',
        position: { x: 420, y: 580 },
        properties: {
          description: 'Customer, product, and org master data',
          owner: 'Data Governance',
        },
      },
      {
        id: 'ea-data-events',
        type: 'aws',
        label: 'Event Streaming',
        category: 'AWS',
        position: { x: 640, y: 580 },
        properties: {
          vendor: 'AWS',
          service: 'MSK',
          description: 'Domain event backbone',
          owner: 'Platform Engineering',
        },
      },

      // —— Technology / security ——
      {
        id: 'ea-tech-id',
        type: 'azure',
        label: 'Identity Provider',
        category: 'Azure',
        position: { x: 200, y: 740 },
        properties: {
          vendor: 'Microsoft Azure',
          service: 'Entra ID',
          description: 'SSO, MFA, workforce & partner identity',
          owner: 'IAM',
        },
      },
      {
        id: 'ea-tech-cloud',
        type: 'cloud',
        label: 'Cloud Landing Zone',
        category: 'Cloud',
        position: { x: 420, y: 740 },
        properties: {
          environment: 'Multi-cloud',
          description: 'Shared network, compute, and platform services',
          owner: 'Cloud Platform',
        },
      },
      {
        id: 'ea-tech-sec',
        type: 'external',
        label: 'Security & Observability',
        category: 'External',
        position: { x: 640, y: 740 },
        properties: {
          description: 'SIEM, logging, APM, vulnerability mgmt',
          owner: 'CISO / SRE',
        },
      },
    ],
    integrations: [
      {
        id: 'ea-int-crm-ipaas',
        source: 'ea-app-crm',
        target: 'ea-int-ipaas',
        label: 'Customer Master Sync',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'near-real-time',
        dataFormat: 'JSON',
        description: 'CRM ↔ enterprise customer master via iPaaS',
      },
      {
        id: 'ea-int-erp-ipaas',
        source: 'ea-app-erp',
        target: 'ea-int-ipaas',
        label: 'Order & Finance',
        direction: 'bidirectional',
        protocol: 'SOAP',
        frequency: 'near-real-time',
        dataFormat: 'XML',
        description: 'ERP transactions and status via integration hub',
      },
      {
        id: 'ea-int-hcm-ipaas',
        source: 'ea-app-hcm',
        target: 'ea-int-ipaas',
        label: 'Workforce Data',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'scheduled',
        dataFormat: 'JSON',
        description: 'Employee and org hierarchy feeds',
      },
      {
        id: 'ea-int-itsm-ipaas',
        source: 'ea-app-itsm',
        target: 'ea-int-ipaas',
        label: 'CMDB / Tickets',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'event-driven',
        dataFormat: 'JSON',
        description: 'Service catalog and CI synchronization',
      },
      {
        id: 'ea-int-apim-ipaas',
        source: 'ea-int-apim',
        target: 'ea-int-ipaas',
        label: 'API Routing',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'APIM fronts enterprise APIs backed by iPaaS',
      },
      {
        id: 'ea-int-ipaas-events',
        source: 'ea-int-ipaas',
        target: 'ea-data-events',
        label: 'Domain Events',
        direction: 'outbound',
        protocol: 'Kafka',
        frequency: 'event-driven',
        dataFormat: 'Avro',
        description: 'Publish business events to streaming backbone',
      },
      {
        id: 'ea-int-events-lake',
        source: 'ea-data-events',
        target: 'ea-data-lake',
        label: 'Analytics Ingest',
        direction: 'outbound',
        protocol: 'Kafka',
        frequency: 'event-driven',
        dataFormat: 'Parquet',
        description: 'Stream events into the lakehouse',
      },
      {
        id: 'ea-int-ipaas-mdm',
        source: 'ea-int-ipaas',
        target: 'ea-data-mdm',
        label: 'Master Data',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'near-real-time',
        dataFormat: 'JSON',
        description: 'Golden record create / update / match',
      },
      {
        id: 'ea-int-id-all',
        source: 'ea-tech-id',
        target: 'ea-int-apim',
        label: 'AuthN / AuthZ',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JWT',
        description: 'Token issuance and API authorization',
      },
      {
        id: 'ea-int-cap-crm',
        source: 'ea-cap-customer',
        target: 'ea-app-crm',
        label: 'Supports',
        direction: 'outbound',
        protocol: 'Custom',
        frequency: 'real-time',
        dataFormat: 'n/a',
        description: 'Capability realized by CRM application',
      },
      {
        id: 'ea-int-cap-ops',
        source: 'ea-cap-ops',
        target: 'ea-app-erp',
        label: 'Supports',
        direction: 'outbound',
        protocol: 'Custom',
        frequency: 'real-time',
        dataFormat: 'n/a',
        description: 'Capability realized by ERP core',
      },
      {
        id: 'ea-int-cap-people',
        source: 'ea-cap-people',
        target: 'ea-app-hcm',
        label: 'Supports',
        direction: 'outbound',
        protocol: 'Custom',
        frequency: 'real-time',
        dataFormat: 'n/a',
        description: 'Capability realized by HCM suite',
      },
      {
        id: 'ea-int-cap-analytics',
        source: 'ea-cap-analytics',
        target: 'ea-data-lake',
        label: 'Supports',
        direction: 'outbound',
        protocol: 'Custom',
        frequency: 'real-time',
        dataFormat: 'n/a',
        description: 'Capability realized by data lakehouse',
      },
    ],
    drawings: [
      {
        id: 'ea-zone-biz',
        type: 'rectangle',
        points: [
          { x: 40, y: 40 },
          { x: 920, y: 180 },
        ],
        color: '#ec4899',
        strokeWidth: 2,
        fill: '#ec489910',
      },
      {
        id: 'ea-zone-biz-label',
        type: 'text',
        points: [{ x: 52, y: 58 }],
        color: '#ec4899',
        strokeWidth: 1,
        text: 'Business Capabilities',
        fontSize: 13,
      },
      {
        id: 'ea-zone-app',
        type: 'rectangle',
        points: [
          { x: 40, y: 220 },
          { x: 920, y: 360 },
        ],
        color: '#6366f1',
        strokeWidth: 2,
        fill: '#6366f110',
      },
      {
        id: 'ea-zone-app-label',
        type: 'text',
        points: [{ x: 52, y: 238 }],
        color: '#6366f1',
        strokeWidth: 1,
        text: 'Application Portfolio',
        fontSize: 13,
      },
      {
        id: 'ea-zone-int',
        type: 'rectangle',
        points: [
          { x: 40, y: 380 },
          { x: 920, y: 520 },
        ],
        color: '#8b5cf6',
        strokeWidth: 2,
        fill: '#8b5cf610',
      },
      {
        id: 'ea-zone-int-label',
        type: 'text',
        points: [{ x: 52, y: 398 }],
        color: '#8b5cf6',
        strokeWidth: 1,
        text: 'Integration & API Layer',
        fontSize: 13,
      },
      {
        id: 'ea-zone-data',
        type: 'rectangle',
        points: [
          { x: 40, y: 540 },
          { x: 920, y: 680 },
        ],
        color: '#10b981',
        strokeWidth: 2,
        fill: '#10b98110',
      },
      {
        id: 'ea-zone-data-label',
        type: 'text',
        points: [{ x: 52, y: 558 }],
        color: '#10b981',
        strokeWidth: 1,
        text: 'Data Platform',
        fontSize: 13,
      },
      {
        id: 'ea-zone-tech',
        type: 'rectangle',
        points: [
          { x: 40, y: 700 },
          { x: 920, y: 840 },
        ],
        color: '#0ea5e9',
        strokeWidth: 2,
        fill: '#0ea5e910',
      },
      {
        id: 'ea-zone-tech-label',
        type: 'text',
        points: [{ x: 52, y: 718 }],
        color: '#0ea5e9',
        strokeWidth: 1,
        text: 'Technology & Security',
        fontSize: 13,
      },
    ],
  })
}

/** Solution Architecture — C4-style system context for a concrete solution */
function createSolutionArchitecture(): ArchitectureDocument {
  return stamp({
    metadata: {
      name: 'Solution Architecture',
      description:
        'C4-inspired solution architecture for an order management platform: users, system of record, services, APIs, and dependencies',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems: [
      // Actors
      {
        id: 'sa-actor-customer',
        type: 'diagram',
        label: 'Customer',
        category: 'Software Engineering',
        position: { x: 80, y: 120 },
        properties: {
          shape: 'c4-person',
          description: 'External buyer placing and tracking orders',
        },
      },
      {
        id: 'sa-actor-ops',
        type: 'diagram',
        label: 'Operations Staff',
        category: 'Software Engineering',
        position: { x: 80, y: 300 },
        properties: {
          shape: 'c4-person',
          description: 'Internal users managing fulfillment exceptions',
        },
      },
      {
        id: 'sa-actor-partner',
        type: 'diagram',
        label: 'Logistics Partner',
        category: 'Software Engineering',
        position: { x: 80, y: 480 },
        properties: {
          shape: 'c4-person',
          description: '3PL partner receiving shipment instructions',
        },
      },

      // Solution boundary systems
      {
        id: 'sa-web',
        type: 'diagram',
        label: 'Order Web App',
        category: 'Software Engineering',
        position: { x: 360, y: 80 },
        properties: {
          shape: 'c4-container',
          description: 'SPA for browse, cart, and checkout',
          environment: 'Azure App Service',
        },
      },
      {
        id: 'sa-mobile',
        type: 'diagram',
        label: 'Mobile App',
        category: 'Software Engineering',
        position: { x: 360, y: 220 },
        properties: {
          shape: 'c4-container',
          description: 'iOS/Android order status and notifications',
        },
      },
      {
        id: 'sa-admin',
        type: 'diagram',
        label: 'Ops Console',
        category: 'Software Engineering',
        position: { x: 360, y: 360 },
        properties: {
          shape: 'c4-container',
          description: 'Internal tooling for order exceptions and overrides',
        },
      },
      {
        id: 'sa-api',
        type: 'azure',
        label: 'Order API Gateway',
        category: 'Azure',
        position: { x: 600, y: 200 },
        properties: {
          vendor: 'Microsoft Azure',
          service: 'API Management',
          componentType: 'api',
          description: 'Public and partner-facing order APIs',
          interfaceSpec:
            '{\n  "title": "Order Management API",\n  "version": "1.0.0",\n  "baseUrl": "https://api.example.com/orders/v1",\n  "description": "Solution-facing order APIs",\n  "specFormat": "simple",\n  "endpoints": [\n    { "method": "POST", "path": "/orders", "summary": "Create order" },\n    { "method": "GET", "path": "/orders/{id}", "summary": "Get order" },\n    { "method": "POST", "path": "/orders/{id}/cancel", "summary": "Cancel order" }\n  ]\n}',
        },
      },
      {
        id: 'sa-order-svc',
        type: 'diagram',
        label: 'Order Service',
        category: 'Software Engineering',
        position: { x: 840, y: 120 },
        properties: {
          shape: 'c4-container',
          description: 'Core order lifecycle domain service',
          environment: 'AKS',
        },
        subDiagram: {
          name: 'Order Service Internals',
          description: 'Domain components inside the order service',
          systems: [
            {
              id: 'sa-sub-api',
              type: 'diagram',
              label: 'REST Controllers',
              category: 'Software Engineering',
              position: { x: 80, y: 120 },
              properties: {
                shape: 'component',
                description: 'HTTP adapters and validation',
              },
            },
            {
              id: 'sa-sub-domain',
              type: 'diagram',
              label: 'Order Domain',
              category: 'Software Engineering',
              position: { x: 300, y: 120 },
              properties: {
                shape: 'component',
                description: 'Aggregates, policies, state machine',
              },
            },
            {
              id: 'sa-sub-outbox',
              type: 'diagram',
              label: 'Outbox Publisher',
              category: 'Software Engineering',
              position: { x: 520, y: 120 },
              properties: {
                shape: 'queue',
                description: 'Reliable domain event publication',
              },
            },
            {
              id: 'sa-sub-repo',
              type: 'diagram',
              label: 'Order Repository',
              category: 'Software Engineering',
              position: { x: 300, y: 300 },
              properties: {
                shape: 'datastore',
                description: 'Persistence adapter',
              },
            },
          ],
          integrations: [
            {
              id: 'sa-sub-int-api-domain',
              source: 'sa-sub-api',
              target: 'sa-sub-domain',
              label: 'Commands / Queries',
              direction: 'outbound',
              protocol: 'Custom',
              frequency: 'real-time',
              dataFormat: 'JSON',
            },
            {
              id: 'sa-sub-int-domain-repo',
              source: 'sa-sub-domain',
              target: 'sa-sub-repo',
              label: 'Persist',
              direction: 'bidirectional',
              protocol: 'ODBC/JDBC',
              frequency: 'real-time',
              dataFormat: 'SQL',
            },
            {
              id: 'sa-sub-int-domain-outbox',
              source: 'sa-sub-domain',
              target: 'sa-sub-outbox',
              label: 'Domain Events',
              direction: 'outbound',
              protocol: 'Custom',
              frequency: 'event-driven',
              dataFormat: 'JSON',
            },
          ],
        },
      },
      {
        id: 'sa-inventory-svc',
        type: 'diagram',
        label: 'Inventory Service',
        category: 'Software Engineering',
        position: { x: 840, y: 280 },
        properties: {
          shape: 'c4-container',
          description: 'Stock reservation and availability',
          environment: 'AKS',
        },
      },
      {
        id: 'sa-notify-svc',
        type: 'aws',
        label: 'Notification Service',
        category: 'AWS',
        position: { x: 840, y: 440 },
        properties: {
          vendor: 'AWS',
          service: 'Lambda',
          description: 'Email / SMS / push notifications',
        },
      },
      {
        id: 'sa-db',
        type: 'database',
        label: 'Order Database',
        category: 'Database',
        position: { x: 1080, y: 120 },
        properties: {
          vendor: 'Azure SQL',
          environment: 'Production',
          description: 'System of record for orders',
        },
      },
      {
        id: 'sa-cache',
        type: 'database',
        label: 'Session / Cache',
        category: 'Database',
        position: { x: 1080, y: 280 },
        properties: {
          description: 'Redis for sessions and inventory hot paths',
        },
      },
      {
        id: 'sa-bus',
        type: 'azure',
        label: 'Service Bus',
        category: 'Azure',
        position: { x: 1080, y: 440 },
        properties: {
          vendor: 'Microsoft Azure',
          service: 'Service Bus',
          description: 'Async messaging between services',
        },
      },

      // External systems
      {
        id: 'sa-ext-payments',
        type: 'external',
        label: 'Payment Gateway',
        category: 'External',
        position: { x: 1320, y: 120 },
        properties: {
          componentType: 'api',
          description: 'Card and wallet payment processor',
        },
      },
      {
        id: 'sa-ext-erp',
        type: 'onpremise',
        label: 'ERP (Finance)',
        category: 'On-Premise',
        position: { x: 1320, y: 280 },
        properties: {
          vendor: 'SAP',
          description: 'GL posting and invoice generation',
        },
      },
      {
        id: 'sa-ext-shipping',
        type: 'external',
        label: 'Shipping API',
        category: 'External',
        position: { x: 1320, y: 440 },
        properties: {
          componentType: 'api',
          description: 'Carrier rates and tracking',
        },
      },
      {
        id: 'sa-id',
        type: 'azure',
        label: 'Entra ID / B2C',
        category: 'Azure',
        position: { x: 600, y: 40 },
        properties: {
          vendor: 'Microsoft Azure',
          service: 'Entra ID',
          description: 'Customer and workforce identity',
        },
      },
    ],
    integrations: [
      {
        id: 'sa-int-cust-web',
        source: 'sa-actor-customer',
        target: 'sa-web',
        label: 'Uses',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'HTTPS',
        description: 'Customer browses and places orders',
      },
      {
        id: 'sa-int-cust-mobile',
        source: 'sa-actor-customer',
        target: 'sa-mobile',
        label: 'Uses',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'HTTPS',
        description: 'Customer tracks orders on mobile',
      },
      {
        id: 'sa-int-ops-admin',
        source: 'sa-actor-ops',
        target: 'sa-admin',
        label: 'Uses',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'HTTPS',
        description: 'Ops staff manage exceptions',
      },
      {
        id: 'sa-int-partner-api',
        source: 'sa-actor-partner',
        target: 'sa-api',
        label: 'Partner APIs',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: '3PL retrieves shipment instructions',
      },
      {
        id: 'sa-int-web-api',
        source: 'sa-web',
        target: 'sa-api',
        label: 'Order APIs',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
      },
      {
        id: 'sa-int-mobile-api',
        source: 'sa-mobile',
        target: 'sa-api',
        label: 'Order APIs',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
      },
      {
        id: 'sa-int-admin-api',
        source: 'sa-admin',
        target: 'sa-api',
        label: 'Admin APIs',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
      },
      {
        id: 'sa-int-id-api',
        source: 'sa-id',
        target: 'sa-api',
        label: 'JWT / OIDC',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JWT',
        description: 'Authenticate callers at the gateway',
      },
      {
        id: 'sa-int-api-order',
        source: 'sa-api',
        target: 'sa-order-svc',
        label: 'Route Orders',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
      },
      {
        id: 'sa-int-api-inv',
        source: 'sa-api',
        target: 'sa-inventory-svc',
        label: 'Availability',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
      },
      {
        id: 'sa-int-order-db',
        source: 'sa-order-svc',
        target: 'sa-db',
        label: 'Read / Write',
        direction: 'bidirectional',
        protocol: 'ODBC/JDBC',
        frequency: 'real-time',
        dataFormat: 'SQL',
      },
      {
        id: 'sa-int-inv-cache',
        source: 'sa-inventory-svc',
        target: 'sa-cache',
        label: 'Hot Stock',
        direction: 'bidirectional',
        protocol: 'Custom',
        frequency: 'real-time',
        dataFormat: 'JSON',
      },
      {
        id: 'sa-int-order-bus',
        source: 'sa-order-svc',
        target: 'sa-bus',
        label: 'Order Events',
        direction: 'outbound',
        protocol: 'Kafka',
        frequency: 'event-driven',
        dataFormat: 'JSON',
        description: 'OrderPlaced, OrderShipped, OrderCancelled',
      },
      {
        id: 'sa-int-bus-notify',
        source: 'sa-bus',
        target: 'sa-notify-svc',
        label: 'Notify',
        direction: 'outbound',
        protocol: 'Webhook',
        frequency: 'event-driven',
        dataFormat: 'JSON',
      },
      {
        id: 'sa-int-order-pay',
        source: 'sa-order-svc',
        target: 'sa-ext-payments',
        label: 'Authorize Payment',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
      },
      {
        id: 'sa-int-order-erp',
        source: 'sa-order-svc',
        target: 'sa-ext-erp',
        label: 'Post Invoice',
        direction: 'outbound',
        protocol: 'SOAP',
        frequency: 'near-real-time',
        dataFormat: 'XML',
      },
      {
        id: 'sa-int-inv-ship',
        source: 'sa-inventory-svc',
        target: 'sa-ext-shipping',
        label: 'Rates & Labels',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
      },
    ],
    drawings: [
      {
        id: 'sa-zone-people',
        type: 'rectangle',
        points: [
          { x: 40, y: 40 },
          { x: 260, y: 580 },
        ],
        color: '#ec4899',
        strokeWidth: 2,
        fill: '#ec489910',
      },
      {
        id: 'sa-zone-people-label',
        type: 'text',
        points: [{ x: 52, y: 60 }],
        color: '#ec4899',
        strokeWidth: 1,
        text: 'People',
        fontSize: 13,
      },
      {
        id: 'sa-zone-solution',
        type: 'rectangle',
        points: [
          { x: 300, y: 20 },
          { x: 1220, y: 560 },
        ],
        color: '#6366f1',
        strokeWidth: 2,
        fill: '#6366f108',
      },
      {
        id: 'sa-zone-solution-label',
        type: 'text',
        points: [{ x: 312, y: 40 }],
        color: '#6366f1',
        strokeWidth: 1,
        text: 'Order Management Solution',
        fontSize: 13,
      },
      {
        id: 'sa-zone-external',
        type: 'rectangle',
        points: [
          { x: 1260, y: 40 },
          { x: 1500, y: 560 },
        ],
        color: '#64748b',
        strokeWidth: 2,
        fill: '#64748b10',
      },
      {
        id: 'sa-zone-external-label',
        type: 'text',
        points: [{ x: 1272, y: 60 }],
        color: '#64748b',
        strokeWidth: 1,
        text: 'External Systems',
        fontSize: 13,
      },
      {
        id: 'sa-drill-hint',
        type: 'text',
        points: [{ x: 840, y: 90 }],
        color: '#8b5cf6',
        strokeWidth: 1,
        text: 'double-click Order Service to drill in',
        fontSize: 11,
      },
    ],
  })
}

/** Contextual Architecture — system-of-interest in context of actors & external systems */
function createContextualArchitecture(): ArchitectureDocument {
  return stamp({
    metadata: {
      name: 'Contextual Architecture',
      description:
        'System context view: system of interest, surrounding actors, external systems, and high-level interactions',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems: [
      // System of interest (center)
      {
        id: 'ctx-soi',
        type: 'diagram',
        label: 'Order Management Platform',
        category: 'Software Engineering',
        position: { x: 480, y: 280 },
        properties: {
          shape: 'c4-system',
          description:
            'System of interest — owns order lifecycle, inventory reservation, and fulfillment orchestration',
          environment: 'Enterprise',
          owner: 'Order Domain Team',
          width: '240',
          height: '120',
        },
      },

      // Actors (left)
      {
        id: 'ctx-actor-customer',
        type: 'diagram',
        label: 'Customer',
        category: 'Software Engineering',
        position: { x: 80, y: 160 },
        properties: {
          shape: 'c4-person',
          description: 'Places orders, tracks status, requests returns',
        },
      },
      {
        id: 'ctx-actor-csr',
        type: 'diagram',
        label: 'Customer Service',
        category: 'Software Engineering',
        position: { x: 80, y: 320 },
        properties: {
          shape: 'c4-person',
          description: 'Handles exceptions, refunds, and escalations',
        },
      },
      {
        id: 'ctx-actor-ops',
        type: 'diagram',
        label: 'Warehouse Ops',
        category: 'Software Engineering',
        position: { x: 80, y: 480 },
        properties: {
          shape: 'c4-person',
          description: 'Picks, packs, and confirms shipments',
        },
      },

      // Peer / partner systems (top & right)
      {
        id: 'ctx-crm',
        type: 'saas',
        label: 'CRM',
        category: 'SaaS',
        position: { x: 360, y: 60 },
        properties: {
          vendor: 'Salesforce',
          description: 'Customer master and case management',
        },
      },
      {
        id: 'ctx-commerce',
        type: 'saas',
        label: 'Commerce Storefront',
        category: 'SaaS',
        position: { x: 600, y: 60 },
        properties: {
          description: 'Digital storefront and cart experience',
        },
      },
      {
        id: 'ctx-payments',
        type: 'external',
        label: 'Payment Provider',
        category: 'External',
        position: { x: 840, y: 160 },
        properties: {
          componentType: 'api',
          description: 'Authorization, capture, and refunds',
        },
      },
      {
        id: 'ctx-erp',
        type: 'onpremise',
        label: 'ERP / Finance',
        category: 'On-Premise',
        position: { x: 840, y: 320 },
        properties: {
          vendor: 'SAP',
          description: 'Invoicing, GL, and revenue recognition',
        },
      },
      {
        id: 'ctx-wms',
        type: 'onpremise',
        label: 'Warehouse (WMS)',
        category: 'On-Premise',
        position: { x: 840, y: 480 },
        properties: {
          description: 'Inventory locations and pick/pack execution',
        },
      },
      {
        id: 'ctx-shipping',
        type: 'external',
        label: 'Carrier / Shipping',
        category: 'External',
        position: { x: 600, y: 540 },
        properties: {
          componentType: 'api',
          description: 'Labels, tracking, and delivery events',
        },
      },
      {
        id: 'ctx-identity',
        type: 'azure',
        label: 'Identity Provider',
        category: 'Azure',
        position: { x: 360, y: 540 },
        properties: {
          vendor: 'Microsoft Azure',
          service: 'Entra ID',
          description: 'Workforce and customer authentication',
        },
      },
      {
        id: 'ctx-analytics',
        type: 'database',
        label: 'Analytics Platform',
        category: 'Database',
        position: { x: 240, y: 60 },
        properties: {
          vendor: 'Snowflake',
          description: 'Order and fulfillment reporting',
        },
      },
    ],
    integrations: [
      {
        id: 'ctx-int-cust-soi',
        source: 'ctx-actor-customer',
        target: 'ctx-soi',
        label: 'Place & track orders',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'Customer interacts via web/mobile channels',
      },
      {
        id: 'ctx-int-csr-soi',
        source: 'ctx-actor-csr',
        target: 'ctx-soi',
        label: 'Support cases',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'CSR views/modifies orders and issues refunds',
      },
      {
        id: 'ctx-int-ops-soi',
        source: 'ctx-actor-ops',
        target: 'ctx-soi',
        label: 'Fulfillment tasks',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'Ops confirms pick/pack and stock adjustments',
      },
      {
        id: 'ctx-int-commerce-soi',
        source: 'ctx-commerce',
        target: 'ctx-soi',
        label: 'Submit checkout',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'Storefront submits confirmed carts as orders',
      },
      {
        id: 'ctx-int-crm-soi',
        source: 'ctx-crm',
        target: 'ctx-soi',
        label: 'Customer context',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'near-real-time',
        dataFormat: 'JSON',
        description: 'Customer profile and case linkage',
      },
      {
        id: 'ctx-int-soi-pay',
        source: 'ctx-soi',
        target: 'ctx-payments',
        label: 'Authorize / capture',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'Payment lifecycle for each order',
      },
      {
        id: 'ctx-int-soi-erp',
        source: 'ctx-soi',
        target: 'ctx-erp',
        label: 'Invoice & post',
        direction: 'outbound',
        protocol: 'SOAP',
        frequency: 'near-real-time',
        dataFormat: 'XML',
        description: 'Financial documents and status',
      },
      {
        id: 'ctx-int-soi-wms',
        source: 'ctx-soi',
        target: 'ctx-wms',
        label: 'Ship instructions',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'near-real-time',
        dataFormat: 'JSON',
        description: 'Release to warehouse and shipment confirmations',
      },
      {
        id: 'ctx-int-soi-ship',
        source: 'ctx-soi',
        target: 'ctx-shipping',
        label: 'Labels & tracking',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'event-driven',
        dataFormat: 'JSON',
        description: 'Carrier labels out; tracking events in',
      },
      {
        id: 'ctx-int-id-soi',
        source: 'ctx-identity',
        target: 'ctx-soi',
        label: 'Authenticate',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JWT',
        description: 'OIDC/OAuth for users and services',
      },
      {
        id: 'ctx-int-soi-analytics',
        source: 'ctx-soi',
        target: 'ctx-analytics',
        label: 'Order events',
        direction: 'outbound',
        protocol: 'Kafka',
        frequency: 'event-driven',
        dataFormat: 'JSON',
        description: 'Publish order lifecycle events for analytics',
      },
    ],
    drawings: [
      {
        id: 'ctx-zone-soi',
        type: 'rectangle',
        points: [
          { x: 440, y: 240 },
          { x: 760, y: 440 },
        ],
        color: '#6366f1',
        strokeWidth: 2,
        fill: '#6366f112',
      },
      {
        id: 'ctx-zone-soi-label',
        type: 'text',
        points: [{ x: 452, y: 258 }],
        color: '#6366f1',
        strokeWidth: 1,
        text: 'System of Interest',
        fontSize: 12,
      },
      {
        id: 'ctx-zone-actors',
        type: 'rectangle',
        points: [
          { x: 40, y: 100 },
          { x: 280, y: 580 },
        ],
        color: '#ec4899',
        strokeWidth: 2,
        fill: '#ec489910',
      },
      {
        id: 'ctx-zone-actors-label',
        type: 'text',
        points: [{ x: 52, y: 120 }],
        color: '#ec4899',
        strokeWidth: 1,
        text: 'Actors',
        fontSize: 13,
      },
      {
        id: 'ctx-zone-external',
        type: 'rectangle',
        points: [
          { x: 300, y: 20 },
          { x: 1040, y: 640 },
        ],
        color: '#64748b',
        strokeWidth: 1,
        fill: '#64748b08',
      },
      {
        id: 'ctx-zone-external-label',
        type: 'text',
        points: [{ x: 312, y: 40 }],
        color: '#64748b',
        strokeWidth: 1,
        text: 'Enterprise & External Context',
        fontSize: 13,
      },
      {
        id: 'ctx-title',
        type: 'text',
        points: [{ x: 480, y: 680 }],
        color: '#334155',
        strokeWidth: 1,
        text: 'Contextual Architecture — who interacts with the system of interest',
        fontSize: 12,
      },
    ],
  })
}

/** Functional Architecture — functional decomposition and information flows */
function createFunctionalArchitecture(): ArchitectureDocument {
  return stamp({
    metadata: {
      name: 'Functional Architecture',
      description:
        'Functional decomposition: major functions, supporting functions, shared services, and information/control flows',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems: [
      // Primary business functions
      {
        id: 'fn-catalog',
        type: 'diagram',
        label: 'Catalog & Pricing',
        category: 'Software Engineering',
        position: { x: 80, y: 100 },
        properties: {
          shape: 'process',
          description: 'Product catalog, price lists, promotions',
          owner: 'Merchandising',
        },
      },
      {
        id: 'fn-capture',
        type: 'diagram',
        label: 'Order Capture',
        category: 'Software Engineering',
        position: { x: 300, y: 100 },
        properties: {
          shape: 'process',
          description: 'Cart, checkout, validation, order creation',
          owner: 'Digital Commerce',
        },
      },
      {
        id: 'fn-promise',
        type: 'diagram',
        label: 'ATP / Promise',
        category: 'Software Engineering',
        position: { x: 520, y: 100 },
        properties: {
          shape: 'process',
          description: 'Available-to-promise, delivery estimates',
          owner: 'Supply Chain',
        },
      },
      {
        id: 'fn-payment',
        type: 'diagram',
        label: 'Payment Handling',
        category: 'Software Engineering',
        position: { x: 740, y: 100 },
        properties: {
          shape: 'process',
          description: 'Authorize, capture, refund, reconciliation',
          owner: 'Finance Ops',
        },
      },

      {
        id: 'fn-orchestrate',
        type: 'diagram',
        label: 'Order Orchestration',
        category: 'Software Engineering',
        position: { x: 300, y: 280 },
        properties: {
          shape: 'process',
          description: 'Lifecycle state machine, routing, prioritization',
          owner: 'Order Domain',
          width: '200',
          height: '100',
        },
      },
      {
        id: 'fn-allocate',
        type: 'diagram',
        label: 'Inventory Allocation',
        category: 'Software Engineering',
        position: { x: 560, y: 280 },
        properties: {
          shape: 'process',
          description: 'Reserve stock, soft/hard allocation, rebalance',
          owner: 'Inventory',
        },
      },
      {
        id: 'fn-fulfill',
        type: 'diagram',
        label: 'Fulfillment',
        category: 'Software Engineering',
        position: { x: 780, y: 280 },
        properties: {
          shape: 'process',
          description: 'Pick, pack, ship, delivery confirmation',
          owner: 'Warehouse',
        },
      },

      {
        id: 'fn-returns',
        type: 'diagram',
        label: 'Returns & RMA',
        category: 'Software Engineering',
        position: { x: 80, y: 280 },
        properties: {
          shape: 'process',
          description: 'Return authorization, receipt, restock, refund trigger',
          owner: 'Customer Care',
        },
      },
      {
        id: 'fn-notify',
        type: 'diagram',
        label: 'Customer Notification',
        category: 'Software Engineering',
        position: { x: 80, y: 460 },
        properties: {
          shape: 'process',
          description: 'Order status, shipment, delay, and marketing opt-in messages',
          owner: 'CRM',
        },
      },
      {
        id: 'fn-finance',
        type: 'diagram',
        label: 'Financial Posting',
        category: 'Software Engineering',
        position: { x: 300, y: 460 },
        properties: {
          shape: 'process',
          description: 'Invoice, credit memo, revenue recognition handoff',
          owner: 'Finance',
        },
      },
      {
        id: 'fn-analytics',
        type: 'diagram',
        label: 'Reporting & Insights',
        category: 'Software Engineering',
        position: { x: 520, y: 460 },
        properties: {
          shape: 'process',
          description: 'Operational KPIs, fill rate, SLA dashboards',
          owner: 'BI',
        },
      },

      // Shared / cross-cutting functions
      {
        id: 'fn-identity',
        type: 'diagram',
        label: 'Identity & Access',
        category: 'Software Engineering',
        position: { x: 780, y: 460 },
        properties: {
          shape: 'component',
          description: 'Authentication, authorization, roles',
          owner: 'Security',
        },
      },
      {
        id: 'fn-masterdata',
        type: 'diagram',
        label: 'Master Data',
        category: 'Software Engineering',
        position: { x: 1000, y: 100 },
        properties: {
          shape: 'datastore',
          description: 'Customer, product, location golden records',
          owner: 'Data Governance',
        },
      },
      {
        id: 'fn-rules',
        type: 'diagram',
        label: 'Business Rules',
        category: 'Software Engineering',
        position: { x: 1000, y: 280 },
        properties: {
          shape: 'decision',
          description: 'Eligibility, fraud checks, routing policies',
          owner: 'Order Domain',
        },
      },
      {
        id: 'fn-audit',
        type: 'diagram',
        label: 'Audit & Compliance',
        category: 'Software Engineering',
        position: { x: 1000, y: 460 },
        properties: {
          shape: 'component',
          description: 'Immutable event log, retention, e-discovery',
          owner: 'Compliance',
        },
      },
    ],
    integrations: [
      {
        id: 'fn-int-catalog-capture',
        source: 'fn-catalog',
        target: 'fn-capture',
        label: 'Prices & offers',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'Catalog feeds sellable products into capture',
      },
      {
        id: 'fn-int-capture-promise',
        source: 'fn-capture',
        target: 'fn-promise',
        label: 'Promise request',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'Checkout asks ATP for dates and constraints',
      },
      {
        id: 'fn-int-capture-payment',
        source: 'fn-capture',
        target: 'fn-payment',
        label: 'Authorize',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'Payment authorization at order submit',
      },
      {
        id: 'fn-int-capture-orch',
        source: 'fn-capture',
        target: 'fn-orchestrate',
        label: 'Create order',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'Validated order enters orchestration',
      },
      {
        id: 'fn-int-orch-alloc',
        source: 'fn-orchestrate',
        target: 'fn-allocate',
        label: 'Allocate stock',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'near-real-time',
        dataFormat: 'JSON',
        description: 'Orchestration requests and receives allocation',
      },
      {
        id: 'fn-int-alloc-fulfill',
        source: 'fn-allocate',
        target: 'fn-fulfill',
        label: 'Release to DC',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'near-real-time',
        dataFormat: 'JSON',
        description: 'Allocated lines released for fulfillment',
      },
      {
        id: 'fn-int-fulfill-orch',
        source: 'fn-fulfill',
        target: 'fn-orchestrate',
        label: 'Ship confirm',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'event-driven',
        dataFormat: 'JSON',
        description: 'Shipment events advance order state',
      },
      {
        id: 'fn-int-orch-notify',
        source: 'fn-orchestrate',
        target: 'fn-notify',
        label: 'Status events',
        direction: 'outbound',
        protocol: 'Kafka',
        frequency: 'event-driven',
        dataFormat: 'JSON',
        description: 'Lifecycle milestones trigger customer messages',
      },
      {
        id: 'fn-int-orch-finance',
        source: 'fn-orchestrate',
        target: 'fn-finance',
        label: 'Billable events',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'near-real-time',
        dataFormat: 'JSON',
        description: 'Shipped / returned quantities for posting',
      },
      {
        id: 'fn-int-payment-finance',
        source: 'fn-payment',
        target: 'fn-finance',
        label: 'Capture / refund',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'near-real-time',
        dataFormat: 'JSON',
        description: 'Payment outcomes drive financial documents',
      },
      {
        id: 'fn-int-returns-orch',
        source: 'fn-returns',
        target: 'fn-orchestrate',
        label: 'RMA lifecycle',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'Returns re-enter orchestration for restock/refund',
      },
      {
        id: 'fn-int-orch-analytics',
        source: 'fn-orchestrate',
        target: 'fn-analytics',
        label: 'Operational events',
        direction: 'outbound',
        protocol: 'Kafka',
        frequency: 'event-driven',
        dataFormat: 'JSON',
        description: 'Feed KPIs and SLA reporting',
      },
      {
        id: 'fn-int-md-catalog',
        source: 'fn-masterdata',
        target: 'fn-catalog',
        label: 'Product master',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'scheduled',
        dataFormat: 'JSON',
        description: 'Golden product attributes into catalog',
      },
      {
        id: 'fn-int-md-capture',
        source: 'fn-masterdata',
        target: 'fn-capture',
        label: 'Customer master',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'near-real-time',
        dataFormat: 'JSON',
        description: 'Customer identity and addresses',
      },
      {
        id: 'fn-int-rules-orch',
        source: 'fn-rules',
        target: 'fn-orchestrate',
        label: 'Routing policies',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'Policy decisions during orchestration',
      },
      {
        id: 'fn-int-rules-capture',
        source: 'fn-rules',
        target: 'fn-capture',
        label: 'Eligibility / fraud',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'Checkout eligibility and risk checks',
      },
      {
        id: 'fn-int-id-capture',
        source: 'fn-identity',
        target: 'fn-capture',
        label: 'AuthZ',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JWT',
        description: 'Secure order capture channels',
      },
      {
        id: 'fn-int-orch-audit',
        source: 'fn-orchestrate',
        target: 'fn-audit',
        label: 'Audit trail',
        direction: 'outbound',
        protocol: 'Kafka',
        frequency: 'event-driven',
        dataFormat: 'JSON',
        description: 'Immutable record of state transitions',
      },
      {
        id: 'fn-int-promise-alloc',
        source: 'fn-promise',
        target: 'fn-allocate',
        label: 'Supply picture',
        direction: 'bidirectional',
        protocol: 'REST API',
        frequency: 'near-real-time',
        dataFormat: 'JSON',
        description: 'ATP consults allocation/supply positions',
      },
    ],
    drawings: [
      {
        id: 'fn-zone-primary',
        type: 'rectangle',
        points: [
          { x: 40, y: 40 },
          { x: 960, y: 400 },
        ],
        color: '#0ea5e9',
        strokeWidth: 2,
        fill: '#0ea5e910',
      },
      {
        id: 'fn-zone-primary-label',
        type: 'text',
        points: [{ x: 52, y: 60 }],
        color: '#0ea5e9',
        strokeWidth: 1,
        text: 'Primary Business Functions',
        fontSize: 13,
      },
      {
        id: 'fn-zone-support',
        type: 'rectangle',
        points: [
          { x: 40, y: 420 },
          { x: 720, y: 560 },
        ],
        color: '#10b981',
        strokeWidth: 2,
        fill: '#10b98110',
      },
      {
        id: 'fn-zone-support-label',
        type: 'text',
        points: [{ x: 52, y: 438 }],
        color: '#10b981',
        strokeWidth: 1,
        text: 'Supporting Functions',
        fontSize: 13,
      },
      {
        id: 'fn-zone-shared',
        type: 'rectangle',
        points: [
          { x: 740, y: 420 },
          { x: 1180, y: 560 },
        ],
        color: '#8b5cf6',
        strokeWidth: 2,
        fill: '#8b5cf610',
      },
      {
        id: 'fn-zone-shared-label',
        type: 'text',
        points: [{ x: 752, y: 438 }],
        color: '#8b5cf6',
        strokeWidth: 1,
        text: 'Cross-cutting',
        fontSize: 13,
      },
      {
        id: 'fn-zone-shared-side',
        type: 'rectangle',
        points: [
          { x: 960, y: 40 },
          { x: 1180, y: 400 },
        ],
        color: '#8b5cf6',
        strokeWidth: 2,
        fill: '#8b5cf608',
      },
      {
        id: 'fn-zone-shared-side-label',
        type: 'text',
        points: [{ x: 972, y: 60 }],
        color: '#8b5cf6',
        strokeWidth: 1,
        text: 'Shared Services',
        fontSize: 13,
      },
      {
        id: 'fn-title',
        type: 'text',
        points: [{ x: 40, y: 600 }],
        color: '#334155',
        strokeWidth: 1,
        text: 'Functional Architecture — what the system does (functions & information flows)',
        fontSize: 12,
      },
    ],
  })
}

/** Minimal scaffold sample — labeled zones + notes so every template has a design to edit */
function createBlankScaffoldSample(): ArchitectureDocument {
  return stamp({
    metadata: {
      name: 'Blank Scaffold Sample',
      description:
        'Starter sample design with zones and notes — replace placeholders with your systems and integrations',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems: [
      {
        id: 'blank-zone-left',
        type: 'group',
        label: 'Source Zone',
        category: 'Drawing',
        position: { x: 60, y: 100 },
        properties: { zone: 'Sources', width: '280', height: '320' },
      },
      {
        id: 'blank-zone-mid',
        type: 'group',
        label: 'Platform Zone',
        category: 'Drawing',
        position: { x: 400, y: 100 },
        properties: { zone: 'Platform', width: '280', height: '320' },
      },
      {
        id: 'blank-zone-right',
        type: 'group',
        label: 'Target Zone',
        category: 'Drawing',
        position: { x: 740, y: 100 },
        properties: { zone: 'Targets', width: '280', height: '320' },
      },
      {
        id: 'blank-placeholder-a',
        type: 'cloud',
        label: 'System A',
        category: 'Cloud',
        position: { x: 110, y: 200 },
        properties: {
          description: 'Sample placeholder — rename or replace from the palette',
        },
      },
      {
        id: 'blank-placeholder-b',
        type: 'middleware',
        label: 'Integration Hub',
        category: 'Middleware',
        position: { x: 450, y: 200 },
        properties: {
          description: 'Sample placeholder for your middleware or API layer',
        },
      },
      {
        id: 'blank-placeholder-c',
        type: 'onpremise',
        label: 'System B',
        category: 'On-Premise',
        position: { x: 790, y: 200 },
        properties: {
          description: 'Sample placeholder for a target system of record',
        },
      },
      {
        id: 'blank-note',
        type: 'note',
        label: 'Sticky Note',
        category: 'Drawing',
        position: { x: 400, y: 460 },
        properties: {
          content:
            'Sample design starter: drag palette items, connect systems, then delete placeholders you do not need.',
          width: '280',
          height: '100',
        },
      },
    ],
    integrations: [
      {
        id: 'blank-int-a-b',
        source: 'blank-placeholder-a',
        target: 'blank-placeholder-b',
        label: 'Inbound flow',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'real-time',
        dataFormat: 'JSON',
        description: 'Sample integration — edit protocol, frequency, and interface spec',
      },
      {
        id: 'blank-int-b-c',
        source: 'blank-placeholder-b',
        target: 'blank-placeholder-c',
        label: 'Outbound flow',
        direction: 'outbound',
        protocol: 'REST API',
        frequency: 'near-real-time',
        dataFormat: 'JSON',
        description: 'Sample integration to the target system',
      },
    ],
    drawings: [
      {
        id: 'blank-title',
        type: 'text',
        points: [{ x: 60, y: 48 }],
        color: '#334155',
        strokeWidth: 1,
        text: 'Blank scaffold sample — replace placeholders with your architecture',
        fontSize: 14,
      },
    ],
  })
}

export const ARCHITECTURE_TEMPLATES: ArchitectureTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Scaffold',
    category: 'General',
    description:
      'Lightweight sample design with source / platform / target zones and placeholder systems to build on.',
    highlights: [
      '3 zones + sample flow',
      'Placeholder systems & notes',
      'Edit or clear and redesign',
    ],
    icon: '▢',
    hasSampleDesign: true,
    sampleLabel: 'Zones, 3 systems, 2 integrations',
    create: createBlankScaffoldSample,
  },
  {
    id: 'enterprise',
    name: 'Enterprise Architecture',
    category: 'Architecture Style',
    description:
      'Sample layered EA design: business capabilities, application portfolio, integration/API, data platform, and technology/security.',
    highlights: [
      '5 architecture layers',
      'CRM · ERP · HCM · ITSM',
      'iPaaS + APIM + MDM + lakehouse',
    ],
    icon: '🏛',
    hasSampleDesign: true,
    sampleLabel: 'Full layered EA portfolio sample',
    create: createEnterpriseArchitecture,
  },
  {
    id: 'solution',
    name: 'Solution Architecture',
    category: 'Architecture Style',
    description:
      'Sample C4-style solution design for order management: actors, containers, APIs, services, data stores, and external systems.',
    highlights: [
      'People · Solution · External zones',
      'Drill-in Order Service detail',
      'Payments · ERP · Shipping deps',
    ],
    icon: '◇',
    hasSampleDesign: true,
    sampleLabel: 'Order platform + service drill-in sample',
    create: createSolutionArchitecture,
  },
  {
    id: 'contextual',
    name: 'Contextual Architecture',
    category: 'Architecture Style',
    description:
      'Sample system-context design: system of interest surrounded by actors, peer systems, and external dependencies.',
    highlights: [
      'System of interest center',
      'Actors · CRM · ERP · WMS · carriers',
      'High-level interaction contracts',
    ],
    icon: '◎',
    hasSampleDesign: true,
    sampleLabel: 'System-of-interest context sample',
    create: createContextualArchitecture,
  },
  {
    id: 'functional',
    name: 'Functional Architecture',
    category: 'Architecture Style',
    description:
      'Sample functional decomposition: primary business functions, supporting functions, shared services, and information flows.',
    highlights: [
      'Capture → orchestrate → fulfill',
      'ATP · payment · returns · finance',
      'Master data · rules · audit',
    ],
    icon: '⚙',
    hasSampleDesign: true,
    sampleLabel: 'Order domain functions sample',
    create: createFunctionalArchitecture,
  },
  {
    id: 'banking',
    name: 'Banking Enterprise',
    category: 'Industry',
    description:
      'Bank enterprise systems: digital channels, core banking, payments hub, cards, KYC/AML, risk, treasury, and SWIFT.',
    highlights: [
      'Mobile · IB · Branch · ATM',
      'Core · Payments · Cards · CRM',
      'KYC · AML · Risk · SWIFT',
    ],
    icon: '🏦',
    hasSampleDesign: true,
    sampleLabel: 'Retail/corporate bank systems sample',
    create: createBankingEnterprise,
  },
  {
    id: 'healthcare',
    name: 'Healthcare Enterprise',
    category: 'Industry',
    description:
      'Hospital/health-system landscape: patient portal, EHR, ancillary (LIS/PACS/pharmacy), FHIR gateway, RCM, and HIE.',
    highlights: [
      'EHR · HIS · LIS · RIS/PACS',
      'FHIR / HL7 integration',
      'Billing · EMPI · Population health',
    ],
    icon: '🏥',
    hasSampleDesign: true,
    sampleLabel: 'Provider clinical & interop sample',
    create: createHealthcareEnterprise,
  },
  {
    id: 'insurance',
    name: 'Insurance Enterprise',
    category: 'Industry',
    description:
      'Insurer systems: portals, policy admin, rating, underwriting, claims, billing, CRM, fraud, reinsurance, and bureaus.',
    highlights: [
      'Quote-to-bind · FNOL',
      'Policy · UW · Claims · Billing',
      'Bureaus · Reinsurance · SIU',
    ],
    icon: '🛡',
    hasSampleDesign: true,
    sampleLabel: 'P&C / life insurer systems sample',
    create: createInsuranceEnterprise,
  },
  {
    id: 'telco',
    name: 'Telco Enterprise',
    category: 'Industry',
    description:
      'CSP landscape: digital channels, BSS (catalog/billing/order), OSS (inventory/fulfillment/assurance), and 5G network.',
    highlights: [
      'BSS · OSS · Network layers',
      'Catalog · OCS · COM/SOM',
      '5G core · Mediation · Partners',
    ],
    icon: '📶',
    hasSampleDesign: true,
    sampleLabel: 'Communications service provider sample',
    create: createTelcoEnterprise,
  },
  {
    id: 'infra-aws',
    name: 'AWS Landing Zone',
    category: 'Infrastructure',
    description:
      'AWS edge, public/private subnets, EKS compute, data stores, IAM, and observability.',
    highlights: [
      'Route 53 · CloudFront · WAF',
      'ALB · NAT · EKS · Lambda',
      'RDS · S3 · IAM · CloudWatch',
    ],
    icon: '🟠',
    hasSampleDesign: true,
    sampleLabel: 'VPC-style AWS infrastructure sample',
    create: createAwsLandingZone,
  },
  {
    id: 'infra-azure',
    name: 'Azure Landing Zone',
    category: 'Infrastructure',
    description:
      'Hub-and-spoke Azure design: Front Door, Firewall, App Gateway, AKS, data, and Entra ID.',
    highlights: [
      'Hub VNet · Spoke VNet',
      'Front Door · Firewall · App GW',
      'AKS · SQL · Key Vault · Monitor',
    ],
    icon: '🔷',
    hasSampleDesign: true,
    sampleLabel: 'Azure hub-spoke landing zone sample',
    create: createAzureLandingZone,
  },
  {
    id: 'infra-kubernetes',
    name: 'Kubernetes Platform',
    category: 'Infrastructure',
    description:
      'Cluster platform: ingress, APIs, workers, cache, database, registry, secrets, and GitOps.',
    highlights: [
      'Ingress · Services · Workers',
      'Redis · Postgres',
      'Registry · Secrets · Observability',
    ],
    icon: '⎈',
    hasSampleDesign: true,
    sampleLabel: 'Kubernetes workload platform sample',
    create: createKubernetesPlatform,
  },
  {
    id: 'infra-hybrid',
    name: 'Hybrid Infrastructure',
    category: 'Infrastructure',
    description:
      'Datacenter to cloud: AD, firewall, ExpressRoute/Direct Connect, VPN, hub services, and spokes.',
    highlights: [
      'On-prem DC · Firewall',
      'Private circuit + VPN backup',
      'Hub · Spoke · Hybrid DNS',
    ],
    icon: '☁',
    hasSampleDesign: true,
    sampleLabel: 'Hybrid connectivity landing zone sample',
    create: createHybridInfrastructure,
  },
  {
    id: 'ai-rag',
    name: 'Enterprise RAG Copilot',
    category: 'AI',
    description:
      'GenAI sample: channels and APIM in front of a prompt orchestrator, RAG index, multi-model LLM gateway, and identity-aware knowledge sources.',
    highlights: [
      'Copilot UI · APIM · orchestrator',
      'Vector index · indexer · ACLs',
      'LLM gateway drill-in (SpaceXAI + Azure OpenAI)',
    ],
    icon: '✦',
    hasSampleDesign: true,
    sampleLabel: 'Grounded enterprise copilot sample',
    create: createEnterpriseRag,
  },
  {
    id: 'ai-mlops',
    name: 'MLOps Platform',
    category: 'AI',
    description:
      'ML lifecycle sample: lake and feature store, training and experiments, model registry, online/batch serving, and drift monitoring.',
    highlights: [
      'Lake · feature store',
      'Train · registry · CI/CD',
      'Online predict · batch score · drift',
    ],
    icon: '◎',
    hasSampleDesign: true,
    sampleLabel: 'Model lifecycle platform sample',
    create: createMlOpsPlatform,
  },
  {
    id: 'ai-agents',
    name: 'Agentic AI Runtime',
    category: 'AI',
    description:
      'Agent sample: workbench, planner/executor, MCP tool gateway, enterprise APIs, memory, LLM, and human-in-the-loop.',
    highlights: [
      'Planner · executor · policy',
      'MCP / tool gateway',
      'Memory · audit · HITL',
    ],
    icon: '🤖',
    hasSampleDesign: true,
    sampleLabel: 'Tool-using agent runtime sample',
    create: createAgenticAi,
  },
  {
    id: 'ai-azure',
    name: 'Azure AI Landing Zone',
    category: 'AI',
    description:
      'Azure AI platform sample: Front Door, APIM, AI Foundry, Azure OpenAI, AI Search, Document Intelligence, Content Safety, and Entra ID.',
    highlights: [
      'Foundry · Azure OpenAI',
      'AI Search · Document Intelligence',
      'Copilot Studio channel',
    ],
    icon: '🔷',
    hasSampleDesign: true,
    sampleLabel: 'Azure AI Foundry platform sample',
    create: createAzureAiLanding,
  },
  {
    id: 'integration',
    name: 'Enterprise Integration',
    category: 'Integration',
    description:
      'Sample end-to-end integration design: SaaS → iPaaS/cloud middleware → on-premise ERP and analytics.',
    highlights: [
      'SaaS · Cloud · On-Prem zones',
      'MuleSoft drill-in sub-diagram',
      'Kafka · API Gateway · Snowflake',
    ],
    icon: '🔗',
    hasSampleDesign: true,
    sampleLabel: 'SaaS–cloud–on-prem integration sample',
    create: () => cloneDoc(sampleArchitecture as ArchitectureDocument),
  },
]

export const TEMPLATE_CATEGORY_ORDER: ArchitectureTemplateCategory[] = [
  'General',
  'Architecture Style',
  'Industry',
  'Infrastructure',
  'AI',
  'Integration',
]

export function getTemplatesByCategory(): {
  category: ArchitectureTemplateCategory
  templates: ArchitectureTemplate[]
}[] {
  return TEMPLATE_CATEGORY_ORDER.map((category) => ({
    category,
    templates: ARCHITECTURE_TEMPLATES.filter((t) => t.category === category),
  })).filter((g) => g.templates.length > 0)
}

export function getTemplate(id: ArchitectureTemplateId): ArchitectureTemplate {
  const found = ARCHITECTURE_TEMPLATES.find((t) => t.id === id)
  if (!found) throw new Error(`Unknown template: ${id}`)
  return found
}

export function createFromTemplate(id: ArchitectureTemplateId): ArchitectureDocument {
  return getTemplate(id).create()
}
