import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import type { IntegrationNodeData } from '../../utils/jsonIO'

export function AnnotationNode({ data, selected }: NodeProps) {
  const nodeData = data as IntegrationNodeData
  const bgColor = nodeData.properties.color ?? '#fef9c3'
  const borderColor = nodeData.properties.borderColor ?? '#fde047'

  return (
    <>
      <NodeResizer
        minWidth={120}
        minHeight={80}
        isVisible={selected}
        lineClassName="resize-line"
        handleClassName="resize-handle"
      />
      <Handle type="target" position={Position.Top} id="t-top" className="shape-handle" />
      <Handle type="source" position={Position.Top} id="s-top" className="shape-handle shape-handle-source" />
      <Handle type="target" position={Position.Right} id="t-right" className="shape-handle" />
      <Handle type="source" position={Position.Right} id="s-right" className="shape-handle shape-handle-source" />
      <Handle type="target" position={Position.Bottom} id="t-bottom" className="shape-handle" />
      <Handle type="source" position={Position.Bottom} id="s-bottom" className="shape-handle shape-handle-source" />
      <Handle type="target" position={Position.Left} id="t-left" className="shape-handle" />
      <Handle type="source" position={Position.Left} id="s-left" className="shape-handle shape-handle-source" />
      <div
        className={`annotation-node resizable-node ${selected ? 'selected' : ''}`}
        style={
          {
            '--note-bg': bgColor,
            '--note-border': borderColor,
          } as React.CSSProperties
        }
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