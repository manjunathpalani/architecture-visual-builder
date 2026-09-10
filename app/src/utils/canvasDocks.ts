const STORAGE_KEY = 'avb-right-panel-collapsed'
const PLACEMENT_KEY = 'avb-properties-placement'
const LAYOUT_LOCK_KEY = 'avb-diagram-layout-locked'

export type PropertiesPlacement = 'side' | 'flyout'

export function loadPropertiesPlacement(): PropertiesPlacement {
  try {
    const savedPlacement = localStorage.getItem(PLACEMENT_KEY)
    return savedPlacement === 'side' ? 'side' : 'flyout'
  } catch {
    return 'flyout'
  }
}

export function savePropertiesPlacement(placement: PropertiesPlacement): void {
  try {
    localStorage.setItem(PLACEMENT_KEY, placement)
  } catch {
    /* ignore */
  }
}

export function loadDiagramLayoutLocked(): boolean {
  try {
    return localStorage.getItem(LAYOUT_LOCK_KEY) === '1'
  } catch {
    return false
  }
}

export function saveDiagramLayoutLocked(locked: boolean): void {
  try {
    localStorage.setItem(LAYOUT_LOCK_KEY, locked ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function loadCanvasSideCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function saveCanvasSideCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore quota / private mode */
  }
}

const TOOLS_WIDTH_KEY = 'avb-tools-panel-width'
const FLYOUT_WIDTH_KEY = 'avb-properties-flyout-width'

export const TOOLS_PANEL_WIDTH = { default: 300, min: 240, max: 640 }
export const FLYOUT_PANEL_WIDTH = { default: 340, min: 280, max: 720 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function loadWidth(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = Number(localStorage.getItem(key))
    if (Number.isFinite(raw) && raw > 0) return clamp(raw, min, max)
  } catch {
    /* ignore */
  }
  return fallback
}

function saveWidth(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    /* ignore */
  }
}

export function loadToolsPanelWidth(): number {
  return loadWidth(TOOLS_WIDTH_KEY, TOOLS_PANEL_WIDTH.default, TOOLS_PANEL_WIDTH.min, TOOLS_PANEL_WIDTH.max)
}

export function saveToolsPanelWidth(width: number) {
  saveWidth(TOOLS_WIDTH_KEY, clamp(width, TOOLS_PANEL_WIDTH.min, TOOLS_PANEL_WIDTH.max))
}

export function loadFlyoutPanelWidth(): number {
  return loadWidth(FLYOUT_WIDTH_KEY, FLYOUT_PANEL_WIDTH.default, FLYOUT_PANEL_WIDTH.min, FLYOUT_PANEL_WIDTH.max)
}

export function saveFlyoutPanelWidth(width: number) {
  saveWidth(FLYOUT_WIDTH_KEY, clamp(width, FLYOUT_PANEL_WIDTH.min, FLYOUT_PANEL_WIDTH.max))
}

export function clampPanelWidth(width: number, min: number, max: number): number {
  const cap = Math.min(max, Math.max(min, Math.floor(window.innerWidth * 0.72)))
  return clamp(width, min, cap)
}
