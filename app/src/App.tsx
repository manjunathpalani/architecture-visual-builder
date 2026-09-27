import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider, type Edge, type Node } from '@xyflow/react'
import {
  Braces,
  ClipboardPaste,
  Cloud,
  Copy,
  CopyPlus,
  Database,
  Download,
  FileDown,
  FileImage,
  FileJson,
  FileText,
  NotebookPen,
  ImageDown,
  FolderGit2,
  History,
  LayoutGrid,
  LayoutTemplate,
  Plus,
  Presentation,
  Settings,
  Scale,
  Scissors,
  Sparkles,
  Ticket,
  Upload,
  UploadCloud,
  Bot,
  BoxSelect,
  ClipboardCheck,
  Route,
  Save,
} from 'lucide-react'
import { CodeLinksPanel } from './components/CodeLinksPanel'
import { WorkItemsPanel } from './components/WorkItemsPanel'
import { SettingsPanel, type SettingsTab } from './components/SettingsPanel'
import { CloudBrowserModal } from './components/CloudBrowserModal'
import { writeCloudSelection } from './utils/cloud/writeSelection'
import { RepoBrowserModal } from './components/RepoBrowserModal'
import { SwaggerInjectorModal } from './components/SwaggerInjectorModal'
import { SaasMetadataModal } from './components/SaasMetadataModal'
import { AiDiagramModal } from './components/AiDiagramModal'
import { AiAnalysisModal } from './components/AiAnalysisModal'
import { AiSadModal } from './components/AiSadModal'
import { AiTestPlanModal } from './components/AiTestPlanModal'
import { AgentPlanModal } from './components/AgentPlanModal'
import { ChangeDesignModal } from './components/ChangeDesignModal'
import { AuditTrailPanel } from './components/AuditTrailPanel'
import { DialogLayer } from './components/DialogLayer'
import {
  loadDialogStack,
  popDialog,
  pushDialog as pushDialogId,
  removeDialog,
  saveDialogStack,
  type DialogId,
} from './utils/dialogStack'

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
import type { ArchitectureDocument, ArchitectureMetadata, PaletteItem, SequenceFlowStep, SystemNode, TechnicalChangeDesign } from './types'
import type { DiagramPath } from './types/diagram'
import { createProjectTab, type ProjectTab } from './types/project'
import {
  addSystemsInView,
  addTemplatedSubDiagram,
  findSystemAtPath,
  deleteIntegrationInView,
  removeSubTab,
  deleteSystemInView,
  ensureSubDiagram,
  ensureIntegrationSubDiagram,
  getDiagramView,
  listSubTabs,
  renameDrillPath,
  renameSystemAtPath,
  updateIntegrationInView,
  updateSystemInView,
} from './utils/diagramNavigation'
import { locateSequenceStep, seedIntegrationSequence } from './utils/sequenceFlow'
import { buildStructuralTestPlan, downloadTestPlan } from './utils/testPlan'
import { ComponentPalette } from './components/ComponentPalette'
import { DiagramBreadcrumb } from './components/DiagramBreadcrumb'
import { DiagramPageTitle } from './components/DiagramPageTitle'
import { DrawModeControls } from './components/DrawModeControls'
import { AppMenuBar, type AppMenuGroup } from './components/AppMenuBar'
import { IntegrationCanvas, type IntegrationCanvasHandle } from './components/IntegrationCanvas'
import { JsonPanel } from './components/JsonPanel'
import { PropertiesPanel } from './components/PropertiesPanel'
import {
  createEmptyDocument,
  downloadJson,
  parseArchitectureJson,
  serializeArchitecture,
  type IntegrationEdgeData,
  type IntegrationNodeData,
} from './utils/jsonIO'
import { createFromPickId, createFromTemplate } from './data/templates'
import { addUserTemplate } from './utils/userTemplates'
import { mergeGeneratedIntoView, type AiPlacement } from './utils/aiDiagram'
import { redrawKeepingZones } from './utils/zoneRectangles'
import { createAgentPlanDocument, insertAgentPlan, type AgentPlan } from './utils/agentPlan'
import { applySaasImport, type SaasImportPayload } from './utils/saas/mapToDiagram'
import { applyAudit, type AuditExtras } from './utils/auditLog'
import {
  architectureFileSlug,
  downloadDataUrl,
  type DiagramImage,
  type DiagramImageFormat,
} from './utils/captureDiagram'
import {
  applySadDraft,
  type SadDraft,
} from './utils/aiSad'
import {
  diagramPathKey,
  listDiagramCaptureTargets,
} from './utils/architectureNarrative'
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
import {
  isAbort,
  isLocalFileSaveSupported,
  loadStoredLocalFiles,
  pickLocalSaveFile,
  queryLocalFilePermission,
  removeStoredLocalFile,
  requestLocalFilePermission,
  storeLocalFile,
  suggestedArchitectureFilename,
  writeTextFileQueued,
  type LocalFileHandle,
} from './utils/localFileSave'
import {
  isVsCodeHost,
  notifyHostReady,
  pickJsonFileFromHost,
  saveDocumentToHost,
  subscribeToHost,
} from './utils/vscodeHost'

