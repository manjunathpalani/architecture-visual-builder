import { createContext, useContext } from 'react'
import type { SequenceFlowStep } from '../../types'

export type DrillTargetKind = 'system' | 'integration'

export const DrillInContext = createContext<
  (id: string, label: string, kind?: DrillTargetKind) => void
>(() => undefined)

export function useDrillIn() {
  return useContext(DrillInContext)
}

export const SequenceHopContext = createContext<{
  openHop: (edgeId: string, step: SequenceFlowStep) => void
}>({ openHop: () => undefined })

export function useSequenceHop() {
  return useContext(SequenceHopContext)
}
