import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider, type Edge, type Node } from '@xyflow/react'
import {
  Braces,
  Cloud,
  Download,
  FileDown,
  FileJson,
  FileText,
  FolderGit2,
  FolderOpen,
  History,
  LayoutGrid,
  Plus,
  Presentation,
  Settings,
  Scale,
  Sparkles,
  Ticket,
  Upload,
  UploadCloud,
} from 'lucide-react'
import { CodeLinksPanel } from './components/CodeLinksPanel'
import { WorkItemsPanel } from './components/WorkItemsPanel'
import { SettingsPanel, type SettingsTab } from './components/SettingsPanel'
import { CloudBrowserModal } from './components/CloudBrowserModal'
import { writeCloudSelection } from './utils/cloud/writeSelection'
import { RepoBrowserModal } from './components/RepoBrowserModal'
import { SwaggerInjectorModal } from './components/SwaggerInjectorModal'
import { AiDiagramModal } from './components/AiDiagramModal'
import { AiAnalysisModal } from './components/AiAnalysisModal'
import { AuditTrailPanel } from './components/AuditTrailPanel'

import { isAzureDevOpsConnected, isGitHubConnected } from './utils/gitCredentials'

import { collectLinkedWorkItems } from './utils/workItemLink'
import { writeAzureFile } from './utils/gitProviders/azureDevOpsApi'
import { writeGitHubFile } from './utils/gitProviders/githubApi'
import type { RepoSelection } from './utils/gitProviders/types'
import { GitApiError } from './utils/gitProviders/apiClient'
import { ProjectTabs } from './components/ProjectTabs'
import { SubTabBar } from './components/SubTabBar'
import { TemplatePicker } from './components/TemplatePicker'
import { getLinkedSystems } from './utils/codeLink'
import type { ArchitectureDocument, PaletteItem, SystemNode } from './types'
import { createProjectTab, type ProjectTab } from './types/project'
import {
  addSystemsInView,
  addTemplatedSubDiagram,
  deleteIntegrationInView,
  removeSubTab,
  deleteSystemInView,
  ensureSubDiagram,
  getDiagramView,
  listSubTabs,
  updateIntegrationInView,
  updateSystemInView,
} from './utils/diagramNavigation'
import { ComponentPalette } from './components/ComponentPalette'
import { DiagramBreadcrumb } from './components/DiagramBreadcrumb'
import { DrawModeControls } from './components/DrawModeControls'
import { AppMenuBar, type AppMenuGroup } from './components/AppMenuBar'
import { IntegrationCanvas, type IntegrationCanvasHandle } from './components/IntegrationCanvas'
import { JsonPanel } from './components/JsonPanel'
import { PropertiesPanel } from './components/PropertiesPanel'
import {
  downloadJson,
  parseArchitectureJson,
  serializeArchitecture,
  type IntegrationEdgeData,
  type IntegrationNodeData,
} from './utils/jsonIO'
import {
  createFromTemplate,
  type ArchitectureTemplateId,
} from './data/templates'
import { mergeGeneratedIntoView, type AiPlacement } from './utils/aiDiagram'
import { applyAudit, type AuditExtras } from './utils/auditLog'
import { countSavedKeys } from './utils/aiProviders'
import {
  exitElementFullscreen,
  isElementFullscreen,
  loadMenusHidden,
  requestElementFullscreen,
  saveMenusHidden,
  subscribeFullscreenChange,
} from './utils/fullscreen'
import {
  autosaveFingerprint,
  formatAutosaveTime,
  loadProjectAutosave,
  saveProjectAutosave,
} from './utils/projectAutosave'

function createInitialWorkspace() {
  const restored = loadProjectAutosave()
  if (restored) return restored
  const tab = createProjectTab(createFromTemplate('enterprise'))
  return { tabs: [tab], activeTabId: tab.id, savedAt: null as string | null }
}

const INITIAL_WORKSPACE = createInitialWorkspace()

