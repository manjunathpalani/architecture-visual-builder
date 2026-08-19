import { useCallback, useRef, useState } from 'react'
import { ReactFlowProvider, type Edge, type Node } from '@xyflow/react'
import {
  Braces,
  Download,
  FileJson,
  FolderGit2,
  FolderOpen,
  GitBranch,
  KeyRound,
  LayoutGrid,
  Plus,
  Sparkles,
  Upload,
  UploadCloud,
} from 'lucide-react'
import { CodeLinksPanel } from './components/CodeLinksPanel'
import { GitIntegrationsPanel } from './components/GitIntegrationsPanel'
import { RepoBrowserModal } from './components/RepoBrowserModal'
import { SwaggerInjectorModal } from './components/SwaggerInjectorModal'
import { AiDiagramModal } from './components/AiDiagramModal'
import { AiEnginesPanel } from './components/AiEnginesPanel'
import { isAzureDevOpsConnected, isGitHubConnected } from './utils/gitCredentials'
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
  deleteSystemInView,
  ensureSubDiagram,
  getDiagramView,
  listSubTabs,
  updateIntegrationInView,
  updateSystemInView,
} from './utils/diagramNavigation'
import { ComponentPalette } from './components/ComponentPalette'
import { DiagramBreadcrumb } from './components/DiagramBreadcrumb'
import { ExportMenu } from './components/ExportMenu'
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
import { countSavedKeys } from './utils/aiProviders'

const INITIAL_TAB = createProjectTab(createFromTemplate('enterprise'))

