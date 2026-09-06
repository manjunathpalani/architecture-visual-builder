import { SYSTEM_TYPE_CONFIG, type SystemProperties, type SystemType } from '../types'
import type { IntegrationNodeData } from './jsonIO'

export type NodeDisplayStyle = 'box' | 'icon'

export const ICON_NODE_SIZE = { width: 96, height: 108 }
export const BOX_NODE_SIZE = { width: 180, height: 90 }

export function getNodeColor(data: IntegrationNodeData): string {
  if (data.properties.color) return data.properties.color
  return SYSTEM_TYPE_CONFIG[data.systemType]?.color ?? '#6366f1'
}

export function parseNodeDisplay(properties?: SystemProperties): NodeDisplayStyle {
  return properties?.display === 'icon' ? 'icon' : 'box'
}

export function sizeForNodeDisplay(
  display: NodeDisplayStyle,
  current?: Pick<SystemProperties, 'width' | 'height'>,
): Pick<SystemProperties, 'width' | 'height'> {
  if (display === 'icon') {
    return { width: String(ICON_NODE_SIZE.width), height: String(ICON_NODE_SIZE.height) }
  }
  const width = Number(current?.width)
  if (width && width < 140) {
    return { width: String(BOX_NODE_SIZE.width), height: String(BOX_NODE_SIZE.height) }
  }
  return { width: current?.width, height: current?.height }
}

export function getMinimapColor(systemType: SystemType): string {
  if (SYSTEM_TYPE_CONFIG[systemType]) return SYSTEM_TYPE_CONFIG[systemType].color
  return '#94a3b8'
}