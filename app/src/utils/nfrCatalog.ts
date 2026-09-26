import type { SystemProperties } from '../types'
import { generateId } from './jsonIO'
import { NFR_TEMPLATES, getNfrTemplate, type NfrTemplate } from '../data/nfrTemplates'

export interface AppliedNfr {
  id: string
  templateId: string
  templateName: string
  itemId: string
  category: string
  requirement: string
  rationale: string
  source: 'template' | 'custom'
}

const STORAGE_KEY = 'nfrs'

export function parseAppliedNfrs(properties?: SystemProperties): AppliedNfr[] {
  const raw = properties?.[STORAGE_KEY]
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isAppliedNfr)
  } catch {
    return []
  }
}

export function serializeAppliedNfrs(nfrs: AppliedNfr[]): string {
  return JSON.stringify(nfrs)
}

export function applyNfrTemplate(existing: AppliedNfr[], templateId: string): AppliedNfr[] {
  const template = getNfrTemplate(templateId)
  if (!template) return existing
  const seen = new Set(existing.map((item) => item.itemId))
  const next = [...existing]
  for (const item of template.items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    next.push({
      id: generateId('nfr'),
      templateId: template.id,
      templateName: template.name,
      itemId: item.id,
      category: item.category,
      requirement: item.requirement,
      rationale: item.rationale,
      source: 'template',
    })
  }
  return next
}

export function removeAppliedNfr(existing: AppliedNfr[], id: string): AppliedNfr[] {
  return existing.filter((item) => item.id !== id)
}

export function formatNfrsAsBullets(nfrs: AppliedNfr[]): string {
  return nfrs.map((item) => `- [${item.category}] ${item.requirement}`).join('\n')
}

export function appendTemplateToText(existing: string | undefined, template: NfrTemplate): string {
  const current = existing?.trim() ?? ''
  const block = [
    `## ${template.name} (${template.standard})`,
    ...template.items.map((item) => `- [${item.category}] ${item.requirement}`),
  ].join('\n')
  if (!current) return block
  if (current.includes(template.name)) return current
  return `${current}\n\n${block}`
}

export function nfrSummary(nfrs: AppliedNfr[]): string | undefined {
  if (nfrs.length === 0) return undefined
  const packs = new Set(nfrs.map((item) => item.templateName))
  return `${nfrs.length} NFR${nfrs.length === 1 ? '' : 's'} · ${packs.size} pack${packs.size === 1 ? '' : 's'}`
}

function isAppliedNfr(value: unknown): value is AppliedNfr {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<AppliedNfr>
  return typeof item.id === 'string' && typeof item.requirement === 'string' && typeof item.category === 'string'
}

export { NFR_TEMPLATES }
