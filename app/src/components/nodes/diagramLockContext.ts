import { createContext, useContext } from 'react'

export const DiagramLockContext = createContext(false)

export function useDiagramLock(): boolean {
  return useContext(DiagramLockContext)
}
