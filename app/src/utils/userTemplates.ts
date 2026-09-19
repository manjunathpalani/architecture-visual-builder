import type { ArchitectureDocument } from '../types'
import { generateId, parseArchitectureJson, serializeArchitecture } from './jsonIO'

const STORAGE_KEY = 'avb-user-templates-v1'
export const USER_TEMPLATE_PREFIX = 'user:'
export const USER_TEMPLATES_EXPORT_KIND = 'avb-user-templates'

export interface UserTemplate {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  document: ArchitectureDocument
}

interface UserTemplatesExport {
  kind: typeof USER_TEMPLATES_EXPORT_KIND
  version: 1
  templates: UserTemplate[]
}

export function isUserTemplatePickId(id: string): boolean {
  return id.startsWith(USER_TEMPLATE_PREFIX)
}

export function userTemplatePickId(id: string): string {
  return `${USER_TEMPLATE_PREFIX}${id}`
}

export function parseUserTemplatePickId(id: string): string | null {
  if (!isUserTemplatePickId(id)) return null
  return id.slice(USER_TEMPLATE_PREFIX.length)
}

export function loadUserTemplates(): UserTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isUserTemplate)
  } catch {
    return []
  }
}

export function saveUserTemplates(templates: UserTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function getUserTemplate(id: string): UserTemplate | undefined {
  return loadUserTemplates().find((item) => item.id === id)
}

export function documentToTemplatePayload(document: ArchitectureDocument): ArchitectureDocument {
  const clone = structuredClone(document)
  return {
    ...clone,
    audit: undefined,
    metadata: {
      ...clone.metadata,
      updatedAt: new Date().toISOString(),
    },
  }
}

export function addUserTemplate(input: {
  name: string
  description?: string
  document: ArchitectureDocument
}): UserTemplate {
  const now = new Date().toISOString()
  const template: UserTemplate = {
    id: generateId('tpl'),
    name: input.name.trim() || input.document.metadata.name || 'Untitled template',
    description: input.description?.trim() || input.document.metadata.description || '',
    createdAt: now,
    updatedAt: now,
    document: documentToTemplatePayload(input.document),
  }
  saveUserTemplates([...loadUserTemplates(), template])
  return template
}

export function updateUserTemplate(
  id: string,
  patch: Partial<Pick<UserTemplate, 'name' | 'description' | 'document'>>,
): UserTemplate | null {
  const templates = loadUserTemplates()
  const index = templates.findIndex((item) => item.id === id)
  if (index < 0) return null
  const current = templates[index]
  const next: UserTemplate = {
    ...current,
    name: patch.name?.trim() || current.name,
    description: patch.description !== undefined ? patch.description.trim() : current.description,
    document: patch.document ? documentToTemplatePayload(patch.document) : current.document,
    updatedAt: new Date().toISOString(),
  }
  templates[index] = next
  saveUserTemplates(templates)
  return next
}

export function removeUserTemplate(id: string) {
  saveUserTemplates(loadUserTemplates().filter((item) => item.id !== id))
}

export function createDocumentFromUserTemplate(id: string): ArchitectureDocument {
  const found = getUserTemplate(id)
  if (!found) throw new Error('Saved template not found')
  const clone = structuredClone(found.document)
  return {
    ...clone,
    metadata: {
      ...clone.metadata,
      name: found.name || clone.metadata.name,
      description: found.description || clone.metadata.description,
      updatedAt: new Date().toISOString(),
    },
  }
}

export function importTemplatesFromJson(json: string, fileName?: string): UserTemplate[] {
  const parsed = JSON.parse(json) as unknown
  const added: UserTemplate[] = []

  if (isTemplatesExport(parsed)) {
    for (const item of parsed.templates) {
      added.push(
        addUserTemplate({
          name: item.name,
          description: item.description,
          document: item.document,
        }),
      )
    }
    return added
  }

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (isUserTemplate(item)) {
        added.push(addUserTemplate({ name: item.name, description: item.description, document: item.document }))
      } else {
        const doc = parseArchitectureJson(JSON.stringify(item))
        added.push(addUserTemplate({ name: doc.metadata.name, description: doc.metadata.description, document: doc }))
      }
    }
    return added
  }

  if (isUserTemplate(parsed)) {
    added.push(addUserTemplate({ name: parsed.name, description: parsed.description, document: parsed.document }))
    return added
  }

  const doc = parseArchitectureJson(json)
  const fallbackName = fileName?.replace(/\.(json|avb\.json)$/i, '') ?? doc.metadata.name
  added.push(
    addUserTemplate({
      name: doc.metadata.name || fallbackName,
      description: doc.metadata.description,
      document: doc,
    }),
  )
  return added
}

export function serializeUserTemplatesExport(templates = loadUserTemplates()): string {
  const payload: UserTemplatesExport = {
    kind: USER_TEMPLATES_EXPORT_KIND,
    version: 1,
    templates,
  }
  return JSON.stringify(payload, null, 2)
}

export function downloadUserTemplatesExport(templates = loadUserTemplates()) {
  const blob = new Blob([serializeUserTemplatesExport(templates)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = 'architecture-templates.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadUserTemplate(template: UserTemplate) {
  const blob = new Blob([serializeArchitecture(template.document)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = `${template.name.replace(/\s+/g, '-').toLowerCase() || 'template'}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function isUserTemplate(value: unknown): value is UserTemplate {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<UserTemplate>
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    Boolean(item.document) &&
    Array.isArray(item.document?.systems) &&
    Array.isArray(item.document?.integrations)
  )
}

function isTemplatesExport(value: unknown): value is UserTemplatesExport {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<UserTemplatesExport>
  return item.kind === USER_TEMPLATES_EXPORT_KIND && Array.isArray(item.templates)
}
