import { useEffect, useRef, useState } from 'react'
import { ImagePlus, KeyRound, Loader2, Sparkles, X } from 'lucide-react'
import type { ArchitectureDocument } from '../types'
import {
  AI_PROVIDERS,
  getProvider,
  loadAiSettings,
  saveAiSettings,
  type AiProviderId,
} from '../utils/aiProviders'
import {
  AI_PROMPT_EXAMPLES,
  fetchAiStatus,
  generateArchitectureFromPrompt,
  summarizeDocumentForAi,
  type AiPlacement,
  type AiStatus,
} from '../utils/aiDiagram'
import { filesToAiImages, type AiImage } from '../utils/aiImage'

interface AiDiagramModalProps {
  currentDocument: ArchitectureDocument
  onGenerate: (document: ArchitectureDocument, placement: AiPlacement) => void
  onManageKeys: () => void
  onClose: () => void
}

export function AiDiagramModal({
  currentDocument,
  onGenerate,
  onManageKeys,
  onClose,
}: AiDiagramModalProps) {
  const initial = loadAiSettings()
  const [prompt, setPrompt] = useState('')
  const [placement, setPlacement] = useState<AiPlacement>('new-tab')
  const [useContext, setUseContext] = useState(false)
  const [provider, setProvider] = useState<AiProviderId>(initial.selectedProvider)
  const [userKey, setUserKey] = useState(initial.keys[initial.selectedProvider] ?? '')
  const [azureEndpoint, setAzureEndpoint] = useState(initial.azureEndpoint ?? '')
  const [azureDeployment, setAzureDeployment] = useState(initial.azureDeployment ?? '')
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [images, setImages] = useState<AiImage[]>([])
  const [imageBusy, setImageBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void fetchAiStatus().then(setStatus)
  }, [])

  const info = getProvider(provider)
  const serverReady = Boolean(status?.providers.find((p) => p.id === provider)?.configured)
  const hasKey = serverReady || Boolean(userKey.trim())
  const hasAzureBits =
    provider !== 'azure-openai' ||
    (Boolean(azureEndpoint.trim()) && Boolean(azureDeployment.trim())) ||
    serverReady
  const canGenerate =
    (prompt.trim().length > 8 || images.length > 0) &&
    !loading &&
    !imageBusy &&
    Boolean(status?.available) &&
    hasKey &&
    hasAzureBits

  const persistProvider = (next: AiProviderId) => {
    const settings = loadAiSettings()
    const nextSettings = {
      ...settings,
      selectedProvider: next,
      keys: { ...settings.keys, [provider]: userKey },
      azureEndpoint,
      azureDeployment,
    }
    saveAiSettings(nextSettings)
    setProvider(next)
    setUserKey(nextSettings.keys[next] ?? '')
  }

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return
    setImageBusy(true)
    setError(null)
    try {
      const next = await filesToAiImages(files)
      setImages((prev) => [...prev, ...next].slice(0, 4))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the image')
    } finally {
      setImageBusy(false)
    }
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'))
      if (files.length === 0) return
      event.preventDefault()
      void addFiles(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const persistKeys = () => {
    const settings = loadAiSettings()
    saveAiSettings({
      ...settings,
      selectedProvider: provider,
      keys: { ...settings.keys, [provider]: userKey },
      azureEndpoint,
      azureDeployment,
    })
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    persistKeys()
    try {
      const document = await generateArchitectureFromPrompt(
        prompt.trim(),
        useContext ? summarizeDocumentForAi(currentDocument) : undefined,
        provider,
        images,
      )
      onGenerate(document, placement)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagram generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="swagger-overlay" onClick={onClose}>
      <div className="swagger-modal ai-diagram-modal" onClick={(e) => e.stopPropagation()}>
        <div className="swagger-modal-header">
          <div>
            <h2>
              <Sparkles size={20} />
              Draw with AI
            </h2>
            <p>
              Describe the landscape or attach a screenshot / whiteboard photo. The selected engine
              places systems, integrations, and explanations on the canvas. SpaceXAI is recommended.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="swagger-modal-body">
          <div className="swagger-options">
            <label className="swagger-option">
              AI engine
              <select
                value={provider}
                onChange={(e) => persistProvider(e.target.value as AiProviderId)}
                disabled={loading}
              >
                {AI_PROVIDERS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                    {item.recommended ? ' (recommended)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="swagger-option">
              Place result
              <select
                value={placement}
                onChange={(e) => setPlacement(e.target.value as AiPlacement)}
                disabled={loading}
              >
                <option value="new-tab">New tab</option>
                <option value="replace">Replace this canvas</option>
                <option value="merge">Add to this canvas</option>
              </select>
            </label>
          </div>

          <label>
            Architecture prompt
            <textarea
              className="ai-prompt-input"
              rows={5}
              placeholder="Optional if you attach an image. Example: Recreate this whiteboard as an integration landscape, and add a Kafka events bus."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
            />
          </label>

          <div
            className={`ai-image-drop ${images.length ? 'has-files' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
            }}
            onDrop={(e) => {
              e.preventDefault()
              void addFiles(Array.from(e.dataTransfer.files))
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              hidden
              onChange={(e) => {
                void addFiles(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
            <div className="ai-image-drop-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={loading || imageBusy || images.length >= 4}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={14} />
                {imageBusy ? 'Processing image…' : 'Use image to generate'}
              </button>
              <span className="code-link-hint">
                Drop, paste, or upload a diagram screenshot. JPG/PNG, up to 4 images.
              </span>
            </div>
            {images.length > 0 && (
              <div className="ai-image-previews">
                {images.map((image, index) => (
                  <figure key={`${image.name}-${index}`} className="ai-image-preview">
                    <img src={image.dataUrl} alt={image.name} />
                    <figcaption>{image.name}</figcaption>
                    <button
                      type="button"
                      className="icon-btn ai-image-remove"
                      aria-label={`Remove ${image.name}`}
                      disabled={loading}
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X size={14} />
                    </button>
                  </figure>
                ))}
              </div>
            )}
          </div>

          <div className="ai-examples">
            {AI_PROMPT_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="ai-example-chip"
                disabled={loading}
                onClick={() => setPrompt(example)}
              >
                {example}
              </button>
            ))}
          </div>

          <label className="ai-context-toggle ai-context-inline">
            <input
              type="checkbox"
              checked={useContext}
              onChange={(e) => setUseContext(e.target.checked)}
              disabled={loading}
            />
            Use the current diagram as context
          </label>

          <div className="ai-status-box">
            {status?.available ? (
              <>
                <p>
                  {serverReady
                    ? `Using the server ${info.shortLabel} key`
                    : `Paste a ${info.shortLabel} key, or open AI Engines to save keys for every provider.`}
                  {' · '}
                  model{' '}
                  <code>
                    {status.providers.find((p) => p.id === provider)?.model ?? info.defaultModel}
                  </code>
                </p>
                {!serverReady && (
                  <label>
                    {info.keyLabel}
                    <input
                      type="password"
                      autoComplete="off"
                      placeholder={info.keyPlaceholder}
                      value={userKey}
                      onChange={(e) => setUserKey(e.target.value)}
                      disabled={loading}
                    />
                  </label>
                )}
                {provider === 'azure-openai' && (
                  <div className="swagger-options">
                    <label className="swagger-option">
                      Endpoint
                      <input
                        placeholder="https://your-resource.openai.azure.com"
                        value={azureEndpoint}
                        onChange={(e) => setAzureEndpoint(e.target.value)}
                        disabled={loading}
                      />
                    </label>
                    <label className="swagger-option">
                      Deployment
                      <input
                        placeholder="gpt-4o"
                        value={azureDeployment}
                        onChange={(e) => setAzureDeployment(e.target.value)}
                        disabled={loading}
                      />
                    </label>
                  </div>
                )}
              </>
            ) : (
              <p>
                The AI proxy is not running. Start the app with <code>npm run dev</code> and set
                provider keys in <code>app/.env</code> or AI Engines.
              </p>
            )}
            <button
              type="button"
              className="btn-secondary ai-manage-keys"
              onClick={onManageKeys}
              disabled={loading}
            >
              <KeyRound size={14} />
              Manage all AI keys
            </button>
          </div>

          {error && <div className="swagger-error">{error}</div>}
        </div>

        <div className="swagger-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!canGenerate}
            onClick={() => void handleGenerate()}
          >
            {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            {loading
              ? `Drawing with ${info.shortLabel}…`
              : images.length
                ? `Generate from image`
                : `Draw with ${info.shortLabel}`}
          </button>
        </div>
      </div>
    </div>
  )
}
