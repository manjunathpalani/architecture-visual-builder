import type { SaasCatalog, SaasRelationship } from '../utils/saas/types'

export const SAMPLE_DYNAMICS_RELATIONSHIPS: SaasRelationship[] = [
  { id: 'contact_customer_accounts', schemaName: 'contact_customer_accounts', label: 'Company', from: 'contact', to: 'account' },
  { id: 'opportunity_parent_account', schemaName: 'opportunity_parent_account', label: 'Account', from: 'opportunity', to: 'account' },
  { id: 'opportunity_parent_contact', schemaName: 'opportunity_parent_contact', label: 'Contact', from: 'opportunity', to: 'contact' },
  { id: 'lead_parent_account', schemaName: 'lead_parent_account', label: 'Account', from: 'lead', to: 'account' },
  { id: 'incident_customer_accounts', schemaName: 'incident_customer_accounts', label: 'Customer', from: 'incident', to: 'account' },
  { id: 'incident_customer_contacts', schemaName: 'incident_customer_contacts', label: 'Contact', from: 'incident', to: 'contact' },
  { id: 'quote_customer_accounts', schemaName: 'quote_customer_accounts', label: 'Customer', from: 'quote', to: 'account' },
  { id: 'salesorder_customer_accounts', schemaName: 'salesorder_customer_accounts', label: 'Customer', from: 'salesorder', to: 'account' },
  { id: 'systemuser_businessunit', schemaName: 'business_unit_system_users', label: 'Business unit', from: 'systemuser', to: 'businessunit' },
]

export const SAMPLE_DYNAMICS_CATALOG: SaasCatalog = {
  provider: 'dynamics',
  providerLabel: 'Dynamics 365 / Dataverse',
  instanceUrl: 'https://sample.crm.dynamics.com',
  organizationName: 'Sample Contoso CRM',
  sample: true,
  entities: [
    { key: 'account', logicalName: 'account', schemaName: 'Account', label: 'Account', collectionLabel: 'Accounts', description: 'Companies and organizations', isCustom: false, primaryName: 'name' },
    { key: 'contact', logicalName: 'contact', schemaName: 'Contact', label: 'Contact', collectionLabel: 'Contacts', description: 'People related to accounts', isCustom: false, primaryName: 'fullname' },
    { key: 'lead', logicalName: 'lead', schemaName: 'Lead', label: 'Lead', collectionLabel: 'Leads', description: 'Unqualified prospects', isCustom: false, primaryName: 'fullname' },
    { key: 'opportunity', logicalName: 'opportunity', schemaName: 'Opportunity', label: 'Opportunity', collectionLabel: 'Opportunities', description: 'Sales deals in progress', isCustom: false, primaryName: 'name' },
    { key: 'incident', logicalName: 'incident', schemaName: 'Incident', label: 'Case', collectionLabel: 'Cases', description: 'Customer service cases', isCustom: false, primaryName: 'title' },
    { key: 'quote', logicalName: 'quote', schemaName: 'Quote', label: 'Quote', collectionLabel: 'Quotes', isCustom: false, primaryName: 'name' },
    { key: 'salesorder', logicalName: 'salesorder', schemaName: 'SalesOrder', label: 'Order', collectionLabel: 'Orders', isCustom: false, primaryName: 'name' },
    { key: 'product', logicalName: 'product', schemaName: 'Product', label: 'Product', collectionLabel: 'Products', isCustom: false, primaryName: 'name' },
    { key: 'systemuser', logicalName: 'systemuser', schemaName: 'SystemUser', label: 'User', collectionLabel: 'Users', isCustom: false, primaryName: 'fullname' },
    { key: 'businessunit', logicalName: 'businessunit', schemaName: 'BusinessUnit', label: 'Business Unit', collectionLabel: 'Business Units', isCustom: false, primaryName: 'name' },
    { key: 'new_subscription', logicalName: 'new_subscription', schemaName: 'new_subscription', label: 'Subscription', collectionLabel: 'Subscriptions', description: 'Custom table for recurring products', isCustom: true, primaryName: 'new_name' },
    { key: 'new_entitlementtier', logicalName: 'new_entitlementtier', schemaName: 'new_entitlementtier', label: 'Entitlement Tier', collectionLabel: 'Entitlement Tiers', isCustom: true, primaryName: 'new_name' },
  ],
}
