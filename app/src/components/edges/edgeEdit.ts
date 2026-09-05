import { createContext, useContext } from 'react'
import type { IntegrationEdgeData } from '../../utils/jsonIO'

export const EdgeEditContext = createContext<{
  updateEdgeGeometry: (id: string, patch: Partial<IntegrationEdgeData>) => void
}>({
  updateEdgeGeometry: () => undefined,
})

export function useEdgeEdit() {
  return useContext(EdgeEditContext)
}
