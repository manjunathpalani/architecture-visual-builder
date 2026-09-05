import type { ArchitectureDocument } from '../types'
import type { DiagramPath } from '../types/diagram'
import type { ProjectTab } from '../types/project'
import { sanitizeAudit } from './auditLog'

const STORAGE_KEY = 'architecture-visual-builder-autosave'
const VERSION = 1

export interface AutosaveSnapshot {
  savedAt: string
  activeTabId: string
  tabs: ProjectTab[]
}

interface StoredAutosave {
  version: number
  savedAt: string
  activeTabId: string
  tabs: Array<{
    id: string
    drillPath: DiagramPath
    document: ArchitectureDocument
  }>
}

export function autosaveFingerprint(tabs: ProjectTab[], activeTabId: string): string {
  return JSON.stringify({
    activeTabId,
    tabs: tabs.map((tab) => ({
      id: tab.id,
      drillPath: tab.drillPath,
      document: tab.document,
    })),
  })
}

export function saveProjectAutosave(tabs: ProjectTab[], activeTabId: string): string {
  const savedAt = new Date().toISOString()
  const payload: StoredAutosave = {
    version: VERSION,
    savedAt,
    activeTabId,
    tabs: tabs.map((tab) => ({
      id: tab.id,
      drillPath: tab.drillPath,
      document: tab.document,
    })),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  return savedAt
}

export function loadProjectAutosave(): AutosaveSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAutosave
    if (parsed.version !== VERSION || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) {
      return null
    }
    const tabs: ProjectTab[] = parsed.tabs
      .filter((tab) => tab?.id && tab.document?.metadata && Array.isArray(tab.document.systems))
      .map((tab) => {
        const audit = sanitizeAudit(tab.document.audit)
        return {
          id: tab.id,
          document: audit.length > 0 ? { ...tab.document, audit } : { ...tab.document, audit: undefined },
          drillPath: Array.isArray(tab.drillPath) ? tab.drillPath : [],
          canvasKey: 0,
        }
      })
    if (tabs.length === 0) return null
    const activeTabId = tabs.some((tab) => tab.id === parsed.activeTabId)
      ? parsed.activeTabId
      : tabs[0].id
    return {
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      activeTabId,
      tabs,
    }
  } catch {
    return null
  }
}

export function clearProjectAutosave() {
  localStorage.removeItem(STORAGE_KEY)
}

export function formatAutosaveTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
