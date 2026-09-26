import { Plus, Shield, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { SystemProperties } from '../types'
import { NFR_INDUSTRIES, NFR_TEMPLATES, getNfrTemplate } from '../data/nfrTemplates'
import {
  appendTemplateToText,
  applyNfrTemplate,
  nfrSummary,
  parseAppliedNfrs,
  removeAppliedNfr,
  serializeAppliedNfrs,
  type AppliedNfr,
} from '../utils/nfrCatalog'

interface NfrTemplateSectionProps {
  properties?: SystemProperties
  onChange: (properties: SystemProperties) => void
}

export function NfrTemplateSection({ properties, onChange }: NfrTemplateSectionProps) {
  const applied = parseAppliedNfrs(properties)
  const [industry, setIndustry] = useState('General')
  const templates = useMemo(
    () => NFR_TEMPLATES.filter((item) => item.industry === industry),
    [industry],
  )
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? NFR_TEMPLATES[0].id)
  const template = getNfrTemplate(templateId) ?? templates[0]
  const already = template ? applied.some((item) => item.templateId === template.id) : false

  const setNfrs = (next: AppliedNfr[]) => {
    onChange({ ...properties, nfrs: next.length ? serializeAppliedNfrs(next) : undefined })
  }

  return (
    <div className="nfr-template-section">
      <p className="code-link-hint">
        Apply industry-standard NFR packs to this system. They feed the SAD and feature work.
      </p>
      <div className="nfr-template-filters">
        {NFR_INDUSTRIES.map((item) => (
          <button
            key={item}
            type="button"
            className={`ai-lens-chip ${industry === item ? 'active' : ''}`}
            onClick={() => {
              setIndustry(item)
              const first = NFR_TEMPLATES.find((pack) => pack.industry === item)
              if (first) setTemplateId(first.id)
            }}
          >
            {item}
          </button>
        ))}
      </div>
      <label>
        Template
        <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.items.length})
            </option>
          ))}
        </select>
      </label>
      {template && (
        <>
          <p className="code-link-hint">
            {template.standard} · {template.description}
          </p>
          <ul className="nfr-template-preview">
            {template.items.slice(0, 4).map((item) => (
              <li key={item.id}>
                <strong>{item.category}:</strong> {item.requirement}
              </li>
            ))}
            {template.items.length > 4 && <li>+{template.items.length - 4} more</li>}
          </ul>
          <button
            type="button"
            className="btn-primary"
            disabled={already}
            onClick={() => setNfrs(applyNfrTemplate(applied, template.id))}
          >
            <Plus size={14} />
            {already ? 'Already applied' : `Apply ${template.items.length} NFRs`}
          </button>
        </>
      )}
      {applied.length > 0 && (
        <div className="nfr-applied">
          <h4>
            <Shield size={14} /> {nfrSummary(applied)}
          </h4>
          <ul>
            {applied.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>{item.category}</strong> · {item.requirement}
                  <em>{item.templateName}</em>
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  title="Remove NFR"
                  onClick={() => setNfrs(removeAppliedNfr(applied, item.id))}
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function NfrTemplateInsert({
  value,
  onChange,
}: {
  value?: string
  onChange: (next: string) => void
}) {
  const [templateId, setTemplateId] = useState(NFR_TEMPLATES[0].id)
  const template = getNfrTemplate(templateId)
  return (
    <div className="nfr-insert-row">
      <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
        {NFR_TEMPLATES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.industry}: {item.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => template && onChange(appendTemplateToText(value, template))}
      >
        Insert template
      </button>
    </div>
  )
}


