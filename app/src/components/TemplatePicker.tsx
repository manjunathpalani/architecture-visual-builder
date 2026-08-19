import {
  Building2,
  Cloud,
  HeartPulse,
  Landmark,
  Layers,
  Link2,
  Network,
  Radio,
  Server,
  Shield,
  Square,
  Workflow,
  X,
} from 'lucide-react'
import {
  getTemplatesByCategory,
  getTemplateSampleStats,
  type ArchitectureTemplate,
  type ArchitectureTemplateId,
} from '../data/templates'
import { TemplateSamplePreview } from './TemplateSamplePreview'

interface TemplatePickerProps {
  mode?: 'project' | 'sub-tab'
  onSelect: (id: ArchitectureTemplateId) => void
  onClose: () => void
}

const TEMPLATE_ICONS: Record<ArchitectureTemplateId, typeof Square> = {
  blank: Square,
  enterprise: Building2,
  solution: Layers,
  contextual: Network,
  functional: Workflow,
  integration: Link2,
  banking: Landmark,
  healthcare: HeartPulse,
  insurance: Shield,
  telco: Radio,
  'infra-aws': Cloud,
  'infra-azure': Cloud,
  'infra-kubernetes': Server,
  'infra-hybrid': Network,
}

function TemplateCard({
  template,
  onSelect,
  cta,
}: {
  template: ArchitectureTemplate
  onSelect: (id: ArchitectureTemplateId) => void
  cta: string
}) {
  const Icon = TEMPLATE_ICONS[template.id]
  const stats = getTemplateSampleStats(template.id)

  return (
    <button
      type="button"
      className={`template-card template-card-${template.id}`}
      onClick={() => onSelect(template.id)}
    >
      <div className="template-card-top">
        <div className="template-card-icon">
          <Icon size={20} />
        </div>
        <div className="template-card-meta">
          <span className="template-card-category">{template.category}</span>
          <span className="template-sample-badge">Sample design</span>
        </div>
      </div>

      <TemplateSamplePreview id={template.id} />

      <div className="template-card-body">
        <h3>{template.name}</h3>
        <p>{template.description}</p>
        <p className="template-sample-label">{template.sampleLabel}</p>
        <ul className="template-card-highlights">
          {template.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <div className="template-sample-stats">
          <span>{stats.systems} systems</span>
          <span>·</span>
          <span>{stats.integrations} integrations</span>
          {stats.hasSubDiagram && (
            <>
              <span>·</span>
              <span>drill-in detail</span>
            </>
          )}
        </div>
      </div>
      <span className="template-card-cta">{cta}</span>
    </button>
  )
}

export function TemplatePicker({ mode = 'project', onSelect, onClose }: TemplatePickerProps) {
  const groups = getTemplatesByCategory()
  const isSubTab = mode === 'sub-tab'

  return (
    <div
      className="template-picker-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-picker-title"
    >
      <div className="template-picker-panel">
        <div className="template-picker-header">
          <div>
            <h2 id="template-picker-title">
              {isSubTab ? 'New sub-tab' : 'New Architecture'}
            </h2>
            <p>
              {isSubTab
                ? 'Choose a template to add as a sub-diagram tab on this project. It opens as a nested design you can switch to from the sub-tab bar.'
                : 'Architecture styles, industry systems, and infrastructure landing zones — each includes an editable sample design.'}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="template-picker-body">
          {groups.map((group) => (
            <section key={group.category} className="template-picker-section">
              <h3 className="template-picker-section-title">{group.category}</h3>
              <div className="template-picker-grid">
                {group.templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onSelect={onSelect}
                    cta={isSubTab ? 'Add as sub-tab →' : 'Open sample →'}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
