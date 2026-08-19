const STORAGE_KEY = 'avb-right-panel-collapsed'

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
