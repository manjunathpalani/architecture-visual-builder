import type { ArchitectureTemplateId } from '../data/templates'

interface TemplateSamplePreviewProps {
  id: ArchitectureTemplateId
}

/** Compact visual sketch of each template’s sample design layout */
export function TemplateSamplePreview({ id }: TemplateSamplePreviewProps) {
  return (
    <div className="template-sample-preview" aria-hidden="true">
      {id === 'blank' && <BlankPreview />}
      {id === 'enterprise' && <EnterprisePreview />}
      {id === 'business-context' && <IndustryPreview accent="#7c3aed" labels={['Outcome', 'Value stream', 'Apps']} />}
      {id === 'solution' && <SolutionPreview />}
      {id === 'contextual' && <ContextualPreview />}
      {id === 'functional' && <FunctionalPreview />}
      {id === 'integration' && <IntegrationPreview />}
      {id === 'banking' && <IndustryPreview accent="#1d4ed8" labels={['Channels', 'Core', 'Risk']} />}
      {id === 'healthcare' && <IndustryPreview accent="#0d9488" labels={['Clinical', 'Interop', 'RCM']} />}
      {id === 'insurance' && <IndustryPreview accent="#7c3aed" labels={['Policy', 'Claims', 'UW']} />}
      {id === 'telco' && <IndustryPreview accent="#ea580c" labels={['BSS', 'OSS', 'Net']} />}
      {id === 'infra-aws' && <InfraPreview accent="#ff9900" labels={['Edge', 'Public', 'Private']} />}
      {id === 'infra-azure' && <InfraPreview accent="#0078d4" labels={['Hub', 'Spoke', 'Data']} />}
      {id === 'infra-kubernetes' && <InfraPreview accent="#6366f1" labels={['Ingress', 'Apps', 'Data']} />}
      {id === 'infra-hybrid' && <InfraPreview accent="#0ea5e9" labels={['DC', 'WAN', 'Cloud']} />}
      {id === 'ai-rag' && <RagPreview />}
      {id === 'ai-mlops' && <InfraPreview accent="#7c3aed" labels={['Data', 'Train', 'Serve']} />}
      {id === 'ai-agents' && <AgentsPreview />}
      {id === 'ai-azure' && <InfraPreview accent="#0078d4" labels={['Edge', 'AI', 'Knowledge']} />}
    </div>
  )
}

function RagPreview() {
  return (
    <svg viewBox="0 0 200 88" className="template-preview-svg">
      <rect x="6" y="14" width="36" height="60" rx="3" fill="#fce7f3" stroke="#ec4899" strokeWidth="1.2" />
      <circle cx="24" cy="32" r="6" fill="#ec4899" opacity="0.7" />
      <circle cx="24" cy="56" r="6" fill="#742774" opacity="0.7" />
      <rect x="50" y="14" width="44" height="60" rx="3" fill="#eef2ff" stroke="#6366f1" strokeWidth="1.2" />
      <rect x="58" y="26" width="28" height="12" rx="2" fill="#6366f1" opacity="0.8" />
      <rect x="58" y="46" width="28" height="12" rx="2" fill="#8b5cf6" opacity="0.75" />
      <rect x="102" y="8" width="44" height="72" rx="3" fill="#f5f3ff" stroke="#8b5cf6" strokeWidth="1.2" />
      <rect x="110" y="20" width="28" height="12" rx="2" fill="#8b5cf6" opacity="0.85" />
      <rect x="110" y="38" width="28" height="12" rx="2" fill="#be185d" opacity="0.7" />
      <rect x="110" y="56" width="28" height="12" rx="2" fill="#7c3aed" opacity="0.55" />
      <rect x="154" y="14" width="40" height="60" rx="3" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.2" />
      <rect x="160" y="26" width="28" height="10" rx="2" fill="#10b981" opacity="0.8" />
      <rect x="160" y="42" width="28" height="10" rx="2" fill="#059669" opacity="0.65" />
      <rect x="160" y="58" width="28" height="10" rx="2" fill="#047857" opacity="0.5" />
      <path d="M42 44 H50" stroke="#94a3b8" strokeWidth="1.2" />
      <path d="M94 44 H102" stroke="#94a3b8" strokeWidth="1.2" />
      <path d="M146 44 H154" stroke="#94a3b8" strokeWidth="1.2" />
    </svg>
  )
}

