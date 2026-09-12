export type ToolbarOrientation = 'horizontal' | 'vertical'
export type ToolbarDock = 'top-left' | 'top-right'

export interface FloatingToolbarState {
  x: number
  y: number
  orientation: ToolbarOrientation
  minimised: boolean
  placed: boolean
}

const MARGIN = 8

export function defaultToolbarState(
  orientation: ToolbarOrientation = 'horizontal',
): FloatingToolbarState {
  return { x: 12, y: 12, orientation, minimised: false, placed: false }
}

export function loadFloatingToolbar(
  storageKey: string,
  fallback: FloatingToolbarState = defaultToolbarState(),
): FloatingToolbarState {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<FloatingToolbarState>
    return {
      x: Number.isFinite(parsed.x) ? Number(parsed.x) : fallback.x,
      y: Number.isFinite(parsed.y) ? Number(parsed.y) : fallback.y,
      orientation: parsed.orientation === 'vertical' ? 'vertical' : 'horizontal',
      minimised: parsed.minimised === true,
      placed: parsed.placed === true,
    }
  } catch {
    return fallback
  }
}

export function saveFloatingToolbar(storageKey: string, state: FloatingToolbarState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    /* ignore quota / private mode */
  }
}

export function clampToolbarPosition(
  x: number,
  y: number,
  toolbar: Pick<HTMLElement, 'offsetWidth' | 'offsetHeight'>,
  parent: Pick<HTMLElement, 'clientWidth' | 'clientHeight'>,
): { x: number; y: number } {
  const maxX = Math.max(MARGIN, parent.clientWidth - toolbar.offsetWidth - MARGIN)
  const maxY = Math.max(MARGIN, parent.clientHeight - toolbar.offsetHeight - MARGIN)
  return {
    x: Math.min(Math.max(MARGIN, Math.round(x)), maxX),
    y: Math.min(Math.max(MARGIN, Math.round(y)), maxY),
  }
}
