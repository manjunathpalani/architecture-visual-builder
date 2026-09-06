import { createContext, useContext } from 'react'

interface NodeTitleEditContextValue {
  editingNodeId: string | null
  startEditing: (nodeId: string) => void
  finishEditing: (nodeId: string, label: string) => void
  cancelEditing: () => void
}

const noop = () => undefined

export const NodeTitleEditContext = createContext<NodeTitleEditContextValue>({
  editingNodeId: null,
  startEditing: noop,
  finishEditing: noop,
  cancelEditing: noop,
})

export function useNodeTitleEdit(): NodeTitleEditContextValue {
  return useContext(NodeTitleEditContext)
}