function AgentsPreview() {
  return (
    <svg viewBox="0 0 200 88" className="template-preview-svg">
      <circle cx="24" cy="44" r="10" fill="#fce7f3" stroke="#ec4899" strokeWidth="1.2" />
      <rect x="48" y="28" width="40" height="32" rx="4" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1.4" />
      <rect x="56" y="38" width="24" height="12" rx="2" fill="#8b5cf6" opacity="0.85" />
      <rect x="100" y="12" width="40" height="24" rx="3" fill="#eef2ff" stroke="#6366f1" strokeWidth="1.2" />
      <rect x="100" y="44" width="40" height="24" rx="3" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.2" />
      <rect x="152" y="12" width="40" height="24" rx="3" fill="#dbeafe" stroke="#2563eb" strokeWidth="1.2" />
      <rect x="152" y="52" width="40" height="24" rx="3" fill="#ffedd5" stroke="#f59e0b" strokeWidth="1.2" />
      <path d="M34 44 H48" stroke="#94a3b8" strokeWidth="1.2" />
      <path d="M88 44 H100" stroke="#94a3b8" strokeWidth="1.2" />
      <path d="M140 24 H152" stroke="#94a3b8" strokeWidth="1.2" />
      <path d="M120 56 H152" stroke="#94a3b8" strokeWidth="1.2" />
    </svg>
  )
}

function InfraPreview({ accent, labels }: { accent: string; labels: string[] }) {
  return (
    <svg viewBox="0 0 200 88" className="template-preview-svg">
      {labels.map((name, i) => (
        <g key={name}>
          <rect
            x={8 + i * 64}
            y="14"
            width="60"
            height="62"
            rx="4"
            fill={accent}
            opacity={0.1}
            stroke={accent}
            strokeWidth="1.2"
          />
          <rect x={16 + i * 64} y="26" width="44" height="10" rx="2" fill={accent} opacity={0.85 - i * 0.12} />
          <rect x={16 + i * 64} y="42" width="44" height="10" rx="2" fill={accent} opacity={0.5} />
          <text x={38 + i * 64} y="68" textAnchor="middle" fontSize="7" fill={accent} fontWeight="600">
            {name}
          </text>
        </g>
      ))}
    </svg>
  )
}

function IndustryPreview({ accent, labels }: { accent: string; labels: string[] }) {
  return (
    <svg viewBox="0 0 200 88" className="template-preview-svg">
      {labels.map((label, i) => (
        <g key={label}>
          <rect
            x={10 + i * 64}
            y="16"
            width="56"
            height="56"
            rx="4"
            fill={accent}
            opacity={0.12}
            stroke={accent}
            strokeWidth="1.2"
          />
          <rect
            x={18 + i * 64}
            y="28"
            width="40"
            height="10"
            rx="2"
            fill={accent}
            opacity={0.85 - i * 0.15}
          />
          <rect
            x={18 + i * 64}
            y="44"
            width="40"
            height="10"
            rx="2"
            fill={accent}
            opacity={0.55 - i * 0.1}
          />
          <text
            x={38 + i * 64}
            y="72"
            textAnchor="middle"
            fontSize="7"
            fill={accent}
            fontWeight="600"
          >
            {label}
          </text>
        </g>
      ))}
      {iArrows()}
    </svg>
  )
}

function iArrows() {
  return (
    <>
      <path d="M66 40 H74" stroke="#94a3b8" strokeWidth="1.2" />
      <path d="M130 40 H138" stroke="#94a3b8" strokeWidth="1.2" />
    </>
  )
}

