import type { ArchitectureDocument } from '../types'
import type { DiagramPath } from './diagram'
import { createEmptyDocument, generateId } from '../utils/jsonIO'

export interface ProjectTab {
  id: string
  document: ArchitectureDocument
  canvasKey: number
  drillPath: DiagramPath
}

export function createProjectTab(
  document?: ArchitectureDocument,
  name?: string,
): ProjectTab {
  const doc = document ?? createEmptyDocument(name)
  if (name && !document) {
    doc.metadata.name = name
  }
  return {
    id: generateId('tab'),
    document: doc,
    canvasKey: 0,
    drillPath: [],
  }
}