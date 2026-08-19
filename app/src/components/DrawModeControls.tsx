import { Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

interface DrawModeControlsProps {
  isFullscreen: boolean
  menusHidden: boolean
  onToggleFullscreen: () => void
  onToggleMenus: () => void
  variant?: 'toolbar' | 'compact'
}

export function DrawModeControls({
  isFullscreen,
  menusHidden,
  onToggleFullscreen,
  onToggleMenus,
  variant = 'compact',
}: DrawModeControlsProps) {
  const compact = variant === 'compact'
  const buttonClass = compact ? 'drawing-tool-btn' : 'btn-secondary'

  return (
    <>
      <button
        type="button"
        className={`${buttonClass} ${menusHidden ? 'active' : ''}`}
        title={menusHidden ? 'Show menus (Ctrl+\\)' : 'Hide menus (Ctrl+\\)'}
        aria-pressed={menusHidden}
        onClick={onToggleMenus}
      >
        {menusHidden ? <PanelLeftOpen size={compact ? 15 : 16} /> : <PanelLeftClose size={compact ? 15 : 16} />}
        {compact ? null : menusHidden ? 'Show menus' : 'Hide menus'}
      </button>
      <button
        type="button"
        className={`${buttonClass} ${isFullscreen ? 'active' : ''}`}
        title={isFullscreen ? 'Exit fullscreen (Ctrl+Shift+F)' : 'Draw fullscreen (Ctrl+Shift+F)'}
        aria-pressed={isFullscreen}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? <Minimize2 size={compact ? 15 : 16} /> : <Maximize2 size={compact ? 15 : 16} />}
        {compact ? null : isFullscreen ? 'Exit fullscreen' : 'Draw fullscreen'}
      </button>
    </>
  )
}
