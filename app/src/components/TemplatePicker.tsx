import { useMemo, useState, type KeyboardEvent } from 'react'
import {
  Bot,
  Brain,
  Building2,
  Cloud,
  Cpu,
  HeartPulse,
  Landmark,
  Layers,
  Link2,
  Network,
  Radio,
  Server,
  Shield,
  Sparkles,
  Square,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  getTemplatesByCategory,
  getTemplateSampleStats,
  type ArchitectureTemplate,
  type ArchitectureTemplateCategory,
  type ArchitectureTemplateId,
} from '../data/templates'
import { TemplateSamplePreview } from './TemplateSamplePreview'

interface TemplatePickerProps {
  mode?: 'project' | 'sub-tab'
  onSelect: (id: ArchitectureTemplateId) => void
  onClose: () => void
}

const TEMPLATE_ICONS: Record<ArchitectureTemplateId, LucideIcon> = {
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
  'ai-rag': Sparkles,
  'ai-mlops': Brain,
  'ai-agents': Bot,
  'ai-azure': Cpu,
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

const CATEGORY_TABS: Array<{
  id: ArchitectureTemplateCategory
  label: string
  hint: string
  icon: LucideIcon
}> = [
  { id: 'General', label: 'General', hint: 'Blank scaffold to start from', icon: Square },
  { id: 'Architecture Style', label: 'Styles', hint: 'EA, C4, context, and functions', icon: Layers },
  { id: 'Industry', label: 'Industry', hint: 'Banking, health, insurance, telco', icon: Building2 },
  { id: 'Infrastructure', label: 'Infrastructure', hint: 'AWS, Azure, Kubernetes, hybrid', icon: Cloud },
  { id: 'AI', label: 'AI', hint: 'RAG, MLOps, agents, Azure AI', icon: Sparkles },
  { id: 'Integration', label: 'Integration', hint: 'SaaS to on-prem landscapes', icon: Link2 },
]

export function TemplatePicker({ mode = 'project', onSelect, onClose }: TemplatePickerProps) {
  const groups = useMemo(() => getTemplatesByCategory(), [])
  const isSubTab = mode === 'sub-tab'
  const [activeCategory, setActiveCategory] = useState<ArchitectureTemplateCategory>('Architecture Style')

  const tabs = useMemo(
    () =>
      CATEGORY_TABS.map((tab) => ({
        ...tab,
        count: groups.find((group) => group.category === tab.id)?.templates.length ?? 0,
      })).filter((tab) => tab.count > 0),
    [groups],
  )

  const activeTab = tabs.find((tab) => tab.id === activeCategory) ?? tabs[0]
  const templates = groups.find((group) => group.category === activeTab?.id)?.templates ?? []

  const selectTab = (id: ArchitectureTemplateCategory) => {
    setActiveCategory(id)
  }

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') {
      return
    }
    event.preventDefault()
    const index = tabs.findIndex((tab) => tab.id === activeTab?.id)
    if (index < 0 || tabs.length === 0) return
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = tabs.length - 1
    setActiveCategory(tabs[next].id)
    const button = event.currentTarget.querySelector<HTMLButtonElement>(`#template-tab-${cssId(tabs[next].id)}`)
    button?.focus()
  }

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
                : 'Pick a category, then open an editable sample design.'}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div
          className="template-picker-tabs"
          role="tablist"
          aria-label="Architecture template categories"
          onKeyDown={onTabKeyDown}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            const selected = tab.id === activeTab?.id
            return (
              <button
                key={tab.id}
                id={`template-tab-${cssId(tab.id)}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="template-tab-panel"
                tabIndex={selected ? 0 : -1}
                className={`template-picker-tab${selected ? ' active' : ''}`}
                onClick={() => selectTab(tab.id)}
              >
                <Icon size={15} />
                <span className="template-picker-tab-label">{tab.label}</span>
                <span className="template-picker-tab-count">{tab.count}</span>
              </button>
            )
          })}
        </div>

        <div
          className="template-picker-body"
          role="tabpanel"
          id="template-tab-panel"
          aria-labelledby={activeTab ? `template-tab-${cssId(activeTab.id)}` : undefined}
        >
          {activeTab && (
            <div className="template-picker-tab-intro">
              <h3>{activeTab.id}</h3>
              <p>{activeTab.hint}</p>
            </div>
          )}
          <div className="template-picker-grid">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={onSelect}
                cta={isSubTab ? 'Add as sub-tab →' : 'Open sample →'}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function cssId(category: ArchitectureTemplateCategory): string {
  return category.toLowerCase().replace(/\s+/g, '-')
}