function App() {
  const [tabs, setTabs] = useState<ProjectTab[]>([INITIAL_TAB])
  const [activeTabId, setActiveTabId] = useState(INITIAL_TAB.id)
  const [selectedNode, setSelectedNode] = useState<Node<IntegrationNodeData> | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge<IntegrationEdgeData> | null>(null)
  const [showJsonPanel, setShowJsonPanel] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showCodeLinks, setShowCodeLinks] = useState(false)
  const [showGitIntegrations, setShowGitIntegrations] = useState(false)
  const [repoBrowserMode, setRepoBrowserMode] = useState<'pull' | 'push' | null>(null)
  const [gitMessage, setGitMessage] = useState<string | null>(null)
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [templatePickerMode, setTemplatePickerMode] = useState<'project' | 'sub-tab'>('project')
  const [showSwaggerInjector, setShowSwaggerInjector] = useState(false)
  const [showAiDiagram, setShowAiDiagram] = useState(false)
  const [showAiEngines, setShowAiEngines] = useState(false)
  const [exporting, setExporting] = useState(false)
  const canvasRef = useRef<IntegrationCanvasHandle>(null)

  const gitConnected = isGitHubConnected() || isAzureDevOpsConnected()
  const savedAiKeys = countSavedKeys()

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]
  const document = activeTab.document
  const drillPath = activeTab.drillPath
  const diagramView = getDiagramView(document, drillPath)
  const linkedCount = getLinkedSystems(document.systems).length

  const updateActiveTab = useCallback(
    (updater: (tab: ProjectTab) => ProjectTab) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? updater(t) : t)),
      )
    },
    [activeTabId],
  )

  const setDocument = useCallback(
    (doc: ArchitectureDocument | ((prev: ArchitectureDocument) => ArchitectureDocument)) => {
      updateActiveTab((tab) => ({
        ...tab,
        document: typeof doc === 'function' ? doc(tab.document) : doc,
      }))
    },
    [updateActiveTab],
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
    (systemId: string, label: string) => {
      updateActiveTab((tab) => ({
        ...tab,
        document: ensureSubDiagram(tab.document, tab.drillPath, systemId),
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

  const handleSelectTemplate = (id: ArchitectureTemplateId) => {
    const doc = createFromTemplate(id)
    if (templatePickerMode === 'sub-tab') {
      updateActiveTab((tab) => {
        const added = addTemplatedSubDiagram(tab.document, tab.drillPath, doc)
        return {
          ...tab,
          document: added.document,
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
          const newTab = createProjectTab(parsed)
          setTabs((prev) => [...prev, newTab])
          setActiveTabId(newTab.id)
        } else {
          updateActiveTab((tab) => ({
            ...tab,
            document: parsed,
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

  const handleAiGenerate = (generated: ArchitectureDocument, placement: AiPlacement) => {
    if (placement === 'new-tab') {
      const newTab = createProjectTab(generated)
      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTab.id)
    } else if (placement === 'replace') {
      updateActiveTab((tab) => ({
        ...tab,
        document: generated,
        drillPath: [],
        canvasKey: tab.canvasKey + 1,
      }))
    } else {
      setDocument((prev) => mergeGeneratedIntoView(prev, drillPath, generated))
      remountCanvas()
    }
    clearSelection()
    setGitMessage(
      `Drew ${generated.systems.length} systems and ${generated.integrations.length} integrations with SpaceXAI`,
    )
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-brand">
          <LayoutGrid size={22} />
          <div>
            <h1>Architecture Visual Builder</h1>
            <span>End-to-end integration mapping · SaaS · Cloud · On-Premise</span>
          </div>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="btn-secondary" onClick={handleNewTab}>
            <Plus size={16} />
            New Tab
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} />
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={handleFileUpload}
          />
          <button type="button" className="btn-secondary" onClick={handleOpenJsonEditor}>
            <FileJson size={16} />
            Edit JSON
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowGitIntegrations(true)}>
            <GitBranch size={16} />
            Git{gitConnected ? ' ✓' : ''}
          </button>
          {gitConnected && (
            <>
              <button type="button" className="btn-secondary" onClick={() => setRepoBrowserMode('pull')}>
                <Download size={16} />
                Pull
              </button>
              <button type="button" className="btn-secondary" onClick={() => setRepoBrowserMode('push')}>
                <UploadCloud size={16} />
                Push
              </button>
            </>
          )}
          <button type="button" className="btn-secondary" onClick={() => setShowAiEngines(true)}>
            <KeyRound size={16} />
            AI Keys{savedAiKeys > 0 ? ` (${savedAiKeys})` : ''}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowAiDiagram(true)}>
            <Sparkles size={16} />
            Draw with AI
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowSwaggerInjector(true)}>
            <Braces size={16} />
            Inject Swagger
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowCodeLinks(true)}>
            <FolderGit2 size={16} />
            Code Links{linkedCount > 0 ? ` (${linkedCount})` : ''}
          </button>
          <ExportMenu
            exporting={exporting}
            onExportJson={handleExport}
            onExportPptx={() => void runOfficeExport('pptx')}
            onExportDocx={() => void runOfficeExport('docx')}
          />
        </div>
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
          </div>
          <DiagramBreadcrumb
            documentName={document.metadata.name}
            drillPath={drillPath}
            levelLabel={diagramView.parentLabel}
            onNavigate={handleNavigateDiagram}
          />
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
            />
          </ReactFlowProvider>
        </main>
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
        />
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

      {showGitIntegrations && (
        <GitIntegrationsPanel onClose={() => setShowGitIntegrations(false)} />
      )}

      {repoBrowserMode && (
        <RepoBrowserModal
          mode={repoBrowserMode}
          onClose={() => setRepoBrowserMode(null)}
          onPullJson={(content) => handleImport(content, true)}
          onPushPath={handlePushToRepo}
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

      {showAiDiagram && (
        <AiDiagramModal
          currentDocument={document}
          onGenerate={handleAiGenerate}
          onManageKeys={() => {
            setShowAiDiagram(false)
            setShowAiEngines(true)
          }}
          onClose={() => setShowAiDiagram(false)}
        />
      )}

      {showAiEngines && (
        <AiEnginesPanel onClose={() => setShowAiEngines(false)} />
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