function BlankPreview() {
  return (
    <svg viewBox="0 0 200 88" className="template-preview-svg">
      <rect x="8" y="18" width="52" height="52" rx="4" fill="#e0e7ff" stroke="#6366f1" strokeWidth="1.5" />
      <rect x="74" y="18" width="52" height="52" rx="4" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1.5" />
      <rect x="140" y="18" width="52" height="52" rx="4" fill="#ffedd5" stroke="#f59e0b" strokeWidth="1.5" />
      <rect x="18" y="36" width="32" height="14" rx="2" fill="#6366f1" opacity="0.85" />
      <rect x="84" y="36" width="32" height="14" rx="2" fill="#8b5cf6" opacity="0.85" />
      <rect x="150" y="36" width="32" height="14" rx="2" fill="#f59e0b" opacity="0.85" />
      <path d="M50 43 H74" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <path d="M126 43 H140" stroke="#94a3b8" strokeWidth="1.5" />
      <text x="100" y="12" textAnchor="middle" className="template-preview-caption">
        Sample scaffold
      </text>
    </svg>
  )
}

function EnterprisePreview() {
  const bands = [
    { y: 14, c: '#ec4899', label: 'Biz' },
    { y: 30, c: '#6366f1', label: 'Apps' },
    { y: 46, c: '#8b5cf6', label: 'Int' },
    { y: 62, c: '#10b981', label: 'Data' },
    { y: 78, c: '#0ea5e9', label: 'Tech' },
  ]
  return (
    <svg viewBox="0 0 200 96" className="template-preview-svg">
      {bands.map((b) => (
        <g key={b.label}>
          <rect x="10" y={b.y} width="180" height="12" rx="2" fill={b.c} opacity="0.15" stroke={b.c} strokeWidth="1" />
          <rect x="20" y={b.y + 2} width="28" height="8" rx="1" fill={b.c} opacity="0.8" />
          <rect x="54" y={b.y + 2} width="28" height="8" rx="1" fill={b.c} opacity="0.55" />
          <rect x="88" y={b.y + 2} width="28" height="8" rx="1" fill={b.c} opacity="0.55" />
          <rect x="122" y={b.y + 2} width="28" height="8" rx="1" fill={b.c} opacity="0.4" />
        </g>
      ))}
    </svg>
  )
}

function SolutionPreview() {
  return (
    <svg viewBox="0 0 200 88" className="template-preview-svg">
      <rect x="6" y="12" width="36" height="64" rx="3" fill="#fce7f3" stroke="#ec4899" strokeWidth="1" />
      <circle cx="24" cy="28" r="6" fill="#ec4899" opacity="0.7" />
      <circle cx="24" cy="48" r="6" fill="#ec4899" opacity="0.5" />
      <circle cx="24" cy="68" r="6" fill="#ec4899" opacity="0.4" />
      <rect x="50" y="8" width="100" height="72" rx="4" fill="#eef2ff" stroke="#6366f1" strokeWidth="1.5" />
      <rect x="60" y="20" width="24" height="14" rx="2" fill="#6366f1" opacity="0.7" />
      <rect x="90" y="20" width="24" height="14" rx="2" fill="#6366f1" opacity="0.55" />
      <rect x="120" y="20" width="20" height="14" rx="2" fill="#0078d4" opacity="0.7" />
      <rect x="90" y="44" width="28" height="16" rx="2" fill="#8b5cf6" opacity="0.75" />
      <rect x="60" y="44" width="24" height="16" rx="2" fill="#0ea5e9" opacity="0.55" />
      <rect x="158" y="12" width="36" height="64" rx="3" fill="#f1f5f9" stroke="#64748b" strokeWidth="1" />
      <rect x="166" y="24" width="20" height="10" rx="2" fill="#64748b" opacity="0.5" />
      <rect x="166" y="42" width="20" height="10" rx="2" fill="#64748b" opacity="0.4" />
      <rect x="166" y="60" width="20" height="10" rx="2" fill="#64748b" opacity="0.35" />
    </svg>
  )
}

