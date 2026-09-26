import type { SystemProperties, SystemType } from '../types'
import type { DiagramInfrastructure } from '../utils/cloudInfrastructure'
import {
  CLOUD_PROVIDERS,
  ENVIRONMENTS,
  HA_MODES,
  SKU_TIERS,
  haModeLabel,
  providerForType,
  regionsForProvider,
} from '../utils/cloudInfrastructure'

interface CloudInfrastructureSectionProps {
  mode: 'diagram' | 'component'
  systemType?: SystemType
  diagram?: DiagramInfrastructure
  properties?: SystemProperties
  onChangeDiagram?: (patch: DiagramInfrastructure) => void
  onChangeProperties?: (patch: SystemProperties) => void
  onCopyFromDiagram?: () => void
}

export function CloudInfrastructureSection({
  mode,
  systemType,
  diagram,
  properties,
  onChangeDiagram,
  onChangeProperties,
  onCopyFromDiagram,
}: CloudInfrastructureSectionProps) {
  const isDiagram = mode === 'diagram'
  const provider = isDiagram
    ? diagram?.cloudProvider ?? ''
    : providerForType(systemType, properties?.cloudProvider)
  const regions = regionsForProvider(provider)
  const regionValue = isDiagram ? diagram?.primaryRegion ?? '' : properties?.region ?? ''

  const setDiagram = (key: keyof DiagramInfrastructure, value: string) => {
    onChangeDiagram?.({ ...diagram, [key]: value || undefined })
  }

  const setProp = (key: string, value: string) => {
    onChangeProperties?.({ ...properties, [key]: value || undefined })
  }

  return (
    <div className="cloud-infra-section">
      {!isDiagram && onCopyFromDiagram && (
        <button type="button" className="btn-secondary" onClick={onCopyFromDiagram}>
          Copy from diagram landing zone
        </button>
      )}
      <label>
        Cloud provider
        <select
          value={provider}
          onChange={(event) =>
            isDiagram ? setDiagram('cloudProvider', event.target.value) : setProp('cloudProvider', event.target.value)
          }
        >
          <option value="">Select…</option>
          {CLOUD_PROVIDERS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        {isDiagram ? 'Primary region' : 'Region'}
        {regions.length > 0 ? (
          <select
            value={regionValue}
            onChange={(event) =>
              isDiagram ? setDiagram('primaryRegion', event.target.value) : setProp('region', event.target.value)
            }
          >
            <option value="">Select…</option>
            {regions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.id})
              </option>
            ))}
            {regionValue && !regions.some((item) => item.id === regionValue) && (
              <option value={regionValue}>{regionValue}</option>
            )}
          </select>
        ) : (
          <input
            value={regionValue}
            placeholder="e.g. eastus or us-east-1"
            onChange={(event) =>
              isDiagram ? setDiagram('primaryRegion', event.target.value) : setProp('region', event.target.value)
            }
          />
        )}
      </label>
      <label>
        Environment
        <select
          value={(isDiagram ? diagram?.environment : properties?.environment) ?? ''}
          onChange={(event) =>
            isDiagram ? setDiagram('environment', event.target.value) : setProp('environment', event.target.value)
          }
        >
          <option value="">Select…</option>
          {ENVIRONMENTS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        {isDiagram ? 'Landing zone / subscription name' : 'Subscription / account'}
        <input
          value={(isDiagram ? diagram?.subscription : properties?.subscription) ?? ''}
          placeholder={isDiagram ? 'Landing zone or subscription' : 'Subscription, account, or project'}
          onChange={(event) =>
            isDiagram ? setDiagram('subscription', event.target.value) : setProp('subscription', event.target.value)
          }
        />
      </label>
      {isDiagram ? (
        <label>
          Landing zone / resource group
          <input
            value={diagram?.landingZone ?? ''}
            placeholder="e.g. lz-prod-app"
            onChange={(event) => setDiagram('landingZone', event.target.value)}
          />
        </label>
      ) : (
        <>
          <label>
            Resource group / project
            <input
              value={properties?.resourceGroup ?? ''}
              placeholder="Resource group, VPC project, or RG"
              onChange={(event) => setProp('resourceGroup', event.target.value)}
            />
          </label>
          <label>
            Resource name
            <input
              value={properties?.resourceName ?? ''}
              onChange={(event) => setProp('resourceName', event.target.value)}
            />
          </label>
          <div className="cloud-infra-grid">
            <label>
              SKU / instance
              <input
                value={properties?.sku ?? ''}
                placeholder="P1v3, Standard_D4s_v5, db.r6g.large"
                onChange={(event) => setProp('sku', event.target.value)}
              />
            </label>
            <label>
              SKU tier
              <select value={properties?.skuTier ?? ''} onChange={(event) => setProp('skuTier', event.target.value)}>
                <option value="">Select…</option>
                {SKU_TIERS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="cloud-infra-grid">
            <label>
              Compute size
              <input
                value={properties?.instanceSize ?? ''}
                placeholder="4 vCPU / 16 GB"
                onChange={(event) => setProp('instanceSize', event.target.value)}
              />
            </label>
            <label>
              Storage
              <input
                value={properties?.storageSize ?? ''}
                placeholder="256 GB Premium SSD"
                onChange={(event) => setProp('storageSize', event.target.value)}
              />
            </label>
          </div>
          <div className="cloud-infra-grid">
            <label>
              Network / VNet / VPC
              <input
                value={properties?.network ?? ''}
                placeholder="vnet-prod-app"
                onChange={(event) => setProp('network', event.target.value)}
              />
            </label>
            <label>
              Subnet
              <input
                value={properties?.subnet ?? ''}
                placeholder="snet-app"
                onChange={(event) => setProp('subnet', event.target.value)}
              />
            </label>
          </div>
          <label>
            Availability zones
            <input
              value={properties?.availabilityZones ?? ''}
              placeholder="1, 2, 3"
              onChange={(event) => setProp('availabilityZones', event.target.value)}
            />
          </label>
          <label>
            High availability
            <select value={properties?.haMode ?? ''} onChange={(event) => setProp('haMode', event.target.value)}>
              <option value="">Select…</option>
              {HA_MODES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            {properties?.haMode && (
              <span className="code-link-hint">{haModeLabel(properties.haMode)}</span>
            )}
          </label>
          <div className="cloud-infra-grid">
            <label>
              SLA
              <input
                value={properties?.sla ?? ''}
                placeholder="99.9%"
                onChange={(event) => setProp('sla', event.target.value)}
              />
            </label>
            <label>
              Estimated cost
              <input
                value={properties?.estimatedCost ?? ''}
                placeholder="$ / month"
                onChange={(event) => setProp('estimatedCost', event.target.value)}
              />
            </label>
          </div>
          <label>
            Resource ID
            <input
              value={properties?.resourceId ?? ''}
              placeholder="/subscriptions/…/resourceGroups/…"
              onChange={(event) => setProp('resourceId', event.target.value)}
            />
          </label>
        </>
      )}
    </div>
  )
}
