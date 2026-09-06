import type { CSSProperties } from 'react'
import type { SystemProperties } from '../types'

export const NODE_FONT_MIN = 8
export const NODE_FONT_MAX = 28
export const NODE_FONT_DEFAULT = 13

export const NODE_FONT_FAMILIES = [
  { id: 'default', label: 'Default', css: 'var(--font)' },
  { id: 'segoe', label: 'Segoe UI', css: '"Segoe UI", system-ui, sans-serif' },
  { id: 'arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { id: 'calibri', label: 'Calibri', css: 'Calibri, "Segoe UI", sans-serif' },
  { id: 'trebuchet', label: 'Trebuchet MS', css: '"Trebuchet MS", sans-serif' },
  { id: 'verdana', label: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
  { id: 'georgia', label: 'Georgia', css: 'Georgia, "Times New Roman", serif' },
  { id: 'times', label: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { id: 'consolas', label: 'Consolas', css: 'Consolas, "Cascadia Code", monospace' },
] as const

export const NODE_FONT_WEIGHTS = [
  { id: '400', label: 'Regular' },
  { id: '500', label: 'Medium' },
  { id: '600', label: 'Semibold' },
  { id: '700', label: 'Bold' },
] as const

export function parseNodeFontSize(properties?: SystemProperties): number {
  const value = Number(properties?.fontSize)
  if (!Number.isFinite(value)) return NODE_FONT_DEFAULT
  return Math.min(NODE_FONT_MAX, Math.max(NODE_FONT_MIN, Math.round(value)))
}

export function parseNodeFontFamily(properties?: SystemProperties): string {
  const id = properties?.fontFamily?.trim() || 'default'
  return NODE_FONT_FAMILIES.some((font) => font.id === id) ? id : 'default'
}

export function parseNodeFontWeight(properties?: SystemProperties): string {
  const weight = properties?.fontWeight?.trim()
  return NODE_FONT_WEIGHTS.some((item) => item.id === weight) ? weight! : '600'
}

export function parseNodeFontStyle(properties?: SystemProperties): 'normal' | 'italic' {
  return properties?.fontStyle === 'italic' ? 'italic' : 'normal'
}

export function withNodeFontSize(
  properties: SystemProperties | undefined,
  style?: CSSProperties,
): CSSProperties {
  const family = NODE_FONT_FAMILIES.find((font) => font.id === parseNodeFontFamily(properties))
  const textColor = properties?.textColor?.trim()
  return {
    ...style,
    ['--node-font-size' as string]: `${parseNodeFontSize(properties)}px`,
    ['--node-font-family' as string]: family?.css ?? 'var(--font)',
    ['--node-font-weight' as string]: parseNodeFontWeight(properties),
    ['--node-font-style' as string]: parseNodeFontStyle(properties),
    ...(textColor ? { ['--node-text-color' as string]: textColor } : {}),
  }
}
