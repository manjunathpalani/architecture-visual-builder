import type { SystemType } from '../types'

/** Items that can take the same property edit. */
export type PropertyCohort = 'system' | 'diagram' | 'shape' | 'note' | 'group'

const COHORT_ORDER: PropertyCohort[] = ['system', 'diagram', 'shape', 'note', 'group']

export const PROPERTY_COHORT_LABEL: Record<PropertyCohort, string> = {
  system: 'components',
  diagram: 'diagram shapes',
  shape: 'shapes',
  note: 'notes',
  group: 'zones',
}

export function propertyCohort(type: SystemType): PropertyCohort {
  if (type === 'note' || type === 'group' || type === 'shape' || type === 'diagram') return type
  return 'system'
}

export function largestPropertyCohort<T extends { data: { systemType: SystemType } }>(
  nodes: T[],
): { cohort: PropertyCohort; nodes: T[]; excluded: number } {
  const groups = new Map<PropertyCohort, T[]>()
  for (const node of nodes) {
    const key = propertyCohort(node.data.systemType)
    const list = groups.get(key) ?? []
    list.push(node)
    groups.set(key, list)
  }
  let cohort: PropertyCohort = 'system'
  let chosen: T[] = []
  for (const key of COHORT_ORDER) {
    const list = groups.get(key) ?? []
    if (list.length > chosen.length) {
      cohort = key
      chosen = list
    }
  }
  return { cohort, nodes: chosen, excluded: nodes.length - chosen.length }
}
