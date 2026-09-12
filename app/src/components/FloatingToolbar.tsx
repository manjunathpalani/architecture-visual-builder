import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { GripHorizontal, GripVertical, Maximize2, Minimize2, Rows3, Columns3 } from 'lucide-react'
import {
  clampToolbarPosition,
  loadFloatingToolbar,
  saveFloatingToolbar,
  type ToolbarDock,
  type ToolbarOrientation,
} from '../utils/floatingToolbar'

interface FloatingToolbarProps {
  storageKey: string
  className: string
  title: string
  restoreLabel: string
  restoreIcon: ReactNode
  defaultDock?: ToolbarDock
  children: ReactNode
}

export function FloatingToolbar({
  storageKey,
  className,
  title,
  restoreLabel,
  restoreIcon,
  defaultDock = 'top-left',
  children,
}: FloatingToolbarProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState(() => loadFloatingToolbar(storageKey))
  const [dragging, setDragging] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const persist = useCallback(
    (next: typeof state) => {
      setState(next)
      saveFloatingToolbar(storageKey, next)
    },
    [storageKey],
  )

  const clampToParent = useCallback(() => {
    const el = rootRef.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent || !stateRef.current.placed) return
    const next = clampToolbarPosition(stateRef.current.x, stateRef.current.y, el, parent)
    if (next.x === stateRef.current.x && next.y === stateRef.current.y) return
    persist({ ...stateRef.current, ...next })
  }, [persist])

  useEffect(() => {
    clampToParent()
  }, [clampToParent, state.orientation, state.minimised])

  useEffect(() => {
    const onResize = () => clampToParent()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [clampToParent])

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      const el = rootRef.current
      const parent = el?.offsetParent as HTMLElement | null
      if (!el || !parent) return

      const parentRect = parent.getBoundingClientRect()
      const rect = el.getBoundingClientRect()
      const originX = rect.left - parentRect.left
      const originY = rect.top - parentRect.top
      const startX = event.clientX
      const startY = event.clientY
      const handle = event.currentTarget
      handle.setPointerCapture(event.pointerId)
      setDragging(true)
      document.body.classList.add('is-toolbar-dragging')

      const onMove = (move: PointerEvent) => {
        const next = clampToolbarPosition(
          originX + (move.clientX - startX),
          originY + (move.clientY - startY),
          el,
          parent,
        )
        setState((current) => ({ ...current, ...next, placed: true }))
      }
      const onUp = () => {
        handle.releasePointerCapture(event.pointerId)
        handle.removeEventListener('pointermove', onMove)
        handle.removeEventListener('pointerup', onUp)
        document.body.classList.remove('is-toolbar-dragging')
        setDragging(false)
        setState((current) => {
          saveFloatingToolbar(storageKey, current)
          return current
        })
      }
      handle.addEventListener('pointermove', onMove)
      handle.addEventListener('pointerup', onUp)
    },
    [storageKey],
  )

  const toggleOrientation = () => {
    const next: ToolbarOrientation = state.orientation === 'horizontal' ? 'vertical' : 'horizontal'
    persist({ ...state, orientation: next })
  }

  const toggleMinimised = () => {
    persist({ ...state, minimised: !state.minimised })
  }

  const Grip = state.orientation === 'vertical' ? GripHorizontal : GripVertical
  const style = state.placed ? { left: state.x, top: state.y } : undefined

  return (
    <div
      ref={rootRef}
      className={[
        className,
        'floating-toolbar',
        `is-${state.orientation}`,
        state.minimised ? 'minimised' : '',
        dragging ? 'is-dragging' : '',
        state.placed ? 'is-placed' : `dock-${defaultDock}`,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="floating-toolbar-grip nodrag nopan"
        title="Drag to move this toolbar"
        onPointerDown={startDrag}
      >
        <Grip size={14} />
      </button>

      {state.minimised ? (
        <button
          type="button"
          className="drawing-toolbar-restore"
          title={`Show ${restoreLabel.toLowerCase()} tools`}
          onClick={toggleMinimised}
        >
          {restoreIcon}
          {restoreLabel}
          <Maximize2 size={14} />
        </button>
      ) : (
        <>
          <span
            className="floating-toolbar-title nodrag nopan"
            title="Drag to move this toolbar"
            onPointerDown={startDrag}
          >
            {title}
          </span>
          <div className="floating-toolbar-body">{children}</div>
          <span className="drawing-toolbar-divider" />
          <button
            type="button"
            className="drawing-tool-btn"
            title={
              state.orientation === 'horizontal' ? 'Show this toolbar vertically' : 'Show this toolbar horizontally'
            }
            onClick={toggleOrientation}
          >
            {state.orientation === 'horizontal' ? <Rows3 size={15} /> : <Columns3 size={15} />}
          </button>
          <button
            type="button"
            className="drawing-tool-btn"
            title={`Minimise ${title.toLowerCase()}`}
            onClick={toggleMinimised}
          >
            <Minimize2 size={15} />
          </button>
        </>
      )}
    </div>
  )
}
