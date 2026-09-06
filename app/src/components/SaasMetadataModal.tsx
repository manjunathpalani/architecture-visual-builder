import { useMemo, useState } from 'react'
import { Database, Loader2, LogIn, Table2, X } from 'lucide-react'
import { CloudApiError, openSignInWindow, signInWithDynamics } from '../utils/cloud/oauth'
import { fetchSaasCatalog, fetchSaasRelationships, sampleDynamicsCatalog } from '../utils/saas/catalog'
import { getSaasConnection, setSaasConnection } from '../utils/saas/credentials'
import { isCoreDynamicsTable, resolveDynamicsToken } from '../utils/saas/dynamicsApi'
import { SaasApiError, normalizeInstanceUrl } from '../utils/saas/instanceUrl'
import type { SaasCatalog, SaasImportMode, SaasProviderId } from '../utils/saas/types'
import type { SaasImportPayload } from '../utils/saas/mapToDiagram'

interface SaasMetadataModalProps {
  targetSystemId?: string
  targetSystemLabel?: string
  onImport: (payload: SaasImportPayload) => void
  onClose: () => void
}

const PROVIDERS: Array<{ id: SaasProviderId; label: string; hint: string; placeholder: string }> = [
  {
    id: 'dynamics',
    label: 'Dynamics 365 / Dataverse',
    hint: 'Tables, lookups, and the org data model',
    placeholder: 'https://contoso.crm.dynamics.com',
  },
  {
    id: 'salesforce',
    label: 'Salesforce',
    hint: 'sObjects and lookup relationships',
    placeholder: 'https://yourorg.my.salesforce.com',
  },
]

