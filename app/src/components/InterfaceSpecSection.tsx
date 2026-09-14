import { useState } from 'react'
import { Braces, FileCode, Plus, Eye } from 'lucide-react'
import {
  createDefaultInterfaceSpec,
  parseInterfaceSpec,
  serializeInterfaceSpec,
  type InterfaceSpec,
} from '../types/interfaceSpec'
import { InterfaceSpecViewer } from './InterfaceSpecViewer'
import { InterfaceSpecModal } from './InterfaceSpecModal'
import { SwaggerInjectorModal } from './SwaggerInjectorModal'

interface InterfaceSpecSectionProps {
  interfaceSpecJson?: string
  defaultTitle?: string
  onChange: (json: string) => void
}

export function InterfaceSpecSection({
  interfaceSpecJson,
  defaultTitle = 'API Interface',
  onChange,
}: InterfaceSpecSectionProps) {
  const [showModal, setShowModal] = useState(false)
  const [showInjector, setShowInjector] = useState(false)

  const spec =
    parseInterfaceSpec(interfaceSpecJson) ?? createDefaultInterfaceSpec(defaultTitle)

  const save = (updated: InterfaceSpec) => {
    onChange(serializeInterfaceSpec(updated))
  }

  const hasSpec = Boolean(interfaceSpecJson?.trim())

  return (
    <div className="interface-spec-section">
      <div className="code-link-header">
        <FileCode size={16} />
        <span>Interface Specification</span>
      </div>
      <p className="code-link-hint">
        Define API endpoints, methods, and schemas for this component or integration.
      </p>

      {!hasSpec ? (
        <div className="spec-init-actions">
          <button type="button" className="btn-secondary" onClick={() => setShowModal(true)}>
            <Plus size={14} />
            Add Interface Spec
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowInjector(true)}>
            <Braces size={14} />
            Inject Swagger
          </button>
        </div>
      ) : (
        <div className="spec-preview-box">
          <InterfaceSpecViewer spec={spec} maxEndpoints={5} />
          <div className="code-link-actions">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(true)}>
              <Eye size={14} />
              Open Interface Spec
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowInjector(true)}>
              <Braces size={14} />
              Inject Swagger
            </button>
            <button
              type="button"
              className="btn-reset-color"
              onClick={() => onChange('')}
            >
              Remove Spec
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <InterfaceSpecModal
          spec={spec}
          defaultTitle={defaultTitle}
          onClose={() => setShowModal(false)}
          onSave={(json) => {
            onChange(json)
            setShowModal(false)
          }}
          onInjectSwagger={() => setShowInjector(true)}
          onRemove={() => {
            onChange('')
            setShowModal(false)
          }}
        />
      )}

      {showInjector && (
        <SwaggerInjectorModal
          mode="spec"
          onApplySpec={(next) => {
            save(next)
            setShowInjector(false)
            setShowModal(false)
          }}
          onClose={() => setShowInjector(false)}
        />
      )}
    </div>
  )
}