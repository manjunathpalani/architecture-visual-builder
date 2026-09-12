import { useState, type CSSProperties, type MouseEvent } from 'react'
import { ChevronDown, ChevronRight, FolderGit2, ListTree } from 'lucide-react'
import type { TechnicalChangeDesign } from '../types'
import {
  CHANGE_KIND_LABELS,
  buildFeatureTree,
  buildFeatureTreeNode,
  type FeatureTreeNode,
} from '../utils/changeDesign'

export interface FeatureTreeSelection {
  designId: string
  storyId?: string
  taskId?: string
  systemId?: string
}

interface FeatureStoryTreeProps {
  designs: TechnicalChangeDesign[]
  /** When set, render this feature only (edit view). */
  design?: TechnicalChangeDesign
  selected?: FeatureTreeSelection | null
  onSelect: (selection: FeatureTreeSelection) => void
}

export function FeatureStoryTree({ designs, design, selected, onSelect }: FeatureStoryTreeProps) {
  const nodes = design ? [buildFeatureTreeNode(design)] : buildFeatureTree(designs)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  if (nodes.length === 0) return null

  const toggle = (id: string, event: MouseEvent) => {
    event.stopPropagation()
    setCollapsed((current) => ({ ...current, [id]: !current[id] }))
  }

  return (
    <ul className="feature-story-tree" role="tree" aria-label="Features, user stories, and linked components">
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          depth={0}
          collapsed={collapsed}
          selected={selected}
          onToggle={toggle}
          onSelect={onSelect}
        />
      ))}
    </ul>
  )
}

function TreeItem({
  node,
  depth,
  collapsed,
  selected,
  onToggle,
  onSelect,
}: {
  node: FeatureTreeNode
  depth: number
  collapsed: Record<string, boolean>
  selected?: FeatureTreeSelection | null
  onToggle: (id: string, event: MouseEvent) => void
  onSelect: (selection: FeatureTreeSelection) => void
}) {
  const hasChildren = node.children.length > 0
  const open = hasChildren && !collapsed[node.id]
  const isSelected = isNodeSelected(node, selected)
  const selection: FeatureTreeSelection = {
    designId: node.designId,
    storyId: node.storyId,
    taskId: node.taskId,
    systemId: node.systemId,
  }

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? open : undefined}
      aria-selected={isSelected}
      style={{ '--tree-depth': String(depth) } as CSSProperties}
    >
      <div
        className={`feature-story-tree-row is-${node.type}${isSelected ? ' is-active' : ''}`}
        onClick={() => onSelect(selection)}
      >
        {hasChildren ? (
          <button
            type="button"
            className="feature-story-tree-toggle"
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={(event) => onToggle(node.id, event)}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="feature-story-tree-toggle is-leaf">
            {node.type === 'component' ? <FolderGit2 size={12} /> : <ListTree size={12} />}
          </span>
        )}
        <span className="feature-story-tree-label">{node.label}</span>
        {node.changeKind && (
          <span className={`change-kind-badge kind-${node.changeKind}`}>
            {CHANGE_KIND_LABELS[node.changeKind]}
          </span>
        )}
        {node.meta && <span className="feature-story-tree-meta">{node.meta}</span>}
      </div>
      {open && (
        <ul role="group">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              selected={selected}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function isNodeSelected(node: FeatureTreeNode, selected?: FeatureTreeSelection | null): boolean {
  if (!selected || selected.designId !== node.designId) return false
  if (node.type === 'feature') return !selected.storyId && !selected.taskId
  if (node.type === 'component') return Boolean(node.taskId && selected.taskId === node.taskId)
  if (node.type === 'story' || node.type === 'unassigned') {
    return Boolean(node.storyId && selected.storyId === node.storyId && !selected.taskId)
  }
  return false
}