function createInitialWorkspace() {
  if (isVsCodeHost()) {
    const tab = createProjectTab(createEmptyDocument('Architecture'))
    return { tabs: [tab], activeTabId: tab.id, savedAt: null as string | null }
  }
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
  const [selectedNodes, setSelectedNodes] = useState<Node<IntegrationNodeData>[]>([])
  const [selectedEdge, setSelectedEdge] = useState<Edge<IntegrationEdgeData> | null>(null)
  const [selectedEdges, setSelectedEdges] = useState<Edge<IntegrationEdgeData>[]>([])
  const [dialogStack, setDialogStack] = useState<DialogId[]>(() => loadDialogStack())
  const [jsonError, setJsonError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('ai')
  const [repoBrowserMode, setRepoBrowserMode] = useState<'pull' | 'push' | null>(() =>
    loadDialogStack().includes('repo') ? 'pull' : null,
  )
  const [cloudBrowserMode, setCloudBrowserMode] = useState<'open' | 'save' | null>(() =>
    loadDialogStack().includes('cloud') ? 'open' : null,
  )
  const [gitMessage, setGitMessage] = useState<string | null>(null)
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [focusEdgeIds, setFocusEdgeIds] = useState<string[] | null>(null)
  const [templatePickerMode, setTemplatePickerMode] = useState<'project' | 'sub-tab'>('project')
  const [aiChatMounted, setAiChatMounted] = useState(() => loadDialogStack().includes('aiDiagram'))
  const [analysisFocus, setAnalysisFocus] = useState<string | undefined>(undefined)
  const [designFocusSystemId, setDesignFocusSystemId] = useState<string | undefined>(undefined)

  const [exporting, setExporting] = useState(false)
  const [capturingSad, setCapturingSad] = useState(false)
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
  const localHandlesRef = useRef(new Map<string, LocalFileHandle>())
  const [localSaves, setLocalSaves] = useState<Array<{ tabId: string; name: string; needsPermission: boolean }>>([])
  const vscodeDocumentReadyRef = useRef(false)
  const vscodeHosted = isVsCodeHost()

  tabsRef.current = tabs
  activeTabIdRef.current = activeTabId
  const drillPathRef = useRef<DiagramPath>([])
  const workspaceViewRef = useRef<'diagram' | 'feature'>('diagram')
  const dialogStackRef = useRef(dialogStack)
  dialogStackRef.current = dialogStack

  const isDialogOpen = useCallback((id: DialogId) => dialogStack.includes(id), [dialogStack])

  const openDialog = useCallback((id: DialogId) => {
    setDialogStack((stack) => {
      const next = pushDialogId(stack, id)
      saveDialogStack(next)
      return next
    })
  }, [])

  const closeDialog = useCallback((id: DialogId) => {
    setDialogStack((stack) => {
      const next = removeDialog(stack, id)
      saveDialogStack(next)
      return next
    })
  }, [])

  const closeTopDialog = useCallback(() => {
    setDialogStack((stack) => {
      const next = popDialog(stack)
      saveDialogStack(next)
      return next
    })
  }, [])

  const gitConnected = isGitHubConnected() || isAzureDevOpsConnected()

  const savedAiKeys = countSavedKeys()

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]
  const document = activeTab.document
  const drillPath = activeTab.drillPath
  const workspaceView = activeTab.workspaceView === 'feature' ? 'feature' : 'diagram'
  drillPathRef.current = drillPath
  workspaceViewRef.current = workspaceView
  const diagramView = getDiagramView(document, drillPath)
  const linkedCount = getLinkedSystems(document.systems).length
  const workItemCount = collectLinkedWorkItems(document).length
  const designCount = document.changeDesigns?.length ?? 0
  const localSave = localSaves.find((item) => item.tabId === activeTabId)
  const canSaveLocally = isLocalFileSaveSupported()

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

  const handleUpdateMetadata = useCallback(
    (patch: Partial<ArchitectureMetadata>) => {
      setDocument(
        (prev) => ({
          ...prev,
          metadata: { ...prev.metadata, ...patch, updatedAt: new Date().toISOString() },
        }),
        { kind: 'update', summary: 'Updated diagram infrastructure' },
      )
    },
    [setDocument],
  )

  const handleChangeDesigns = useCallback(
    (designs: TechnicalChangeDesign[]) => {
      setDocument(
        (prev) => ({ ...prev, changeDesigns: designs.length > 0 ? designs : undefined }),
        { kind: 'update', summary: 'Updated technical change design' },
      )
    },
    [setDocument],
  )

  const setWorkspaceView = useCallback(
    (view: 'diagram' | 'feature') => {
      updateActiveTab((tab) => (tab.workspaceView === view ? tab : { ...tab, workspaceView: view }))
    },
    [updateActiveTab],
  )

  const openChangeDesign = useCallback(
    (systemId?: string) => {
      setDesignFocusSystemId(systemId)
      setWorkspaceView('feature')
      closeDialog('changeDesign')
    },
    [closeDialog, setWorkspaceView],
  )

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
    (id: string, label: string, kind: 'system' | 'integration' = 'system') => {
      updateActiveTab((tab) => {
        let nextDoc = tab.document
        if (kind === 'integration') {
          nextDoc = ensureIntegrationSubDiagram(tab.document, tab.drillPath, id)
          const integration = getDiagramView(nextDoc, tab.drillPath).integrations.find((item) => item.id === id)
          if (integration) nextDoc = seedIntegrationSequence(nextDoc, tab.drillPath, integration)
        } else {
          nextDoc = ensureSubDiagram(tab.document, tab.drillPath, id)
        }
        return {
          ...tab,
          document: applyAudit(tab.document, nextDoc, {
            kind: 'navigate',
            summary:
              kind === 'integration'
                ? `Opened sequence diagram for ${label}`
                : `Opened sub-diagram for ${label}`,
          }),
          drillPath: [...tab.drillPath, { systemId: id, label, kind }],
          canvasKey: tab.canvasKey + 1,
        }
      })
      clearSelection()
    },
    [updateActiveTab],
  )

  const handleOpenSequenceHop = useCallback(
    (edgeId: string, step: SequenceFlowStep) => {
      const view = getDiagramView(document, drillPath)
      const integration = view.integrations.find((item) => item.id === edgeId)
      if (!integration) {
        setFocusNodeId(step.systemId)
        return
      }
      const location = locateSequenceStep(document, drillPath, integration, step)
      if (!location || location.catalogId === 'current') {
        setFocusNodeId(step.systemId)
        return
      }
      if (location.catalogId === 'nested') {
        handleDrillInto(integration.id, integration.label, 'integration')
        setFocusNodeId(step.systemId)
        return
      }
      if (location.parentId && location.parentLabel) {
        handleDrillInto(location.parentId, location.parentLabel, 'system')
        setFocusNodeId(step.systemId)
      }
    },
    [document, drillPath, handleDrillInto],
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
    setSelectedEdges([])
    setFocusNodeId(null)
  }

  const handleSelectTab = (id: string) => {
    setActiveTabId(id)
    clearSelection()
  }

  const handleRenameTab = (id: string, name: string) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== id) return tab
        const next = {
          ...tab.document,
          metadata: { ...tab.document.metadata, name },
        }
        return {
          ...tab,
          document: applyAudit(tab.document, next, {
            kind: 'update',
            summary: `Renamed project to “${name}”`,
          }),
        }
      }),
    )
  }

  const handleRenameSubTab = (
    tab: { id: string; path: typeof drillPath; kind: 'overview' | 'sub' | 'feature'; name: string },
    name: string,
  ) => {
    if (tab.kind === 'feature') return
    if (tab.kind === 'overview') {
      handleRenameTab(activeTabId, name)
      return
    }
    updateActiveTab((current) => {
      const nextDoc = renameSystemAtPath(current.document, tab.path, name)
      return {
        ...current,
        document: applyAudit(current.document, nextDoc, {
          kind: 'update',
          summary: `Renamed sub-diagram to “${name}”`,
        }),
        drillPath: renameDrillPath(current.drillPath, tab.id, name),
      }
    })
  }

  const handleRenameCurrentPage = (name: string) => {
    if (drillPath.length === 0) {
      handleRenameTab(activeTabId, name)
      return
    }
    const segment = drillPath[drillPath.length - 1]
    handleRenameSubTab(
      { id: segment.systemId, path: drillPath, kind: 'sub', name: segment.label },
      name,
    )
  }

  const handleRenamePathSegment = (depth: number, name: string) => {
    if (depth <= 0) {
      handleRenameTab(activeTabId, name)
      return
    }
    const segment = drillPath[depth - 1]
    if (!segment) return
    handleRenameSubTab(
      { id: segment.systemId, path: drillPath.slice(0, depth), kind: 'sub', name: segment.label },
      name,
    )
  }

  const handleNewTab = () => {
    setTemplatePickerMode('project')
    openDialog('template')
  }

  const handleNewSubTab = () => {
    setTemplatePickerMode('sub-tab')
    openDialog('template')
  }

  const handleRemoveSubTab = (tab: { id: string; path: typeof drillPath; kind: 'overview' | 'sub' | 'feature' }) => {
    if (tab.kind === 'overview' || tab.kind === 'feature') return
    updateActiveTab((current) => {
      const viewingRemoved = current.drillPath.some((segment) => segment.systemId === tab.id)
      const nextPath = viewingRemoved ? tab.path.slice(0, -1) : current.drillPath
      const nextDoc = removeSubTab(current.document, tab.path)
      return {
        ...current,
        document: applyAudit(current.document, nextDoc, {
          kind: 'remove',
          summary: `Closed sub-tab “${tab.path[tab.path.length - 1]?.label ?? tab.id}”`,
        }),
        drillPath: nextPath,
      }
    })
    clearSelection()
  }

  const handleSaveAsTemplate = () => {
    const defaultName = document.metadata.name?.trim() || 'Untitled template'
    const name = window.prompt('Save this diagram as a template named:', defaultName)
    if (name == null) return
    const trimmed = name.trim()
    if (!trimmed) return
    const saved = addUserTemplate({
      name: trimmed,
      description: document.metadata.description,
      document,
    })
    setGitMessage(`Saved “${saved.name}” as a template. Use File → New tab → Saved to start from it.`)
  }

  const handleSelectTemplate = (id: string) => {
    const stamped = createFromPickId(id)
    const doc = applyAudit(stamped, stamped, {
      kind: 'add',
      summary: `Created from template “${stamped.metadata.name}”`,
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
      closeDialog('template')
      clearSelection()
      return
    }

    const newTab = createProjectTab(doc)
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    closeDialog('template')
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
    localHandlesRef.current.delete(id)
    setLocalSaves((prev) => prev.filter((item) => item.tabId !== id))
    void removeStoredLocalFile(id)
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

  useEffect(() => {
    if (!isVsCodeHost()) return
    const unsubscribe = subscribeToHost((message) => {
      if (message.type !== 'setDocument') return
      const json = message.json?.trim()
      if (!json) {
        vscodeDocumentReadyRef.current = true
        return
      }
      vscodeDocumentReadyRef.current = true
      handleImport(json, false)
    })
    notifyHostReady()
    return unsubscribe
  }, [handleImport])

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

  const handleImportFromDevice = useCallback(async () => {
    if (isVsCodeHost()) {
      try {
        const json = await pickJsonFileFromHost()
        if (!json) return
        handleImport(json, false)
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : 'Could not open that file')
      }
      return
    }
    fileInputRef.current?.click()
  }, [handleImport])

  const handleExport = () => {
    downloadJson(document)
  }

  const bindLocalHandle = useCallback((tabId: string, handle: LocalFileHandle) => {
    localHandlesRef.current.set(tabId, handle)
    setLocalSaves((prev) => [
      ...prev.filter((item) => item.tabId !== tabId),
      { tabId, name: handle.name, needsPermission: false },
    ])
    void storeLocalFile({ tabId, name: handle.name, handle })
  }, [])

  const persistGrantedLocalFiles = useCallback(async (projectTabs: ProjectTab[]) => {
    for (const tab of projectTabs) {
      const handle = localHandlesRef.current.get(tab.id)
      if (!handle) continue
      const permission = await queryLocalFilePermission(handle)
      if (permission !== 'granted') continue
      try {
        await writeTextFileQueued(tab.id, handle, serializeArchitecture(tab.document))
      } catch {
        setLocalSaves((prev) =>
          prev.map((item) => (item.tabId === tab.id ? { ...item, needsPermission: true } : item)),
        )
      }
    }
  }, [])

  const handleSaveToDevice = useCallback(
    async (pickNew = false) => {
      const tabId = activeTabIdRef.current
      const tab = tabsRef.current.find((item) => item.id === tabId)
      if (!tab) return

      if (isVsCodeHost()) {
        saveDocumentToHost(serializeArchitecture(tab.document))
        vscodeDocumentReadyRef.current = true
        setGitMessage('Saved to the VS Code workspace file')
        return
      }

      const existing = pickNew ? undefined : localHandlesRef.current.get(tabId)
      if (existing) {
        const current = await queryLocalFilePermission(existing)
        const permission =
          current === 'granted' ? current : await requestLocalFilePermission(existing)
        if (permission !== 'granted') {
          setLocalSaves((prev) =>
            prev.map((item) => (item.tabId === tabId ? { ...item, needsPermission: true } : item)),
          )
          setGitMessage('Allow file access to keep saving this project on your device')
          return
        }
        try {
          await writeTextFileQueued(tabId, existing, serializeArchitecture(tab.document))
          setLocalSaves((prev) =>
            prev.map((item) => (item.tabId === tabId ? { ...item, needsPermission: false } : item)),
          )
          setGitMessage(`Saved ${existing.name} on this device`)
        } catch (err) {
          setGitMessage(err instanceof Error ? err.message : 'Could not write the local file')
        }
        return
      }

      if (!isLocalFileSaveSupported()) {
        downloadJson(tab.document)
        setGitMessage(
          'Downloaded a JSON copy. Chrome or Edge can remember the file and keep saving it automatically.',
        )
        return
      }

      try {
        const picked = await pickLocalSaveFile(
          suggestedArchitectureFilename(tab.document.metadata.name),
        )
        if (!picked) return
        await writeTextFileQueued(tabId, picked, serializeArchitecture(tab.document))
        bindLocalHandle(tabId, picked)
        setGitMessage(`Saving automatically to ${picked.name}`)
      } catch (err) {
        if (isAbort(err)) return
        setGitMessage(err instanceof Error ? err.message : 'Could not save to this device')
      }
    },
    [bindLocalHandle],
  )

  const handleStopLocalSave = useCallback(() => {
    const tabId = activeTabIdRef.current
    const name = localHandlesRef.current.get(tabId)?.name
    localHandlesRef.current.delete(tabId)
    setLocalSaves((prev) => prev.filter((item) => item.tabId !== tabId))
    void removeStoredLocalFile(tabId)
    if (name) setGitMessage(`Stopped saving to ${name}`)
  }, [])

  const handleExportImage = async (format: DiagramImageFormat) => {
    setExporting(true)
    setGitMessage(`Exporting ${format.toUpperCase()}…`)
    try {
      const image = await canvasRef.current?.exportImage(format)
      if (!image) {
        setGitMessage('Could not capture the diagram as an image')
        return
      }
      const filename = `${architectureFileSlug(document.metadata.name)}.${format}`
      downloadDataUrl(image.dataUrl, filename)
      setGitMessage(`Downloaded ${filename}`)
    } catch (err) {
      setGitMessage(err instanceof Error ? err.message : 'Image export failed')
    } finally {
      setExporting(false)
    }
  }

  const waitForCanvas = async (timeoutMs = 2500) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (canvasRef.current) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 180))
        return canvasRef.current
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 40))
    }
    return canvasRef.current
  }

  const navigateForCapture = async (path: DiagramPath) => {
    const samePath = diagramPathKey(path) === diagramPathKey(drillPathRef.current)
    const onDiagram = workspaceViewRef.current === 'diagram'
    if (samePath && onDiagram && canvasRef.current) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 80))
      return
    }
    if (!onDiagram) setWorkspaceView('diagram')
    if (!samePath) setDrillPath(path)
    await waitForCanvas()
  }

  const captureAllDiagramViews = async (): Promise<{
    overview?: DiagramImage | null
    views: Array<{ key: string; title: string; image: DiagramImage }>
  }> => {
    const originalPath = drillPathRef.current
    const originalView = workspaceViewRef.current
    const targets = listDiagramCaptureTargets(document)
    const views: Array<{ key: string; title: string; image: DiagramImage }> = []
    setCapturingSad(true)
    appRef.current?.classList.add('sad-capturing')
    setGitMessage('Capturing diagrams for SAD…')
    try {
      for (const target of targets) {
        await navigateForCapture(target.path)
        const image = await canvasRef.current?.capturePng()
        if (image) views.push({ key: target.key, title: target.title, image })
      }
    } finally {
      appRef.current?.classList.remove('sad-capturing')
      setCapturingSad(false)
      if (originalView === 'feature') setWorkspaceView('feature')
      if (diagramPathKey(originalPath) !== diagramPathKey(drillPathRef.current)) {
        setDrillPath(originalPath)
      } else if (originalView === 'diagram') {
        await waitForCanvas(800)
      }
    }
    return {
      overview: views.find((view) => view.key === 'root')?.image ?? views[0]?.image ?? null,
      views,
    }
  }

  const runOfficeExport = async (kind: 'pptx' | 'docx', sadDraft?: SadDraft | null) => {
    setExporting(true)
    setGitMessage(kind === 'pptx' ? 'Building PowerPoint briefing…' : 'Building Word SAD…')
    try {
      const { buildArchitectureBrief } = await import('./utils/architectureNarrative')
      const brief = applySadDraft(buildArchitectureBrief(document), sadDraft)
      if (kind === 'pptx') {
        let image = null
        try {
          if (workspaceViewRef.current !== 'diagram') {
            setWorkspaceView('diagram')
            await waitForCanvas()
          }
          image = (await canvasRef.current?.capturePng()) ?? null
        } catch {
          image = null
        }
        const { exportArchitecturePptx } = await import('./utils/exportPptx')
        await exportArchitecturePptx(brief, image)
        setGitMessage('Downloaded PowerPoint briefing')
      } else {
        closeDialog('aiSad')
        await new Promise<void>((resolve) => window.setTimeout(resolve, 80))
        const diagrams = await captureAllDiagramViews()
        const { exportArchitectureDocx } = await import('./utils/exportDocx')
        await exportArchitectureDocx(brief, diagrams)
        setGitMessage(
          sadDraft
            ? 'Downloaded AI-written Word Solution Architecture Document'
            : 'Downloaded Word Solution Architecture Document',
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      const hint = /failed to fetch|cannot find module|is not a constructor|node:fs/i.test(message)
        ? ' The document library could not run in this browser session. Reload the page and try Export again.'
        : ''
      setGitMessage(`${kind === 'pptx' ? 'PowerPoint' : 'Word SAD'} export failed: ${message}${hint}`)
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
    closeDialog('repo')
  }

  const handleOpenJsonEditor = () => {
    setJsonError(null)
    openDialog('json')
  }

  const handleApplyJson = (json: string) => {
    if (handleImport(json)) {
      closeDialog('json')
    }
  }

  const handleUpdateNodes = (ids: string[], data: Partial<IntegrationNodeData>) => {
    const idSet = new Set(ids)
    setDocument((prev) => {
      let next = prev
      for (const id of ids) {
        next = updateSystemInView(next, drillPath, id, (system) => ({
          ...system,
          type: data.systemType ?? system.type,
          label: data.label ?? system.label,
          category: data.category ?? system.category,
          properties: data.properties ? { ...system.properties, ...data.properties } : system.properties,
        }))
      }
      return next
    })
    const merge = (node: Node<IntegrationNodeData>): Node<IntegrationNodeData> =>
      idSet.has(node.id)
        ? {
            ...node,
            data: {
              ...node.data,
              ...data,
              properties: data.properties
                ? { ...node.data.properties, ...data.properties }
                : node.data.properties,
            },
          }
        : node
    setSelectedNode((prev) => (prev ? merge(prev) : prev))
    setSelectedNodes((prev) => prev.map(merge))
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
    setSelectedNode((prev) => {
      if (!prev || prev.id !== id) return prev
      return {
        ...prev,
        data: {
          ...prev.data,
          ...data,
          properties: data.properties
            ? { ...prev.data.properties, ...data.properties }
            : prev.data.properties,
        },
      }
    })
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
        lineStyle: 'lineStyle' in data ? data.lineStyle : i.lineStyle,
        lineWeight: 'lineWeight' in data ? data.lineWeight : i.lineWeight,
        lineAnimation: 'lineAnimation' in data ? data.lineAnimation : i.lineAnimation,
        sequenceFlow: 'sequenceFlow' in data ? data.sequenceFlow : i.sequenceFlow,
        subDiagram: 'subDiagram' in data ? data.subDiagram : i.subDiagram,
        notes: 'notes' in data ? data.notes : i.notes,
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
    setSelectedEdge((prev) => {
      if (!prev || prev.id !== id) return prev
      return {
        ...prev,
        data: { ...(prev.data as IntegrationEdgeData), ...data },
      }
    })
    setSelectedEdges((prev) =>
      prev.map((edge) =>
        edge.id === id ? { ...edge, data: { ...(edge.data as IntegrationEdgeData), ...data } } : edge,
      ),
    )
  }

  const handleUpdateEdges = (ids: string[], data: Partial<IntegrationEdgeData>) => {
    const idSet = new Set(ids)
    setDocument((prev) => {
      let next = prev
      for (const id of ids) {
        next = updateIntegrationInView(next, drillPath, id, (i) => ({
          ...i,
          label: data.label ?? i.label,
          direction: data.direction ?? i.direction,
          protocol: data.protocol ?? i.protocol,
          frequency: data.frequency ?? i.frequency,
          dataFormat: data.dataFormat ?? i.dataFormat,
          description: data.description ?? i.description,
          interfaceSpec: data.interfaceSpec !== undefined ? data.interfaceSpec : i.interfaceSpec,
          color: 'color' in data ? data.color : i.color,
          lineStyle: 'lineStyle' in data ? data.lineStyle : i.lineStyle,
          lineWeight: 'lineWeight' in data ? data.lineWeight : i.lineWeight,
          lineAnimation: 'lineAnimation' in data ? data.lineAnimation : i.lineAnimation,
          sequenceFlow: 'sequenceFlow' in data ? data.sequenceFlow : i.sequenceFlow,
          changeStatus: 'changeStatus' in data ? data.changeStatus : i.changeStatus,
          routing: data.routing ?? i.routing,
          waypoints: 'waypoints' in data ? data.waypoints : i.waypoints,
        }))
      }
      return next
    })
    setSelectedEdge((prev) =>
      prev && idSet.has(prev.id)
        ? { ...prev, data: { ...(prev.data as IntegrationEdgeData), ...data } }
        : prev,
    )
    setSelectedEdges((prev) =>
      prev.map((edge) =>
        idSet.has(edge.id) ? { ...edge, data: { ...(edge.data as IntegrationEdgeData), ...data } } : edge,
      ),
    )
  }

  const handleDeleteNode = (id: string) => {
    setDocument((prev) => deleteSystemInView(prev, drillPath, id))
    setSelectedNode(null)
    remountCanvas()
  }

  const handleDeleteEdge = (id: string) => {
    setDocument((prev) => deleteIntegrationInView(prev, drillPath, id))
    setSelectedEdge(null)
    setSelectedEdges([])
    remountCanvas()
  }

  const handleDeleteEdges = (ids: string[]) => {
    setDocument((prev) => {
      let next = prev
      for (const id of ids) next = deleteIntegrationInView(next, drillPath, id)
      return next
    })
    setSelectedEdge(null)
    setSelectedEdges([])
    remountCanvas()
  }

  const handleInjectSwaggerSystems = (systems: SystemNode[]) => {
    setDocument((prev) => addSystemsInView(prev, drillPath, systems))
    remountCanvas()
  }

  const handleSaasImport = (payload: SaasImportPayload) => {
    updateActiveTab((tab) => {
      const result = applySaasImport(tab.document, tab.drillPath, payload)
      let nextDoc = applyAudit(tab.document, result.document, {
        kind: 'import',
        summary: payload.summary,
      })
      let nextPath = tab.drillPath
      if (result.drillSystemId) {
        const label =
          result.drillLabel || payload.catalog.organizationName || payload.catalog.providerLabel
        nextDoc = applyAudit(
          nextDoc,
          ensureSubDiagram(nextDoc, tab.drillPath, result.drillSystemId),
          { kind: 'navigate', summary: `Opened sub-diagram for ${label}` },
        )
        nextPath = [...tab.drillPath, { systemId: result.drillSystemId, label }]
      }
      return {
        ...tab,
        document: nextDoc,
        drillPath: nextPath,
        canvasKey: tab.canvasKey + 1,
      }
    })
    closeDialog('saas')
    setGitMessage(payload.summary)
    clearSelection()
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

  useEffect(() => {
    if (!dialogStack.includes('repo')) setRepoBrowserMode(null)
    if (!dialogStack.includes('cloud')) setCloudBrowserMode(null)
  }, [dialogStack])

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
      if (isVsCodeHost() && vscodeDocumentReadyRef.current) {
        const tab = tabsRef.current.find((item) => item.id === activeTabIdRef.current)
        if (tab) saveDocumentToHost(serializeArchitecture(tab.document))
      } else {
        void persistGrantedLocalFiles(tabsRef.current)
      }
    } catch {
      setAutosaveStatus('error')
    }
  }, [persistGrantedLocalFiles])

  useEffect(() => {
    if (skipFirstAutosave.current) {
      skipFirstAutosave.current = false
      return
    }
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
    let cancelled = false
    void (async () => {
      const rows = await loadStoredLocalFiles()
      if (cancelled) return
      const handles = new Map<string, LocalFileHandle>()
      const bindings: Array<{ tabId: string; name: string; needsPermission: boolean }> = []
      for (const row of rows) {
        handles.set(row.tabId, row.handle)
        const permission = await queryLocalFilePermission(row.handle)
        bindings.push({
          tabId: row.tabId,
          name: row.name,
          needsPermission: permission !== 'granted',
        })
      }
      if (cancelled) return
      localHandlesRef.current = handles
      setLocalSaves(bindings)
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void handleSaveToDevice()
        return
      }

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
      if (event.key === 'Escape') {
        if (dialogStackRef.current.length > 0) {
          event.preventDefault()
          closeTopDialog()
          return
        }
        if (menusHidden && !isElementFullscreen(appRef.current)) {
          autoHidMenusRef.current = false
          setMenusHidden(false)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeTopDialog, handleSaveToDevice, menusHidden, toggleFullscreen, toggleMenus])

  const handlePlaceAgentPlan = (plan: AgentPlan, placement: 'canvas' | 'tab') => {
    if (placement === 'tab') {
      const doc = createAgentPlanDocument(plan)
      const newTab = createProjectTab(
        applyAudit(doc, doc, { kind: 'add', summary: `Created agent plan “${plan.name}”` }),
      )
      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTab.id)
    } else {
      updateActiveTab((tab) => {
        const added = insertAgentPlan(tab.document, tab.drillPath, plan)
        return {
          ...tab,
          document: applyAudit(tab.document, added.document, {
            kind: 'add',
            summary: `Added agent “${added.label}”`,
          }),
          drillPath: [...tab.drillPath, { systemId: added.systemId, label: added.label }],
          canvasKey: tab.canvasKey + 1,
        }
      })
    }
    closeDialog('agentPlan')
    clearSelection()
  }

  const handleAiGenerate = (generated: ArchitectureDocument, placement: AiPlacement) => {
    if (placement === 'new-tab') {
      const newTab = createProjectTab(
        applyAudit(generated, generated, { kind: 'ai', summary: 'Drew architecture with AI' }),
      )
      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTab.id)
    } else if (placement === 'replace') {
      updateActiveTab((tab) => {
        const next = redrawKeepingZones(tab.document, tab.drillPath, generated)
        return {
          ...tab,
          document: applyAudit(tab.document, next, {
            kind: 'ai',
            summary: tab.drillPath.length === 0 ? 'Replaced diagram with AI' : 'Replaced this canvas with AI',
          }),
          drillPath: tab.drillPath,
          canvasKey: tab.canvasKey + 1,
        }
      })
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
            id: 'save-template',
            label: 'Save as template…',
            hint: 'Reuse this diagram from New tab later',
            icon: LayoutTemplate,
            onSelect: handleSaveAsTemplate,
          },
          {
            id: 'import',
            label: 'Import JSON…',
            hint: 'Open a project file',
            icon: Upload,
            onSelect: () => void handleImportFromDevice(),
          },
          { id: 'edit-json', label: 'Edit JSON', hint: 'Raw architecture document', icon: FileJson, onSelect: handleOpenJsonEditor },
          {
            id: 'save-local',
            label: vscodeHosted
              ? 'Save workspace file'
              : localSave
                ? 'Save to this device'
                : 'Save to this device…',
            hint: vscodeHosted
              ? 'Writes this architecture JSON in the VS Code workspace'
              : localSave
                ? `Writes ${localSave.name} automatically after the first pick`
                : canSaveLocally
                  ? 'Choose a JSON file once, then autosave writes there'
                  : 'Downloads a JSON copy (Chrome or Edge can keep writing to the same file)',
            shortcut: 'Ctrl+S',
            icon: Save,
            onSelect: () => void handleSaveToDevice(),
          },
          ...(localSave
            ? [
                {
                  id: 'change-local',
                  label: 'Change local file…',
                  hint: `Currently ${localSave.name}`,
                  icon: FileDown,
                  onSelect: () => void handleSaveToDevice(true),
                } as const,
                {
                  id: 'stop-local',
                  label: 'Stop saving to this device',
                  hint: localSave.name,
                  icon: FileDown,
                  onSelect: handleStopLocalSave,
                } as const,
              ]
            : []),
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
            id: 'export-png',
            label: 'Export PNG',
            hint: 'Diagram as a picture',
            icon: ImageDown,
            disabled: exporting,
            onSelect: () => void handleExportImage('png'),
          },
          {
            id: 'export-svg',
            label: 'Export SVG',
            hint: 'Vector image of the diagram',
            icon: FileImage,
            disabled: exporting,
            onSelect: () => void handleExportImage('svg'),
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
            hint: 'NFRs, nested diagrams, and sequence flows',
            icon: FileText,
            disabled: exporting,
            onSelect: () => void runOfficeExport('docx'),
          },
          {
            id: 'export-test-plan',
            label: 'Export test plan',
            hint: 'E2E cases from sequence flows and components',
            icon: ClipboardCheck,
            onSelect: () => {
              if (document.systems.length === 0) {
                setGitMessage('Add components before exporting a test plan')
                return
              }
              downloadTestPlan(buildStructuralTestPlan(document), document.metadata.name)
              setGitMessage('Downloaded end-to-end test plan')
            },
          },
        ],
      },
      {
        id: 'edit',
        label: 'Edit',
        items: [
          {
            id: 'cut',
            label: 'Cut',
            shortcut: 'Ctrl+X',
            hint: 'Remove selection and copy it',
            icon: Scissors,
            onSelect: () => void canvasRef.current?.cutSelection(),
          },
          {
            id: 'copy',
            label: 'Copy',
            shortcut: 'Ctrl+C',
            hint: 'Copy selected components',
            icon: Copy,
            onSelect: () => void canvasRef.current?.copySelection(),
          },
          {
            id: 'paste',
            label: 'Paste',
            shortcut: 'Ctrl+V',
            hint: 'Paste copied components',
            icon: ClipboardPaste,
            onSelect: () => void canvasRef.current?.pasteClipboard(),
          },
          {
            id: 'duplicate',
            label: 'Duplicate',
            shortcut: 'Ctrl+D',
            hint: 'Copy and paste in place',
            icon: CopyPlus,
            onSelect: () => void canvasRef.current?.duplicateSelection(),
          },
          {
            id: 'select-all',
            label: 'Select all',
            shortcut: 'Ctrl+A',
            hint: 'Select every component, then drag to move',
            icon: BoxSelect,
            onSelect: () => canvasRef.current?.selectAll(),
          },
        ],
      },
      {
        id: 'cloud',
        label: 'Cloud & Git',
        items: [
          { id: 'cloud-open', label: 'Open from cloud…', hint: 'OneDrive, SharePoint, Google, iCloud', icon: Cloud, onSelect: () => { setCloudBrowserMode('open'); openDialog('cloud') } },
          { id: 'cloud-save', label: 'Save to cloud…', hint: 'Write this project as JSON', icon: Cloud, onSelect: () => { setCloudBrowserMode('save'); openDialog('cloud') } },
          { id: 'sep-git', type: 'separator' },
          {
            id: 'git-pull',
            label: 'Pull from Git…',
            hint: gitConnected ? 'GitHub or Azure DevOps' : 'Connect Git in Settings first',
            icon: Download,
            disabled: !gitConnected,
            onSelect: () => { setRepoBrowserMode('pull'); openDialog('repo') },
          },
          {
            id: 'git-push',
            label: 'Push to Git…',
            hint: gitConnected ? 'GitHub or Azure DevOps' : 'Connect Git in Settings first',
            icon: UploadCloud,
            disabled: !gitConnected,
            onSelect: () => { setRepoBrowserMode('push'); openDialog('repo') },
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
              openDialog('aiDiagram')
            },
          },
          {
            id: 'agent-plan',
            label: 'Build agent & plan…',
            hint: 'Design an agent, its tools, and the steps it follows',
            icon: Route,
            onSelect: () => openDialog('agentPlan'),
          },
          {
            id: 'analyze',
            label: 'Analyze capabilities…',
            hint: 'Pros and cons of the landscape',
            icon: Scale,
            onSelect: () => {
              setAnalysisFocus(undefined)
              openDialog('aiAnalysis')
            },
          },
          {
            id: 'write-sad',
            label: 'Write SAD…',
            hint: 'AI narrative, NFRs, nested diagrams, sequence flows',
            icon: NotebookPen,
            onSelect: () => openDialog('aiSad'),
          },
          {
            id: 'test-plan',
            label: 'Test plan…',
            hint: 'E2E cases from sequence flows, components, and NFRs',
            icon: ClipboardCheck,
            onSelect: () => openDialog('aiTestPlan'),
          },
          {
            id: 'change-design',
            label: designCount > 0 ? `Feature & apply (${designCount})` : 'Feature & apply changes…',
            hint: 'New vs update architecture → agent work → apply',
            icon: Bot,
            onSelect: () => openChangeDesign(),
          },
        ],
      },
      {
        id: 'tools',
        label: 'Tools',
        items: [
          { id: 'swagger', label: 'Inject Swagger…', hint: 'Add APIs from an OpenAPI spec', icon: Braces, onSelect: () => openDialog('swagger') },
          {
            id: 'saas-metadata',
            label: 'Read SaaS metadata…',
            hint: 'Dynamics 365, Dataverse, Salesforce',
            icon: Database,
            onSelect: () => openDialog('saas'),
          },
          {
            id: 'code-links',
            label: linkedCount > 0 ? `Code links (${linkedCount})` : 'Code links',
            hint: 'Components linked to repositories',
            icon: FolderGit2,
            onSelect: () => openDialog('codeLinks'),
          },
          {
            id: 'work-items',
            label: workItemCount > 0 ? `Work items (${workItemCount})` : 'Work items',
            hint: 'Jira and Azure DevOps links',
            icon: Ticket,
            onSelect: () => openDialog('workItems'),
          },
          {
            id: 'audit',
            label: (document.audit?.length ?? 0) > 0 ? `Audit trail (${document.audit?.length})` : 'Audit trail',
            hint: 'History of every project change',
            icon: History,
            onSelect: () => openDialog('audit'),
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
            id: 'settings-templates',
            label: 'Templates',
            hint: 'Import and manage saved diagrams',
            icon: LayoutTemplate,
            onSelect: () => {
              setSettingsTab('templates')
              openDialog('settings')
            },
          },
          {
            id: 'settings-ai',
            label: 'AI engines',
            hint: savedAiKeys > 0 ? `${savedAiKeys} key${savedAiKeys === 1 ? '' : 's'} saved` : 'Keys and default model',
            icon: Settings,
            onSelect: () => {
              setSettingsTab('ai')
              openDialog('settings')
            },
          },
          {
            id: 'settings-git',
            label: 'Git',
            hint: 'GitHub and Azure DevOps',
            icon: UploadCloud,
            onSelect: () => {
              setSettingsTab('git')
              openDialog('settings')
            },
          },
          {
            id: 'settings-jira',
            label: 'Jira',
            hint: 'Work item linking',
            icon: Ticket,
            onSelect: () => {
              setSettingsTab('jira')
              openDialog('settings')
            },
          },
          {
            id: 'settings-cloud',
            label: 'Cloud storage',
            hint: 'OneDrive, SharePoint, Google, iCloud',
            icon: Cloud,
            onSelect: () => {
              setSettingsTab('cloud')
              openDialog('settings')
            },
          },
        ],
      },
    ],
    [
      exporting,
      gitConnected,
      handleExport,
      handleExportImage,
      handleImportFromDevice,
      handleNewTab,
      handleSaveAsTemplate,
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
      designCount,
      openDialog,
      handleSaveToDevice,
      handleStopLocalSave,
      localSave,
      canSaveLocally,
      vscodeHosted,
      openChangeDesign,
    ],
  )

  return (
    <div
      ref={appRef}
      className={`app app-shell${menusHidden ? ' menus-hidden' : ''}${isFullscreen ? ' is-fullscreen' : ''}`}
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
        onRenameTab={handleRenameTab}
      />
      <SubTabBar
        tabs={listSubTabs(document, drillPath)}
        currentPath={drillPath}
        activeId={workspaceView === 'feature' ? 'feature' : undefined}
        onSelect={(tab) => {
          if (tab.kind === 'feature') {
            openChangeDesign()
            return
          }
          setWorkspaceView('diagram')
          setDrillPath(tab.path)
          clearSelection()
        }}
        onNewFromTemplate={handleNewSubTab}
        onRemove={handleRemoveSubTab}
        onRename={handleRenameSubTab}
      />

      <div className="workspace">
        <ComponentPalette onDragStart={handleDragStart} />
        <main className="canvas-area">
          <DiagramPageTitle
            name={
              workspaceView === 'feature'
                ? 'Feature & apply'
                : drillPath.length === 0
                  ? document.metadata.name
                  : drillPath[drillPath.length - 1]?.label ?? document.metadata.name
            }
            isRoot={workspaceView === 'diagram' && drillPath.length === 0}
            statsLabel={
              workspaceView === 'feature'
                ? `${designCount} feature${designCount === 1 ? '' : 's'}`
                : `${diagramView.systems.length} systems · ${diagramView.integrations.length} integrations${drillPath.length > 0 ? ' (detail)' : ''}`
            }
            onRename={workspaceView === 'feature' ? () => undefined : handleRenameCurrentPage}
            onGoRoot={() => handleNavigateDiagram(0)}
            autosave={
              localSave?.needsPermission ? (
                <button
                  type="button"
                  className="autosave-status autosave-error"
                  title={`Click to resume writing ${localSave.name} on this device`}
                  onClick={() => void handleSaveToDevice()}
                >
                  Resume {localSave.name}
                </button>
              ) : (
                <span
                  className={`autosave-status autosave-${autosaveStatus}`}
                  title={
                    autosaveStatus === 'error'
                      ? 'Could not autosave (browser storage may be full)'
                      : vscodeHosted
                        ? 'Saves to the VS Code workspace JSON file'
                        : localSave
                          ? `Saving automatically to ${localSave.name} on this device`
                          : autosaveAt
                            ? `Last autosave ${new Date(autosaveAt).toLocaleString()}`
                            : 'Changes save automatically in this browser. Use File → Save to this device to also write a local JSON file.'
                  }
                >
                  {autosaveStatus === 'saving' &&
                    (vscodeHosted
                      ? 'Saving workspace…'
                      : localSave
                        ? `Saving ${localSave.name}…`
                        : 'Saving…')}
                  {autosaveStatus === 'saved' &&
                    (vscodeHosted
                      ? `Saved in VS Code${autosaveAt ? ` ${formatAutosaveTime(autosaveAt)}` : ''}`
                      : localSave
                        ? `Saved to ${localSave.name}${autosaveAt ? ` ${formatAutosaveTime(autosaveAt)}` : ''}`
                        : `Autosaved${autosaveAt ? ` ${formatAutosaveTime(autosaveAt)}` : ''}`)}
                  {autosaveStatus === 'error' && 'Autosave failed'}
                  {autosaveStatus === 'idle' &&
                    (vscodeHosted
                      ? 'VS Code workspace'
                      : localSave
                        ? `Saving to ${localSave.name}`
                        : 'Autosave on')}
                </span>
              )
            }
          />
          {workspaceView === 'diagram' && (
          <DiagramBreadcrumb
            documentName={document.metadata.name}
            drillPath={drillPath}
            levelLabel={diagramView.parentLabel}
            onNavigate={handleNavigateDiagram}
            onRename={handleRenamePathSegment}
          />
          )}
          <div className="canvas-flow">
            {workspaceView === 'feature' ? (
              <ChangeDesignModal
                variant="page"
                document={document}
                focusSystemId={designFocusSystemId}
                onSave={handleChangeDesigns}
                onSelectSystem={(id) => {
                  setWorkspaceView('diagram')
                  setFocusNodeId(id)
                }}
                onManageKeys={() => {
                  setSettingsTab('ai')
                  openDialog('settings')
                }}
                onClose={() => setWorkspaceView('diagram')}
              />
            ) : (
            <ReactFlowProvider>
              <IntegrationCanvas
                ref={canvasRef}
                key={`${activeTab.id}-${activeTab.canvasKey}`}
              document={document}
              diagramPath={drillPath}
              onDocumentChange={setDocument}
              onDrillInto={handleDrillInto}
              onOpenSequenceHop={handleOpenSequenceHop}
              onSelectionChange={(node, edge, extras) => {
                if (extras?.openProperties === false) {
                  setSelectedNode(null)
                  setSelectedNodes([])
                  setSelectedEdge(null)
                  setSelectedEdges([])
                  return
                }
                setSelectedEdges(extras?.selectedEdges ?? (edge ? [edge] : []))
                setSelectedNodes(extras?.selectedNodes ?? (node ? [node] : []))
                setSelectedNode(node)
                setSelectedEdge(edge)
              }}
              focusNodeId={focusNodeId}
              focusEdgeIds={focusEdgeIds}
              onFocusComplete={() => {
                setFocusNodeId(null)
                setFocusEdgeIds(null)
              }}
              isFullscreen={isFullscreen}
              menusHidden={menusHidden}
              onToggleFullscreen={() => void toggleFullscreen()}
              onToggleMenus={toggleMenus}
              onOpenAi={() => {
                setAiChatMounted(true)
                openDialog('aiDiagram')
              }}
              selectionKey={selectedNode?.id ?? selectedEdge?.id ?? null}
              properties={
                <PropertiesPanel
                  selectedNode={selectedNode}
                  selectedNodes={selectedNodes}
                  selectedEdge={selectedEdge}
                  selectedEdges={selectedEdges}
                  drillPath={drillPath}
                  document={document}
                  onUpdateNode={handleUpdateNode}
                  onUpdateNodes={handleUpdateNodes}
                  onUpdateEdge={handleUpdateEdge}
                  onUpdateEdges={handleUpdateEdges}
                  onDeleteNode={handleDeleteNode}
                  onDeleteEdge={handleDeleteEdge}
                  onDeleteEdges={handleDeleteEdges}
                  onDrillInto={handleDrillInto}
                  onOpenSequenceHop={handleOpenSequenceHop}
                  onAnalyzeCapability={(label) => {
                    setAnalysisFocus(label)
                    openDialog('aiAnalysis')
                  }}
                  onReadSaasMetadata={() => openDialog('saas')}
                  onOpenChangeDesign={openChangeDesign}
                  onChangeDesigns={handleChangeDesigns}
                  onUpdateMetadata={handleUpdateMetadata}
                />
              }
            />
            </ReactFlowProvider>
            )}
          </div>
        </main>
      </div>

      {isDialogOpen('json') && (
        <DialogLayer id="json" stack={dialogStack} onClose={() => closeDialog('json')}>
          <JsonPanel
            json={serializeArchitecture(document)}
            error={jsonError}
            onApply={handleApplyJson}
            onClose={() => closeDialog('json')}
          />
        </DialogLayer>
      )}

      {isDialogOpen('codeLinks') && (
        <DialogLayer id="codeLinks" stack={dialogStack} onClose={() => closeDialog('codeLinks')}>
          <CodeLinksPanel
            systems={document.systems}
            onClose={() => closeDialog('codeLinks')}
            onSelectSystem={(id) => {
              closeDialog('codeLinks')
              setFocusNodeId(id)
            }}
          />
        </DialogLayer>
      )}

      {isDialogOpen('workItems') && (
        <DialogLayer id="workItems" stack={dialogStack} onClose={() => closeDialog('workItems')}>
          <WorkItemsPanel
            document={document}
            onClose={() => closeDialog('workItems')}
            onSelectSystem={(id) => {
              closeDialog('workItems')
              setFocusNodeId(id)
            }}
          />
        </DialogLayer>
      )}

      {isDialogOpen('audit') && (
        <DialogLayer id="audit" stack={dialogStack} onClose={() => closeDialog('audit')}>
          <AuditTrailPanel
            document={document}
            onClose={() => closeDialog('audit')}
            onClear={handleClearAudit}
          />
        </DialogLayer>
      )}

      {isDialogOpen('settings') && (
        <DialogLayer id="settings" stack={dialogStack} onClose={() => closeDialog('settings')}>
          <SettingsPanel
            tab={settingsTab}
            onTabChange={setSettingsTab}
            onClose={() => closeDialog('settings')}
          />
        </DialogLayer>
      )}

      {isDialogOpen('repo') && repoBrowserMode && (
        <DialogLayer id="repo" stack={dialogStack} onClose={() => closeDialog('repo')}>
          <RepoBrowserModal
            mode={repoBrowserMode}
            onClose={() => closeDialog('repo')}
            onPullJson={(content) => handleImport(content, true)}
            onPushPath={handlePushToRepo}
          />
        </DialogLayer>
      )}

      {isDialogOpen('cloud') && cloudBrowserMode && (
        <DialogLayer id="cloud" stack={dialogStack} onClose={() => closeDialog('cloud')}>
          <CloudBrowserModal
            mode={cloudBrowserMode}
            suggestedName={`${document.metadata.name.replace(/\s+/g, '-').toLowerCase()}.json`}
            onClose={() => closeDialog('cloud')}
            onOpen={(content, selection) => {
              handleImport(content, true)
              closeDialog('cloud')
              setGitMessage(`Opened ${selection.fileName} from ${selection.store}`)
            }}
            onSave={async (selection) => {
              await writeCloudSelection(selection, serializeArchitecture(document))
              closeDialog('cloud')
              setGitMessage(`Saved ${selection.fileName} to ${selection.store}`)
            }}
          />
        </DialogLayer>
      )}

      {isDialogOpen('template') && (
        <DialogLayer id="template" stack={dialogStack} onClose={() => closeDialog('template')}>
          <TemplatePicker
            mode={templatePickerMode}
            onSelect={handleSelectTemplate}
            onClose={() => closeDialog('template')}
          />
        </DialogLayer>
      )}

      {isDialogOpen('swagger') && (
        <DialogLayer id="swagger" stack={dialogStack} onClose={() => closeDialog('swagger')}>
          <SwaggerInjectorModal
            mode="canvas"
            existingSystems={diagramView.systems}
            onInjectSystems={handleInjectSwaggerSystems}
            onClose={() => closeDialog('swagger')}
          />
        </DialogLayer>
      )}

      {isDialogOpen('saas') && (
        <DialogLayer id="saas" stack={dialogStack} onClose={() => closeDialog('saas')}>
          <SaasMetadataModal
            targetSystemId={
              selectedNode && findSystemAtPath(document, drillPath, selectedNode.id)?.type === 'saas'
                ? selectedNode.id
                : selectedNode && findSystemAtPath(document, drillPath, selectedNode.id)?.type === 'powerplatform'
                  ? selectedNode.id
                  : undefined
            }
            targetSystemLabel={
              selectedNode &&
              (selectedNode.data.systemType === 'saas' || selectedNode.data.systemType === 'powerplatform')
                ? selectedNode.data.label
                : undefined
            }
            onImport={handleSaasImport}
            onClose={() => closeDialog('saas')}
          />
        </DialogLayer>
      )}

      {isDialogOpen('agentPlan') && (
        <DialogLayer id="agentPlan" stack={dialogStack} onClose={() => closeDialog('agentPlan')}>
          <AgentPlanModal
            onPlace={handlePlaceAgentPlan}
            onClose={() => closeDialog('agentPlan')}
          />
        </DialogLayer>
      )}

      {aiChatMounted && isDialogOpen('aiDiagram') && (
        <DialogLayer id="aiDiagram" stack={dialogStack} onClose={() => closeDialog('aiDiagram')}>
          <AiDiagramModal
            open
            currentDocument={document}
            drillPath={drillPath}
            onGenerate={handleAiGenerate}
            onManageKeys={() => {
              setSettingsTab('ai')
              openDialog('settings')
            }}
            onClose={() => closeDialog('aiDiagram')}
          />
        </DialogLayer>
      )}

      {isDialogOpen('aiAnalysis') && (
        <DialogLayer id="aiAnalysis" stack={dialogStack} onClose={() => closeDialog('aiAnalysis')}>
          <AiAnalysisModal
            document={document}
            focusLabel={analysisFocus}
            onManageKeys={() => {
              setSettingsTab('ai')
              openDialog('settings')
            }}
            onClose={() => closeDialog('aiAnalysis')}
            onShowIntegrations={(ids) => {
              setFocusEdgeIds(ids)
              closeDialog('aiAnalysis')
            }}
            onNoteIntegrations={(ids, note) => {
              for (const id of ids) {
                const current = getDiagramView(document, drillPath).integrations.find((item) => item.id === id)
                const existing = current?.notes?.trim()
                handleUpdateEdge(id, { notes: existing ? `${existing}\n\n${note}` : note })
              }
              setGitMessage(`Added simplification notes to ${ids.length} integration${ids.length === 1 ? '' : 's'}`)
            }}
            onRetireIntegrations={(ids) => {
              handleUpdateEdges(ids, { changeStatus: 'retired' })
              setGitMessage(`Marked ${ids.length} extra integration${ids.length === 1 ? '' : 's'} as retired`)
            }}
          />
        </DialogLayer>
      )}

      {isDialogOpen('aiSad') && (
        <DialogLayer id="aiSad" stack={dialogStack} onClose={() => closeDialog('aiSad')}>
          <AiSadModal
            document={document}
            exporting={exporting}
            onManageKeys={() => {
              setSettingsTab('ai')
              openDialog('settings')
            }}
            onExport={(draft) => void runOfficeExport('docx', draft)}
            onClose={() => closeDialog('aiSad')}
          />
        </DialogLayer>
      )}

      {isDialogOpen('aiTestPlan') && (
        <DialogLayer id="aiTestPlan" stack={dialogStack} onClose={() => closeDialog('aiTestPlan')}>
          <AiTestPlanModal
            document={document}
            onManageKeys={() => {
              setSettingsTab('ai')
              openDialog('settings')
            }}
            onClose={() => closeDialog('aiTestPlan')}
          />
        </DialogLayer>
      )}

      {isDialogOpen('changeDesign') && (
        <DialogLayer id="changeDesign" stack={dialogStack} onClose={() => closeDialog('changeDesign')}>
          <ChangeDesignModal
            document={document}
            focusSystemId={designFocusSystemId}
            onSave={handleChangeDesigns}
            onSelectSystem={(id) => {
              closeDialog('changeDesign')
              setFocusNodeId(id)
            }}
            onManageKeys={() => {
              setSettingsTab('ai')
              openDialog('settings')
            }}
            onClose={() => closeDialog('changeDesign')}
          />
        </DialogLayer>
      )}

      {capturingSad && <div className="sad-capture-banner">Capturing diagrams for the SAD…</div>}

      {gitMessage && (
        <div className="git-toast" onClick={() => setGitMessage(null)}>
          {gitMessage}
        </div>
      )}

    </div>
  )
}

export default App