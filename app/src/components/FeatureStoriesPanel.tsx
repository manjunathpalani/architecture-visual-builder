import { Loader2, Play, Plus, Sparkles, Trash2 } from 'lucide-react'
import type { FeatureUserStory, TechnicalChangeDesign } from '../types'
import {
  assignSystemsToStory,
  createEmptyStory,
  removeStory,
  tasksForStory,
  upsertStory,
  type DesignableSystem,
} from '../utils/changeDesign'

interface FeatureStoriesPanelProps {
  documentSystems: DesignableSystem[]
  draft: TechnicalChangeDesign
  focusStoryId?: string | null
  generatingId?: string | null
  sendingId?: string | null
  onChange: (next: TechnicalChangeDesign) => void
  onFocusStory: (storyId: string) => void
  onGenerateStory?: (storyId: string) => void
  onSendStory?: (storyId: string) => void
}

export function FeatureStoriesPanel({
  documentSystems,
  draft,
  focusStoryId,
  generatingId,
  sendingId,
  onChange,
  onFocusStory,
  onGenerateStory,
  onSendStory,
}: FeatureStoriesPanelProps) {
  const stories = draft.stories ?? []
  const selectedIds = new Set(draft.tasks.map((task) => task.systemId))
  const linkable = documentSystems.filter(
    (system) => selectedIds.has(system.id) || stories.some((story) => story.systemIds.includes(system.id)),
  )
  const systems = linkable.length > 0 ? linkable : documentSystems

  const addStory = () => {
    const story = createEmptyStory()
    onChange(upsertStory(draft, story))
    onFocusStory(story.id)
  }

  const patchStory = (story: FeatureUserStory, patch: Partial<FeatureUserStory>) => {
    onChange(upsertStory(draft, { ...story, ...patch }))
  }

  const toggleLink = (story: FeatureUserStory, systemId: string) => {
    const nextIds = story.systemIds.includes(systemId)
      ? story.systemIds.filter((id) => id !== systemId)
      : [...story.systemIds, systemId]
    onChange(assignSystemsToStory(draft, story.id, nextIds, documentSystems))
  }

  return (
    <div className="change-design-stories">
      <div className="change-design-components-header">
        <h3>User stories</h3>
        <span>{stories.length}</span>
      </div>
      <p className="code-link-hint">
        Group linked components under stories. Each story has functional and non-functional
        requirements that flow into agent instructions.
      </p>
      {stories.length === 0 ? (
        <p className="code-link-hint">No stories yet. Components stay unassigned until you add one.</p>
      ) : (
        stories.map((story) => (
          <article
            key={story.id}
            data-story-id={story.id}
            className={`change-design-story-card${focusStoryId === story.id ? ' is-active' : ''}`}
            onClick={() => onFocusStory(story.id)}
          >
            <div className="change-design-story-top">
              <input
                value={story.title}
                placeholder="As a user, I can…"
                onChange={(e) => patchStory(story, { title: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                title="Remove story"
                aria-label="Remove story"
                onClick={(event) => {
                  event.stopPropagation()
                  onChange(removeStory(draft, story.id))
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <textarea
              rows={2}
              value={story.description ?? ''}
              placeholder="What this story delivers"
              onChange={(e) => patchStory(story, { description: e.target.value })}
            />
            <textarea
              rows={2}
              value={story.acceptanceCriteria ?? ''}
              placeholder="Story acceptance criteria"
              onChange={(e) => patchStory(story, { acceptanceCriteria: e.target.value })}
            />
            <div className="change-design-reqs-header">
              <span>Requirements</span>
              {onGenerateStory && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={Boolean(generatingId)}
                  onClick={(event) => {
                    event.stopPropagation()
                    onGenerateStory(story.id)
                  }}
                >
                  {generatingId === story.id ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  Populate with AI
                </button>
              )}
            </div>
            <label>
              Functional requirements
              <textarea
                rows={3}
                value={story.functionalRequirements ?? ''}
                placeholder="What this story shall do"
                onChange={(e) => patchStory(story, { functionalRequirements: e.target.value })}
              />
            </label>
            <label>
              Non-functional requirements
              <textarea
                rows={2}
                value={story.nonFunctionalRequirements ?? ''}
                placeholder="Quality attributes for this story"
                onChange={(e) => patchStory(story, { nonFunctionalRequirements: e.target.value })}
              />
            </label>
            {onSendStory && (
              <button
                type="button"
                className="btn-primary"
                disabled={Boolean(sendingId) || tasksForStory(draft, story.id).length === 0}
                title="Send this user story and its linked component instructions to a coding agent"
                onClick={(event) => {
                  event.stopPropagation()
                  onSendStory(story.id)
                }}
              >
                {sendingId === `story:${story.id}` ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
                Send story to agent
              </button>
            )}
            <div className="change-design-story-links">
              <span>Linked components</span>
              {systems.length === 0 ? (
                <em>Tick components in New vs update first.</em>
              ) : (
                systems.map((system) => (
                  <label key={system.id}>
                    <input
                      type="checkbox"
                      checked={story.systemIds.includes(system.id)}
                      onChange={() => toggleLink(story, system.id)}
                    />
                    {system.pathLabel}
                  </label>
                ))
              )}
            </div>
          </article>
        ))
      )}
      <button type="button" className="btn-secondary" onClick={addStory}>
        <Plus size={14} />
        Add user story
      </button>
    </div>
  )
}
