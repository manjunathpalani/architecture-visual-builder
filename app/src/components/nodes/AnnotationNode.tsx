import { NodeResizer, type NodeProps } from '@xyflow/react'
import type { IntegrationNodeData } from '../../utils/jsonIO'
import { NodeConnectors } from './NodeConnectors'
import { withNodeFontSize } from '../../utils/nodeFontSize'
import { useDiagramLock } from './diagramLockContext'

export function AnnotationNode({ data, selected }: NodeProps) {
  const layoutLocked = useDiagramLock()
  const nodeData = data as IntegrationNodeData
  const bgColor = nodeData.properties.color ?? '#fef9c3'
  const borderColor = nodeData.properties.borderColor ?? '#fde047'

  return (
    <>
      <NodeResizer
        minWidth={72}
        minHeight={48}
        isVisible={selected && !layoutLocked}
        lineClassName="resize-line"
        handleClassName="resize-handle"
      />
      <NodeConnectors variant="shape" />
      <div
        className={`annotation-node resizable-node ${selected ? 'selected' : ''}`}
        style={withNodeFontSize(nodeData.properties, {
          '--note-bg': bgColor,
          '--note-border': borderColor,
        } as React.CSSProperties)}
      >
        <div className="annotation-pin" />
        <textarea
          className="annotation-text"
          value={nodeData.properties.content ?? nodeData.label}
          readOnly
          rows={4}
        />
      </div>
    </>
  )
}
