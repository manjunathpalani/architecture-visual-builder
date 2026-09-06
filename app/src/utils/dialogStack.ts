export type DialogId =
  | 'settings'
  | 'json'
  | 'codeLinks'
  | 'workItems'
  | 'audit'
  | 'repo'
  | 'cloud'
  | 'template'
  | 'swagger'
  | 'saas'
  | 'aiDiagram'
  | 'aiAnalysis'

export const DIALOG_LABELS: Record<DialogId, string> = {
  settings: 'Settings',
  json: 'JSON editor',
  codeLinks: 'Code links',
  workItems: 'Work items',
  audit: 'Audit trail',
  repo: 'Git repository',
  cloud: 'Cloud storage',
  template: 'Template picker',
  swagger: 'Swagger import',
  saas: 'SaaS metadata',
  aiDiagram: 'Draw with AI',
  aiAnalysis: 'Capability analysis',
}

const STORAGE_KEY = 'avb-dialog-stack'
const KNOWN = new Set<DialogId>(Object.keys(DIALOG_LABELS) as DialogId[])

export function loadDialogStack(): DialogId[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is DialogId => typeof id === 'string' && KNOWN.has(id as DialogId))
  } catch {
    return []
  }
}

export function saveDialogStack(stack: DialogId[]) {
  try {
    if (stack.length === 0) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack))
  } catch {
    /* ignore */
  }
}

export function pushDialog(stack: DialogId[], id: DialogId): DialogId[] {
  if (stack[stack.length - 1] === id) return stack
  return [...stack.filter((item) => item !== id), id]
}

export function popDialog(stack: DialogId[]): DialogId[] {
  return stack.slice(0, -1)
}

export function removeDialog(stack: DialogId[], id: DialogId): DialogId[] {
  if (stack[stack.length - 1] === id) return stack.slice(0, -1)
  return stack.filter((item) => item !== id)
}
