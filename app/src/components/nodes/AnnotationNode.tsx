import { NodeResizer, type NodeProps } from '@xyflow/react'
import type { IntegrationNodeData } from '../../utils/jsonIO'
import { NodeConnectors } from './NodeConnectors'
import { withNodeFontSize } from '../../utils/nodeFontSize'
import { useDiagramLock } from './diagramLockContext'
import { hasRichNotes, renderRichNotes } from '../../utils/richNotes'

export function AnnotationNode({ data, selected }: NodeProps) {
  const layoutLocked = useDiagramLock()
  const nodeData = data as IntegrationNodeData
  const bgColor = nodeData.properties.color ?? '#fef9c3'
  const borderColor = nodeData.properties.borderColor ?? '#fde047'
  const content = nodeData.properties.content ?? nodeData.label ?? ''

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
        {hasRichNotes(content) ? (
          <div
            className="annotation-rich nodrag nowheel"
            dangerouslySetInnerHTML={{ __html: renderRichNotes(content) }}
          />
        ) : (
          <div className="annotation-rich is-empty">Add a rich note in Properties</div>
        )}
      </div>
    </>
  )
}