function ContextualPreview() {
  return (
    <svg viewBox="0 0 200 88" className="template-preview-svg">
      <rect x="70" y="28" width="60" height="32" rx="4" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2" />
      <text x="100" y="48" textAnchor="middle" fontSize="7" fill="#4338ca" fontWeight="600">
        SoI
      </text>
      <circle cx="28" cy="24" r="8" fill="#fce7f3" stroke="#ec4899" strokeWidth="1.2" />
      <circle cx="28" cy="44" r="8" fill="#fce7f3" stroke="#ec4899" strokeWidth="1.2" />
      <circle cx="28" cy="64" r="8" fill="#fce7f3" stroke="#ec4899" strokeWidth="1.2" />
      <rect x="150" y="16" width="36" height="12" rx="2" fill="#e2e8f0" stroke="#64748b" />
      <rect x="150" y="36" width="36" height="12" rx="2" fill="#e2e8f0" stroke="#64748b" />
      <rect x="150" y="56" width="36" height="12" rx="2" fill="#e2e8f0" stroke="#64748b" />
      <rect x="80" y="6" width="28" height="12" rx="2" fill="#c7d2fe" stroke="#6366f1" />
      <rect x="112" y="6" width="28" height="12" rx="2" fill="#c7d2fe" stroke="#6366f1" />
      <line x1="36" y1="44" x2="70" y2="44" stroke="#94a3b8" strokeWidth="1" />
      <line x1="130" y1="44" x2="150" y2="42" stroke="#94a3b8" strokeWidth="1" />
      <line x1="100" y1="28" x2="100" y2="18" stroke="#94a3b8" strokeWidth="1" />
    </svg>
  )
}

function FunctionalPreview() {
  return (
    <svg viewBox="0 0 200 88" className="template-preview-svg">
      <rect x="8" y="8" width="130" height="48" rx="3" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="1" />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={`top-${i}`}
          x={16 + i * 30}
          y="18"
          width="24"
          height="12"
          rx="2"
          fill="#0ea5e9"
          opacity={0.85 - i * 0.12}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <rect
          key={`mid-${i}`}
          x={16 + i * 36}
          y="36"
          width="28"
          height="12"
          rx="2"
          fill="#0284c7"
          opacity={0.7 - i * 0.1}
        />
      ))}
      <rect x="8" y="62" width="90" height="18" rx="3" fill="#d1fae5" stroke="#10b981" strokeWidth="1" />
      <rect x="16" y="67" width="20" height="8" rx="1" fill="#10b981" opacity="0.7" />
      <rect x="42" y="67" width="20" height="8" rx="1" fill="#10b981" opacity="0.5" />
      <rect x="68" y="67" width="20" height="8" rx="1" fill="#10b981" opacity="0.4" />
      <rect x="144" y="8" width="48" height="72" rx="3" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1" />
      <rect x="152" y="20" width="32" height="10" rx="2" fill="#8b5cf6" opacity="0.7" />
      <rect x="152" y="38" width="32" height="10" rx="2" fill="#8b5cf6" opacity="0.55" />
      <rect x="152" y="56" width="32" height="10" rx="2" fill="#8b5cf6" opacity="0.4" />
    </svg>
  )
}

function IntegrationPreview() {
  return (
    <svg viewBox="0 0 200 88" className="template-preview-svg">
      <rect x="8" y="16" width="48" height="56" rx="3" fill="#e0e7ff" stroke="#6366f1" strokeWidth="1.2" />
      <rect x="16" y="28" width="32" height="12" rx="2" fill="#6366f1" opacity="0.75" />
      <rect x="16" y="48" width="32" height="12" rx="2" fill="#6366f1" opacity="0.5" />
      <rect x="66" y="8" width="68" height="72" rx="3" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="1.2" />
      <rect x="80" y="24" width="40" height="14" rx="2" fill="#8b5cf6" opacity="0.8" />
      <rect x="74" y="48" width="24" height="12" rx="2" fill="#ff9900" opacity="0.7" />
      <rect x="104" y="48" width="24" height="12" rx="2" fill="#0078d4" opacity="0.7" />
      <rect x="144" y="16" width="48" height="56" rx="3" fill="#ffedd5" stroke="#f59e0b" strokeWidth="1.2" />
      <rect x="152" y="28" width="32" height="12" rx="2" fill="#f59e0b" opacity="0.75" />
      <rect x="152" y="48" width="32" height="12" rx="2" fill="#10b981" opacity="0.65" />
      <path d="M56 44 H66" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M134 44 H144" stroke="#94a3b8" strokeWidth="1.5" />
    </svg>
  )
}
