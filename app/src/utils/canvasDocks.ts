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