function App() {
  const [tabs, setTabs] = useState<ProjectTab[]>(INITIAL_WORKSPACE.tabs)
  const [activeTabId, setActiveTabId] = useState(INITIAL_WORKSPACE.activeTabId)
  const [selectedNode, setSelectedNode] = useState<Node<IntegrationNodeData> | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge<IntegrationEdgeData> | null>(null)
  const [showJsonPanel, setShowJsonPanel] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showCodeLinks, setShowCodeLinks] = useState(false)
  const [showWorkItems, setShowWorkItems] = useState(false)
  const [showAuditTrail, setShowAuditTrail] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('ai')
  const [repoBrowserMode, setRepoBrowserMode] = useState<'pull' | 'push' | null>(null)
  const [cloudBrowserMode, setCloudBrowserMode] = useState<'open' | 'save' | null>(null)
  const [gitMessage, setGitMessage] = useState<string | null>(null)
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [templatePickerMode, setTemplatePickerMode] = useState<'project' | 'sub-tab'>('project')
  const [showSwaggerInjector, setShowSwaggerInjector] = useState(false)
  const [showAiDiagram, setShowAiDiagram] = useState(false)
  const [aiChatMounted, setAiChatMounted] = useState(false)
  const [showAiAnalysis, setShowAiAnalysis] = useState(false)
  const [analysisFocus, setAnalysisFocus] = useState<string | undefined>(undefined)

  const [exporting, setExporting] = useState(false)
  const [menusHidden, setMenusHidden] = useState(loadMenusHidden)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const canvasRef = useRef<IntegrationCanvasHandle>(null)
  const appRef = useRef<HTMLDivElement>(null)
  const autoHidMenusRef = useRef(false)
  const skipFirstAutosave = useRef(true)
  const autosaveTimer = useRef<number | null>(null)
  const tabsRef = useRef(tabs)
  const activeTabIdRef = useRef(activeTabId)
  const lastAutosaveJson = useRef(autosaveFingerprint(INITIAL_WORKSPACE.tabs, INITIAL_WORKSPACE.activeTabId))
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    INITIAL_WORKSPACE.savedAt ? 'saved' : 'idle',
  )
  const [autosaveAt, setAutosaveAt] = useState<string | null>(INITIAL_WORKSPACE.savedAt)

  tabsRef.current = tabs
  activeTabIdRef.current = activeTabId

  const gitConnected = isGitHubConnected() || isAzureDevOpsConnected()

  const savedAiKeys = countSavedKeys()

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]
  const document = activeTab.document
  const drillPath = activeTab.drillPath
  const diagramView = getDiagramView(document, drillPath)
  const linkedCount = getLinkedSystems(document.systems).length
  const workItemCount = collectLinkedWorkItems(document).length

  const updateActiveTab = useCallback(
    (updater: (tab: ProjectTab) => ProjectTab) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? updater(t) : t)),
      )
    },
    [activeTabId],
  )

  const setDocument = useCallback(
    (
      doc: ArchitectureDocument | ((prev: ArchitectureDocument) => ArchitectureDocument),
      extras?: AuditExtras,
    ) => {
      updateActiveTab((tab) => {
        const next = typeof doc === 'function' ? doc(tab.document) : doc
        if (next === tab.document) return tab
        return { ...tab, document: applyAudit(tab.document, next, extras) }
      })
    },
    [updateActiveTab],
  )

  const handleClearAudit = useCallback(() => {
    updateActiveTab((tab) => ({
      ...tab,
      document: { ...tab.document, audit: [] },
    }))
  }, [updateActiveTab])

  const remountCanvas = useCallback(() => {
    updateActiveTab((tab) => ({ ...tab, canvasKey: tab.canvasKey + 1 }))
  }, [updateActiveTab])

  const setDrillPath = useCallback(
    (path: ProjectTab['drillPath']) => {
      updateActiveTab((tab) => ({
        ...tab,
        drillPath: path,
        canvasKey: tab.canvasKey + 1,
      }))
    },
    [updateActiveTab],
  )

  const handleDrillInto = useCallback(
    (systemId: string, label: string) => {
      updateActiveTab((tab) => ({
        ...tab,
        document: applyAudit(
          tab.document,
          ensureSubDiagram(tab.document, tab.drillPath, systemId),
          { kind: 'navigate', summary: `Opened sub-diagram for ${label}` },
        ),
        drillPath: [...tab.drillPath, { systemId, label }],
        canvasKey: tab.canvasKey + 1,
      }))
      clearSelection()
    },
    [updateActiveTab],
  )

  const handleNavigateDiagram = useCallback(
    (depth: number) => {
      setDrillPath(drillPath.slice(0, depth))
      clearSelection()
    },
    [drillPath, setDrillPath],
  )

  const clearSelection = () => {
    setSelectedNode(null)
    setSelectedEdge(null)
    setFocusNodeId(null)
  }

  const handleSelectTab = (id: string) => {
    setActiveTabId(id)
    clearSelection()
  }

  const handleNewTab = () => {
    setTemplatePickerMode('project')
    setShowTemplatePicker(true)
  }

  const handleNewSubTab = () => {
    setTemplatePickerMode('sub-tab')
    setShowTemplatePicker(true)
  }

  const handleRemoveSubTab = (tab: { id: string; path: typeof drillPath; kind: 'overview' | 'sub' }) => {
    if (tab.kind === 'overview') return
    updateActiveTab((current) => {
      const nextPath = current.drillPath.some((segment) => segment.systemId === tab.id)
        ? tab.path.slice(0, -1)
        : current.drillPath
      return {
        ...current,
        document: applyAudit(current.document, removeSubTab(current.document, tab.path), {
          kind: 'remove',
          summary: `Removed sub-diagram ${tab.path[tab.path.length - 1]?.label ?? tab.id}`,
        }),
        drillPath: nextPath,
        canvasKey: current.canvasKey + 1,
      }
    })
    clearSelection()
  }

  const handleSelectTemplate = (id: ArchitectureTemplateId) => {
    const stamped = createFromTemplate(id)
    const doc = applyAudit(stamped, stamped, {
      kind: 'add',
      summary: `Created from template “${id}”`,
    })
    if (templatePickerMode === 'sub-tab') {
      updateActiveTab((tab) => {
        const added = addTemplatedSubDiagram(tab.document, tab.drillPath, doc)
        return {
          ...tab,
          document: applyAudit(tab.document, added.document, {
            kind: 'add',
            summary: `Added sub-diagram from template “${id}”`,
          }),
          drillPath: [...tab.drillPath, { systemId: added.systemId, label: added.label }],
          canvasKey: tab.canvasKey + 1,
        }
      })
      setShowTemplatePicker(false)
      clearSelection()
      return
    }

    const newTab = createProjectTab(doc)
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setShowTemplatePicker(false)
    clearSelection()
  }

  const handleCloseTab = (id: string) => {
    if (tabs.length <= 1) return
    const index = tabs.findIndex((t) => t.id === id)
    const newTabs = tabs.filter((t) => t.id !== id)
    setTabs(newTabs)
    if (activeTabId === id) {
      const next = newTabs[Math.min(index, newTabs.length - 1)]
      setActiveTabId(next.id)
    }
    clearSelection()
  }

  const handleDragStart = (event: React.DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData('application/architecture-component', JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleImport = useCallback(
    (json: string, asNewTab = false) => {
      try {
        const parsed = parseArchitectureJson(json)
        setJsonError(null)

        if (asNewTab) {
          const newTab = createProjectTab(
            applyAudit(parsed, parsed, { kind: 'import', summary: 'Imported architecture JSON' }),
          )
          setTabs((prev) => [...prev, newTab])
          setActiveTabId(newTab.id)
        } else {
          updateActiveTab((tab) => ({
            ...tab,
            document: applyAudit(tab.document, parsed, {
              kind: 'import',
              summary: 'Replaced project from JSON',
            }),
            drillPath: [],
            canvasKey: tab.canvasKey + 1,
          }))
        }

        clearSelection()
        return true
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : 'Invalid JSON')
        return false
      }
    },
    [updateActiveTab],
  )

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      handleImport(content, true)
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const handleExport = () => {
    downloadJson(document)
  }

  const runOfficeExport = async (kind: 'pptx' | 'docx') => {
    setExporting(true)
    setGitMessage(null)
    try {
      const { buildArchitectureBrief } = await import('./utils/architectureNarrative')
      const brief = buildArchitectureBrief(document)
      const image = await canvasRef.current?.capturePng()
      if (kind === 'pptx') {
        const { exportArchitecturePptx } = await import('./utils/exportPptx')
        await exportArchitecturePptx(brief, image)
        setGitMessage('Downloaded PowerPoint briefing')
      } else {
        const { exportArchitectureDocx } = await import('./utils/exportDocx')
        await exportArchitectureDocx(brief, image)
        setGitMessage('Downloaded Word Solution Architecture Document')
      }
    } catch (err) {
      setGitMessage(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handlePushToRepo = async (selection: RepoSelection) => {
    const fileName = `${document.metadata.name.replace(/\s+/g, '-').toLowerCase()}.json`
    const filePath = selection.path ? `${selection.path}/${fileName}` : fileName
    const content = serializeArchitecture(document)
    const message = `Update architecture: ${document.metadata.name}`

    setGitMessage(null)
    try {
      if (selection.provider === 'github') {
        const [owner, repo] = selection.repo.split('/')
        await writeGitHubFile(owner, repo, filePath, selection.branch, content, message)
      } else {
        await writeAzureFile(
          selection.azureProject!,
          selection.azureRepoId!,
          `/${filePath}`,
          selection.branch,
          content,
          message,
        )
      }
      setGitMessage(`Pushed to ${selection.repo}/${filePath}`)
    } catch (err) {
      setGitMessage(err instanceof GitApiError ? err.message : 'Push failed')
    }
    setRepoBrowserMode(null)
  }

  const handleOpenJsonEditor = () => {
    setJsonError(null)
    setShowJsonPanel(true)
  }

  const handleApplyJson = (json: string) => {
    if (handleImport(json)) {
      setShowJsonPanel(false)
    }
  }

  const handleUpdateNode = (id: string, data: Partial<IntegrationNodeData>) => {
    setDocument((prev) =>
      updateSystemInView(prev, drillPath, id, (s) => ({
        ...s,
        type: data.systemType ?? s.type,
        label: data.label ?? s.label,
        category: data.category ?? s.category,
        properties: data.properties ? { ...s.properties, ...data.properties } : s.properties,
      })),
    )
    remountCanvas()
  }

  const handleUpdateEdge = (id: string, data: Partial<IntegrationEdgeData>) => {
    setDocument((prev) =>
      updateIntegrationInView(prev, drillPath, id, (i) => ({
        ...i,
        label: data.label ?? i.label,
        direction: data.direction ?? i.direction,
        protocol: data.protocol ?? i.protocol,
        frequency: data.frequency ?? i.frequency,
        dataFormat: data.dataFormat ?? i.dataFormat,
        description: data.description ?? i.description,
        interfaceSpec: data.interfaceSpec !== undefined ? data.interfaceSpec : i.interfaceSpec,
        color: 'color' in data ? data.color : i.color,
        changeStatus: 'changeStatus' in data ? data.changeStatus : i.changeStatus,
        routing: data.routing ?? i.routing,
        waypoints: 'waypoints' in data ? data.waypoints : i.waypoints,
        jiraIssueKey: 'jiraIssueKey' in data ? data.jiraIssueKey : i.jiraIssueKey,
        jiraIssueSummary: 'jiraIssueSummary' in data ? data.jiraIssueSummary : i.jiraIssueSummary,
        jiraIssueUrl: 'jiraIssueUrl' in data ? data.jiraIssueUrl : i.jiraIssueUrl,
        adoProject: 'adoProject' in data ? data.adoProject : i.adoProject,
        adoWorkItemId: 'adoWorkItemId' in data ? data.adoWorkItemId : i.adoWorkItemId,
        adoWorkItemTitle: 'adoWorkItemTitle' in data ? data.adoWorkItemTitle : i.adoWorkItemTitle,
        adoWorkItemUrl: 'adoWorkItemUrl' in data ? data.adoWorkItemUrl : i.adoWorkItemUrl,
      })),
    )
    remountCanvas()
  }

  const handleDeleteNode = (id: string) => {
    setDocument((prev) => deleteSystemInView(prev, drillPath, id))
    setSelectedNode(null)
    remountCanvas()
  }

  const handleDeleteEdge = (id: string) => {
    setDocument((prev) => deleteIntegrationInView(prev, drillPath, id))
    setSelectedEdge(null)
    remountCanvas()
  }

  const handleInjectSwaggerSystems = (systems: SystemNode[]) => {
    setDocument((prev) => addSystemsInView(prev, drillPath, systems))
    remountCanvas()
  }

  const toggleMenus = useCallback(() => {
    autoHidMenusRef.current = false
    setMenusHidden((prev) => !prev)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const el = appRef.current
    if (!el) return
    try {
      if (isElementFullscreen(el)) {
        await exitElementFullscreen()
      } else {
        await requestElementFullscreen(el)
      }
    } catch {
      setGitMessage('Fullscreen is not available in this browser')
    }
  }, [])

  useEffect(() => {
    saveMenusHidden(menusHidden)
  }, [menusHidden])

  const flushAutosave = useCallback(() => {
    const fingerprint = autosaveFingerprint(tabsRef.current, activeTabIdRef.current)
    if (fingerprint === lastAutosaveJson.current) {
      setAutosaveStatus((prev) => (prev === 'saving' ? 'saved' : prev))
      return
    }
    try {
      const savedAt = saveProjectAutosave(tabsRef.current, activeTabIdRef.current)
      lastAutosaveJson.current = fingerprint
      setAutosaveAt(savedAt)
      setAutosaveStatus('saved')
    } catch {
      setAutosaveStatus('error')
    }
  }, [])

  useEffect(() => {
    if (skipFirstAutosave.current) {
      skipFirstAutosave.current = false
      return
    }
    setAutosaveStatus('saving')
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(() => {
      flushAutosave()
      autosaveTimer.current = null
    }, 400)
    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current)
        autosaveTimer.current = null
      }
    }
  }, [tabs, activeTabId, flushAutosave])

  useEffect(() => {
    const onLeave = () => flushAutosave()
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [flushAutosave])

  useEffect(() => {
    const syncFullscreen = () => {
      const active = isElementFullscreen(appRef.current)
      setIsFullscreen(active)
      if (!active && autoHidMenusRef.current) {
        setMenusHidden(false)
        autoHidMenusRef.current = false
      }
    }
    syncFullscreen()
    return subscribeFullscreenChange(syncFullscreen)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const inField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      if (inField) return

      if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
        event.preventDefault()
        toggleMenus()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        void toggleFullscreen()
        return
      }
      if (event.key === 'Escape' && menusHidden && !isElementFullscreen(appRef.current)) {
        autoHidMenusRef.current = false
        setMenusHidden(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menusHidden, toggleFullscreen, toggleMenus])

  const handleAiGenerate = (generated: ArchitectureDocument, placement: AiPlacement) => {
    if (placement === 'new-tab') {
      const newTab = createProjectTab(
        applyAudit(generated, generated, { kind: 'ai', summary: 'Drew architecture with AI' }),
      )
      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTab.id)
    } else if (placement === 'replace') {
      updateActiveTab((tab) => ({
        ...tab,
        document: applyAudit(tab.document, generated, { kind: 'ai', summary: 'Replaced diagram with AI' }),
        drillPath: [],
        canvasKey: tab.canvasKey + 1,
      }))
    } else {
      setDocument(
        (prev) => mergeGeneratedIntoView(prev, drillPath, generated),
        { kind: 'ai', summary: 'Merged AI-generated architecture' },
      )
      remountCanvas()
    }
    clearSelection()
    setGitMessage(
      `Drew ${generated.systems.length} systems and ${generated.integrations.length} integrations with SpaceXAI`,
    )
  }

  const menus: AppMenuGroup[] = useMemo(
    () => [
      {
        id: 'file',
        label: 'File',
        items: [
          { id: 'new-tab', label: 'New tab', hint: 'Start from a template', icon: Plus, onSelect: handleNewTab },
          {
            id: 'import',
            label: 'Import JSON…',
            hint: 'Open a project file',
            icon: Upload,
            onSelect: () => fileInputRef.current?.click(),
          },
          { id: 'edit-json', label: 'Edit JSON', hint: 'Raw architecture document', icon: FileJson, onSelect: handleOpenJsonEditor },
          { id: 'sep-export', type: 'separator' },
          {
            id: 'export-json',
            label: 'Export JSON',
            hint: 'Machine-readable project file',
            icon: FileDown,
            disabled: exporting,
            onSelect: handleExport,
          },
          {
            id: 'export-pptx',
            label: 'Export PowerPoint',
            hint: 'Diagram plus spoken briefing',
            icon: Presentation,
            disabled: exporting,
            onSelect: () => void runOfficeExport('pptx'),
          },
          {
            id: 'export-docx',
            label: 'Export Word SAD',
            hint: 'Solution Architecture Document',
            icon: FileText,
            disabled: exporting,
            onSelect: () => void runOfficeExport('docx'),
          },
        ],
      },
      {
        id: 'cloud',
        label: 'Cloud & Git',
        items: [
          { id: 'cloud-open', label: 'Open from cloud…', hint: 'OneDrive, SharePoint, Google, iCloud', icon: Cloud, onSelect: () => setCloudBrowserMode('open') },
          { id: 'cloud-save', label: 'Save to cloud…', hint: 'Write this project as JSON', icon: Cloud, onSelect: () => setCloudBrowserMode('save') },
          { id: 'sep-git', type: 'separator' },
          {
            id: 'git-pull',
            label: 'Pull from Git…',
            hint: gitConnected ? 'GitHub or Azure DevOps' : 'Connect Git in Settings first',
            icon: Download,
            disabled: !gitConnected,
            onSelect: () => setRepoBrowserMode('pull'),
          },
          {
            id: 'git-push',
            label: 'Push to Git…',
            hint: gitConnected ? 'GitHub or Azure DevOps' : 'Connect Git in Settings first',
            icon: UploadCloud,
            disabled: !gitConnected,
            onSelect: () => setRepoBrowserMode('push'),
          },
        ],
      },
      {
        id: 'ai',
        label: 'AI',
        items: [
          {
            id: 'draw-ai',
            label: 'Draw with AI…',
            hint: 'Generate or refine the diagram',
            icon: Sparkles,
            onSelect: () => {
              setAiChatMounted(true)
              setShowAiDiagram(true)
            },
          },
          {
            id: 'analyze',
            label: 'Analyze capabilities…',
            hint: 'Pros and cons of the landscape',
            icon: Scale,
            onSelect: () => {
              setAnalysisFocus(undefined)
              setShowAiAnalysis(true)
            },
          },
        ],
      },
      {
        id: 'tools',
        label: 'Tools',
        items: [
          { id: 'swagger', label: 'Inject Swagger…', hint: 'Add APIs from an OpenAPI spec', icon: Braces, onSelect: () => setShowSwaggerInjector(true) },
          {
            id: 'code-links',
            label: linkedCount > 0 ? `Code links (${linkedCount})` : 'Code links',
            hint: 'Components linked to repositories',
            icon: FolderGit2,
            onSelect: () => setShowCodeLinks(true),
          },
          {
            id: 'work-items',
            label: workItemCount > 0 ? `Work items (${workItemCount})` : 'Work items',
            hint: 'Jira and Azure DevOps links',
            icon: Ticket,
            onSelect: () => setShowWorkItems(true),
          },
          {
            id: 'audit',
            label: (document.audit?.length ?? 0) > 0 ? `Audit trail (${document.audit?.length})` : 'Audit trail',
            hint: 'History of every project change',
            icon: History,
            onSelect: () => setShowAuditTrail(true),
          },
        ],
      },
      {
        id: 'view',
        label: 'View',
        items: [
          {
            id: 'menus',
            label: menusHidden ? 'Show menus' : 'Hide menus',
            shortcut: 'Ctrl+\\',
            onSelect: toggleMenus,
          },
          {
            id: 'fullscreen',
            label: isFullscreen ? 'Exit fullscreen' : 'Draw fullscreen',
            shortcut: 'Ctrl+Shift+F',
            onSelect: () => void toggleFullscreen(),
          },
        ],
      },
      {
        id: 'settings',
        label: 'Settings',
        items: [
          {
            id: 'settings-ai',
            label: 'AI engines',
            hint: savedAiKeys > 0 ? `${savedAiKeys} key${savedAiKeys === 1 ? '' : 's'} saved` : 'Keys and default model',
            icon: Settings,
            onSelect: () => {
              setSettingsTab('ai')
              setShowSettings(true)
            },
          },
          {
            id: 'settings-git',
            label: 'Git',
            hint: 'GitHub and Azure DevOps',
            icon: UploadCloud,
            onSelect: () => {
              setSettingsTab('git')
              setShowSettings(true)
            },
          },
          {
            id: 'settings-jira',
            label: 'Jira',
            hint: 'Work item linking',
            icon: Ticket,
            onSelect: () => {
              setSettingsTab('jira')
              setShowSettings(true)
            },
          },
          {
            id: 'settings-cloud',
            label: 'Cloud storage',
            hint: 'OneDrive, SharePoint, Google, iCloud',
            icon: Cloud,
            onSelect: () => {
              setSettingsTab('cloud')
              setShowSettings(true)
            },
          },
        ],
      },
    ],
    [
      exporting,
      gitConnected,
      handleExport,
      handleNewTab,
      handleOpenJsonEditor,
      isFullscreen,
      linkedCount,
      menusHidden,
      document.audit?.length,
      runOfficeExport,
      savedAiKeys,
      toggleFullscreen,
      toggleMenus,
      workItemCount,
    ],
  )

  return (
    <div
      ref={appRef}
      className={`app${menusHidden ? ' menus-hidden' : ''}${isFullscreen ? ' is-fullscreen' : ''}`}
    >
      <header className="toolbar">
        <div className="toolbar-brand">
          <LayoutGrid size={22} />
          <div>
            <h1>Architecture Visual Builder</h1>
            <span>End-to-end integration mapping · SaaS · Cloud · On-Premise</span>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={handleFileUpload}
        />
        <AppMenuBar
          menus={menus}
          trailing={
            <DrawModeControls
              variant="compact"
              isFullscreen={isFullscreen}
              menusHidden={menusHidden}
              onToggleFullscreen={() => void toggleFullscreen()}
              onToggleMenus={toggleMenus}
            />
          }
        />
      </header>

      <ProjectTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
      />
      <SubTabBar
        tabs={listSubTabs(document, drillPath)}
        currentPath={drillPath}
        onSelect={(path) => {
          setDrillPath(path)
          clearSelection()
        }}
        onNewFromTemplate={handleNewSubTab}
        onRemove={handleRemoveSubTab}
      />

      <div className="workspace">
        <ComponentPalette onDragStart={handleDragStart} />
        <main className="canvas-area">
          <div className="doc-title">
            <FolderOpen size={16} />
            <input
              className="doc-name-input"
              value={document.metadata.name}
              onChange={(e) =>
                setDocument((prev) => ({
                  ...prev,
                  metadata: { ...prev.metadata, name: e.target.value },
                }))
              }
            />
            <span className="doc-stats">
              {diagramView.systems.length} systems · {diagramView.integrations.length} integrations
              {drillPath.length > 0 && ' (detail)'}
            </span>
            <span
              className={`autosave-status autosave-${autosaveStatus}`}
              title={
                autosaveStatus === 'error'
                  ? 'Could not autosave (browser storage may be full)'
                  : autosaveAt
                    ? `Last autosave ${new Date(autosaveAt).toLocaleString()}`
                    : 'Changes save automatically in this browser'
              }
            >
              {autosaveStatus === 'saving' && 'Saving…'}
              {autosaveStatus === 'saved' && `Autosaved${autosaveAt ? ` ${formatAutosaveTime(autosaveAt)}` : ''}`}
              {autosaveStatus === 'error' && 'Autosave failed'}
              {autosaveStatus === 'idle' && 'Autosave on'}
            </span>
          </div>
          <DiagramBreadcrumb
            documentName={document.metadata.name}
            drillPath={drillPath}
            levelLabel={diagramView.parentLabel}
            onNavigate={handleNavigateDiagram}
          />
          <div className="canvas-flow">
            <ReactFlowProvider>
              <IntegrationCanvas
                ref={canvasRef}
                key={`${activeTab.id}-${activeTab.canvasKey}`}
              document={document}
              diagramPath={drillPath}
              onDocumentChange={setDocument}
              onDrillInto={handleDrillInto}
              onSelectionChange={(node, edge) => {
                setSelectedNode(node)
                setSelectedEdge(edge)
              }}
              focusNodeId={focusNodeId}
              onFocusComplete={() => setFocusNodeId(null)}
              isFullscreen={isFullscreen}
              menusHidden={menusHidden}
              onToggleFullscreen={() => void toggleFullscreen()}
              onToggleMenus={toggleMenus}
              onOpenAi={() => {
                setAiChatMounted(true)
                setShowAiDiagram(true)
              }}
              selectionKey={selectedNode?.id ?? selectedEdge?.id ?? null}
              properties={
                <PropertiesPanel
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  drillPath={drillPath}
                  document={document}
                  onUpdateNode={handleUpdateNode}
                  onUpdateEdge={handleUpdateEdge}
                  onDeleteNode={handleDeleteNode}
                  onDeleteEdge={handleDeleteEdge}
                  onDrillInto={handleDrillInto}
                  onAnalyzeCapability={(label) => {
                    setAnalysisFocus(label)
                    setShowAiAnalysis(true)
                  }}
                />
              }
            />
            </ReactFlowProvider>
          </div>
        </main>
      </div>

      {showJsonPanel && (
        <JsonPanel
          json={serializeArchitecture(document)}
          error={jsonError}
          onApply={handleApplyJson}
          onClose={() => setShowJsonPanel(false)}
        />
      )}

      {showCodeLinks && (
        <CodeLinksPanel
          systems={document.systems}
          onClose={() => setShowCodeLinks(false)}
          onSelectSystem={(id) => {
            setShowCodeLinks(false)
            setFocusNodeId(id)
          }}
        />
      )}

      {showWorkItems && (
        <WorkItemsPanel
          document={document}
          onClose={() => setShowWorkItems(false)}
          onSelectSystem={(id) => {
            setShowWorkItems(false)
            setFocusNodeId(id)
          }}
        />
      )}

      {showAuditTrail && (
        <AuditTrailPanel
          document={document}
          onClose={() => setShowAuditTrail(false)}
          onClear={handleClearAudit}
        />
      )}

      {showSettings && (
        <SettingsPanel
          tab={settingsTab}
          onTabChange={setSettingsTab}
          onClose={() => setShowSettings(false)}
        />
      )}

      {repoBrowserMode && (
        <RepoBrowserModal
          mode={repoBrowserMode}
          onClose={() => setRepoBrowserMode(null)}
          onPullJson={(content) => handleImport(content, true)}
          onPushPath={handlePushToRepo}
        />
      )}

      {cloudBrowserMode && (
        <CloudBrowserModal
          mode={cloudBrowserMode}
          suggestedName={`${document.metadata.name.replace(/\s+/g, '-').toLowerCase()}.json`}
          onClose={() => setCloudBrowserMode(null)}
          onOpen={(content, selection) => {
            handleImport(content, true)
            setCloudBrowserMode(null)
            setGitMessage(`Opened ${selection.fileName} from ${selection.store}`)
          }}
          onSave={async (selection) => {
            await writeCloudSelection(selection, serializeArchitecture(document))
            setCloudBrowserMode(null)
            setGitMessage(`Saved ${selection.fileName} to ${selection.store}`)
          }}
        />
      )}

      {showTemplatePicker && (
        <TemplatePicker
          mode={templatePickerMode}
          onSelect={handleSelectTemplate}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}

      {showSwaggerInjector && (
        <SwaggerInjectorModal
          mode="canvas"
          existingSystems={diagramView.systems}
          onInjectSystems={handleInjectSwaggerSystems}
          onClose={() => setShowSwaggerInjector(false)}
        />
      )}

      {aiChatMounted && (
        <AiDiagramModal
          open={showAiDiagram}
          currentDocument={document}
          onGenerate={handleAiGenerate}
          onManageKeys={() => {
            setShowAiDiagram(false)
            setSettingsTab('ai')
            setShowSettings(true)
          }}
          onClose={() => setShowAiDiagram(false)}
        />
      )}

      {showAiAnalysis && (
        <AiAnalysisModal
          document={document}
          focusLabel={analysisFocus}
          onManageKeys={() => {
            setShowAiAnalysis(false)
            setSettingsTab('ai')
            setShowSettings(true)
          }}
          onClose={() => setShowAiAnalysis(false)}
        />
      )}

      {gitMessage && (
        <div className="git-toast" onClick={() => setGitMessage(null)}>
          {gitMessage}
        </div>
      )}

    </div>
  )
}

export default App