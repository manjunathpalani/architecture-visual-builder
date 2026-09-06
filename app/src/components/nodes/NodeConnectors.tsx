import { Handle, Position } from '@xyflow/react'
import type { CSSProperties } from 'react'
import { useDiagramLock } from './diagramLockContext'

type ConnectorVariant = 'node' | 'diagram' | 'shape'

const SIDES: Array<{
  position: Position
  side: 'top' | 'right' | 'bottom' | 'left'
  offsets: Array<{ key: 'start' | 'center' | 'end'; style: CSSProperties }>
}> = [
  {
    position: Position.Top,
    side: 'top',
    offsets: [
      { key: 'start', style: { left: '22%' } },
      { key: 'center', style: { left: '50%' } },
      { key: 'end', style: { left: '78%' } },
    ],
  },
  {
    position: Position.Right,
    side: 'right',
    offsets: [
      { key: 'start', style: { top: '22%' } },
      { key: 'center', style: { top: '50%' } },
      { key: 'end', style: { top: '78%' } },
    ],
  },
  {
    position: Position.Bottom,
    side: 'bottom',
    offsets: [
      { key: 'start', style: { left: '22%' } },
      { key: 'center', style: { left: '50%' } },
      { key: 'end', style: { left: '78%' } },
    ],
  },
  {
    position: Position.Left,
    side: 'left',
    offsets: [
      { key: 'start', style: { top: '22%' } },
      { key: 'center', style: { top: '50%' } },
      { key: 'end', style: { top: '78%' } },
    ],
  },
]

function handleId(kind: 't' | 's', side: string, offset: 'start' | 'center' | 'end') {
  return offset === 'center' ? `${kind}-${side}` : `${kind}-${side}-${offset}`
}

function classNameFor(variant: ConnectorVariant, isSource: boolean) {
  if (variant === 'shape') {
    return isSource ? 'shape-handle shape-handle-source' : 'shape-handle'
  }
  if (variant === 'diagram') return 'node-handle diagram-handle'
  return 'node-handle'
}

export function NodeConnectors({ variant = 'node' }: { variant?: ConnectorVariant }) {
  const layoutLocked = useDiagramLock()
  if (layoutLocked) return null

  return (
    <>
      {SIDES.flatMap(({ position, side, offsets }) =>
        offsets.flatMap(({ key, style }) => [
          <Handle
            key={handleId('t', side, key)}
            type="target"
            position={position}
            id={handleId('t', side, key)}
            className={classNameFor(variant, false)}
            style={style}
          />,
          <Handle
            key={handleId('s', side, key)}
            type="source"
            position={position}
            id={handleId('s', side, key)}
            className={classNameFor(variant, true)}
            style={style}
          />,
        ]),
      )}
    </>
  )
}
