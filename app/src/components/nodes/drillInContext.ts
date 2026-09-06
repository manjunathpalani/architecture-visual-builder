import { createContext, useContext } from 'react'

export const DrillInContext = createContext<(id: string, label: string) => void>(() => undefined)

export function useDrillIn() {
  return useContext(DrillInContext)
}
