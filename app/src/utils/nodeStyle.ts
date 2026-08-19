import { SYSTEM_TYPE_CONFIG, type SystemType } from '../types'
import type { IntegrationNodeData } from './jsonIO'

export function getNodeColor(data: IntegrationNodeData): string {
  if (data.properties.color) return data.properties.color
  return SYSTEM_TYPE_CONFIG[data.systemType]?.color ?? '#6366f1'
}

export function getMinimapColor(systemType: SystemType): string {
  if (SYSTEM_TYPE_CONFIG[systemType]) return SYSTEM_TYPE_CONFIG[systemType].color
  return '#94a3b8'
}