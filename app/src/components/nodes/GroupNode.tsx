import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import type { IntegrationNodeData } from '../../utils/jsonIO'

export function GroupNode({ data, selected }: NodeProps) {
  const nodeData = data as IntegrationNodeData
  const color = nodeData.properties.color ?? '#94a3b8'

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={120}
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
        className={`group-node resizable-node ${selected ? 'selected' : ''}`}
        style={{ '--group-color': color } as React.CSSProperties}
      >
        <div className="group-label">{nodeData.label}</div>
      </div>
    </>
  )
}