export function SaasMetadataModal({
  targetSystemId,
  targetSystemLabel,
  onImport,
  onClose,
}: SaasMetadataModalProps) {
  const stored = getSaasConnection('dynamics')
  const [provider, setProvider] = useState<SaasProviderId>('dynamics')
  const [instanceUrl, setInstanceUrl] = useState(stored?.instanceUrl ?? '')
  const [token, setToken] = useState('')
  const [tenant, setTenant] = useState(stored?.tenant ?? 'common')
  const [query, setQuery] = useState('')
  const [customOnly, setCustomOnly] = useState(false)
  const [mode, setMode] = useState<SaasImportMode>(targetSystemId ? 'sub-diagram' : 'sub-diagram')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<SaasCatalog | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const providerInfo = PROVIDERS.find((item) => item.id === provider)!

  const visible = useMemo(() => {
    if (!catalog) return []
    const q = query.trim().toLowerCase()
    return catalog.entities.filter((entity) => {
      if (customOnly && !entity.isCustom && !isCoreDynamicsTable(entity.logicalName)) return false
      if (!q) return true
      return (
        entity.label.toLowerCase().includes(q) ||
        entity.logicalName.toLowerCase().includes(q) ||
        (entity.schemaName ?? '').toLowerCase().includes(q)
      )
    })
  }, [catalog, customOnly, query])

  const selectedEntities = useMemo(
    () => (catalog ? catalog.entities.filter((entity) => selectedIds.has(entity.key)) : []),
    [catalog, selectedIds],
  )

  const applyCatalog = (next: SaasCatalog) => {
    setCatalog(next)
    const preferred = next.entities.filter((entity) => entity.isCustom || isCoreDynamicsTable(entity.logicalName))
    const pick = preferred.length > 0 ? preferred : next.entities.slice(0, 24)
    setSelectedIds(new Set(pick.map((entity) => entity.key)))
    setError(null)
  }

  const handleProvider = (id: SaasProviderId) => {
    setProvider(id)
    setCatalog(null)
    setSelectedIds(new Set())
    setError(null)
    const saved = getSaasConnection(id)
    if (saved?.instanceUrl) setInstanceUrl(saved.instanceUrl)
  }

  const handleSignIn = async () => {
    const popup = openSignInWindow()
    setLoading(true)
    setError(null)
    try {
      await signInWithDynamics({ instanceUrl, tenant, popup })
      const url = normalizeInstanceUrl(instanceUrl, 'dynamics')
      const access = await resolveDynamicsToken(url)
      const next = await fetchSaasCatalog('dynamics', url, access)
      setInstanceUrl(url)
      applyCatalog(next)
    } catch (err) {
      setCatalog(null)
      setError(err instanceof Error ? err.message : 'Could not sign in to Dynamics 365')
    } finally {
      setLoading(false)
    }
  }

  const handleFetch = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = normalizeInstanceUrl(instanceUrl, provider)
      let access = token.trim()
      if (!access) {
        if (provider !== 'dynamics') {
          throw new SaasApiError('Paste a Salesforce access token')
        }
        access = await resolveDynamicsToken(url)
      } else if (provider === 'dynamics') {
        setSaasConnection('dynamics', {
          provider: 'dynamics',
          instanceUrl: url,
          accessToken: access,
          tenant,
          clientId: undefined,
        })
      } else {
        setSaasConnection('salesforce', {
          provider: 'salesforce',
          instanceUrl: url,
          accessToken: access,
        })
      }
      const next = await fetchSaasCatalog(provider, url, access)
      setInstanceUrl(url)
      applyCatalog(next)
    } catch (err) {
      setCatalog(null)
      setError(
        err instanceof CloudApiError || err instanceof SaasApiError || err instanceof Error
          ? err.message
          : 'Could not read metadata',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSample = () => {
    applyCatalog(sampleDynamicsCatalog())
    setProvider('dynamics')
    setInstanceUrl('https://sample.crm.dynamics.com')
  }

  const toggle = (key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleImport = async () => {
    if (!catalog || selectedEntities.length === 0) return
    setImporting(true)
    setError(null)
    try {
      const access =
        token.trim() ||
        (catalog.sample ? undefined : getSaasConnection(catalog.provider)?.accessToken)
      const relationships = await fetchSaasRelationships(
        catalog,
        access,
        selectedEntities.map((entity) => entity.logicalName),
      )
      const summary =
        catalog.sample
          ? `Imported sample Dynamics data model (${selectedEntities.length} tables)`
          : `Imported ${selectedEntities.length} tables from ${catalog.providerLabel}`
      onImport({
        catalog,
        entities: selectedEntities,
        relationships,
        mode,
        targetSystemId: mode === 'sub-diagram' ? targetSystemId : undefined,
        summary,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import metadata')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="swagger-overlay" onClick={onClose}>
      <div className="swagger-modal saas-metadata-modal" onClick={(event) => event.stopPropagation()}>
        <div className="swagger-modal-header">
          <div>
            <h2>
              <Database size={20} />
              SaaS metadata
            </h2>
            <p>
              Connect a Dynamics 365 / Dataverse or Salesforce instance, pick tables, and import them as a
              data-model diagram
              {targetSystemLabel ? ` on “${targetSystemLabel}”` : ''}.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="swagger-modal-body">
          <div className="spec-mode-tabs">
            {PROVIDERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`spec-mode-tab ${provider === item.id ? 'active' : ''}`}
                onClick={() => handleProvider(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label>
            Instance URL
            <input
              placeholder={providerInfo.placeholder}
              value={instanceUrl}
              onChange={(event) => setInstanceUrl(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void handleFetch()}
            />
          </label>

          {provider === 'dynamics' && (
            <label>
              Tenant (optional)
              <input
                placeholder="common or directory ID"
                value={tenant}
                onChange={(event) => setTenant(event.target.value)}
              />
            </label>
          )}

          <label>
            Access token {provider === 'dynamics' ? '(optional if you sign in)' : ''}
            <input
              type="password"
              autoComplete="off"
              placeholder={
                provider === 'dynamics'
                  ? 'az account get-access-token --resource https://org.crm.dynamics.com'
                  : 'Salesforce OAuth access token'
              }
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </label>

          <div className="swagger-url-row">
            {provider === 'dynamics' && (
              <button
                type="button"
                className="btn-secondary"
                disabled={loading || !instanceUrl.trim()}
                onClick={() => void handleSignIn()}
              >
                {loading ? <Loader2 size={14} className="spin" /> : <LogIn size={14} />}
                Sign in with Microsoft
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              disabled={loading || !instanceUrl.trim()}
              onClick={() => void handleFetch()}
            >
              {loading ? <Loader2 size={14} className="spin" /> : <Table2 size={14} />}
              Read metadata
            </button>
            <button type="button" className="btn-secondary" disabled={loading} onClick={handleSample}>
              Sample Dynamics model
            </button>
          </div>

          <p className="code-link-hint">
            {provider === 'dynamics'
              ? 'The org is called through this app’s local proxy. Register Dynamics CRM user_impersonation on your Microsoft SPA, or paste a token for that resource.'
              : 'Paste a Salesforce access token for the instance. Metadata is read through this app’s local proxy.'}
          </p>

          {error && <div className="swagger-error">{error}</div>}

          {catalog && (
            <>
              <div className="swagger-summary">
                <strong>{catalog.organizationName || catalog.providerLabel}</strong>
                {catalog.sample && <span>Sample</span>}
                <code>{catalog.instanceUrl}</code>
                <span>
                  {catalog.entities.length} table{catalog.entities.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="swagger-options">
                <label className="swagger-option">
                  Place as
                  <select value={mode} onChange={(event) => setMode(event.target.value as SaasImportMode)}>
                    <option value="sub-diagram">
                      {targetSystemLabel
                        ? `Sub-diagram of “${targetSystemLabel}”`
                        : 'New SaaS system with a data-model sub-diagram'}
                    </option>
                    <option value="canvas">Tables on the current canvas</option>
                  </select>
                </label>
                <label className="swagger-option saas-filter-toggle">
                  <input
                    type="checkbox"
                    checked={customOnly}
                    onChange={(event) => setCustomOnly(event.target.checked)}
                  />
                  Custom + core CRM tables
                </label>
              </div>

              <label>
                Filter tables
                <input
                  placeholder="Account, contact, new_…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>

              <div className="swagger-preview-header">
                <span className="color-picker-label">
                  Tables ({selectedEntities.length}/{visible.length} shown selected)
                </span>
                <div className="swagger-select-actions">
                  <button
                    type="button"
                    className="btn-reset-color"
                    onClick={() => setSelectedIds(new Set(visible.map((entity) => entity.key)))}
                  >
                    Select visible
                  </button>
                  <button type="button" className="btn-reset-color" onClick={() => setSelectedIds(new Set())}>
                    None
                  </button>
                </div>
              </div>

              <div className="swagger-component-list saas-entity-list">
                {visible.map((entity) => (
                  <label
                    key={entity.key}
                    className={`swagger-component-card ${selectedIds.has(entity.key) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entity.key)}
                      onChange={() => toggle(entity.key)}
                    />
                    <span className="swagger-component-body">
                      <span className="swagger-component-title">
                        {entity.label}
                        {entity.isCustom && <span className="saas-custom-badge">Custom</span>}
                      </span>
                      <span className="swagger-component-desc">
                        <code>{entity.logicalName}</code>
                        {entity.description ? ` · ${entity.description}` : ''}
                      </span>
                    </span>
                  </label>
                ))}
                {visible.length === 0 && (
                  <p className="code-link-hint">No tables match this filter.</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="swagger-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={importing || selectedEntities.length === 0}
            onClick={() => void handleImport()}
          >
            {importing ? <Loader2 size={14} className="spin" /> : <Database size={14} />}
            Import {selectedEntities.length || ''} table{selectedEntities.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  )
}
