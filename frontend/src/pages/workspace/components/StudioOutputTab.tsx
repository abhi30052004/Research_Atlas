import { Zap, Clock, FileText, Edit3, Trash2, ChevronDown, Copy } from 'lucide-react'
import { Artifact } from '../../../api/workspace'
import { getTool, getToolIcon } from '../utils'

const isVisualStudioArtifact = (artifact: Artifact) => {
  const type = getTool(artifact.tool)?.type || artifact.tool
  return type === 'slide_deck' || type === 'infographic_content'
}

interface StudioOutputTabProps {
  artifacts: Artifact[]
  expandedArtifact: string | null
  setExpandedArtifact: (id: string | null) => void
  editArtifact: (artifact: Artifact) => void
  handleDeleteArtifact: (id: string) => void
  addToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export function StudioOutputTab({
  artifacts,
  expandedArtifact,
  setExpandedArtifact,
  editArtifact,
  handleDeleteArtifact,
  addToast,
}: StudioOutputTabProps) {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ background: 'linear-gradient(180deg, #fafbff 0%, #f5f6fa 100%)' }}>
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-on-surface tracking-tight">Studio Output</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">
                {artifacts.length === 0 ? 'Generate your first artifact to get started' : `${artifacts.length} artifact${artifacts.length > 1 ? 's' : ''} generated`}
              </p>
            </div>
          </div>
          {artifacts.length > 0 && (
            <span className="px-3 py-1.5 text-xs font-semibold rounded-full" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white' }}>
              {artifacts.length} {artifacts.length === 1 ? 'artifact' : 'artifacts'}
            </span>
          )}
        </div>

        {artifacts.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)' }}>
              <Zap className="w-9 h-9" style={{ color: '#6366f1' }} />
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">No artifacts yet</h3>
            <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
              Select a tool from the Studio Tools panel on the right and click <strong>Generate</strong> to create summaries, reports, flashcards, and more.
            </p>
          </div>
        ) : (
          /* Artifact list */
          <div className="space-y-4">
            {artifacts.map((artifact, index) => {
              const isExpanded = expandedArtifact === artifact.id
              const isVisualStudio = isVisualStudioArtifact(artifact)
              const toolObj = getTool(artifact.tool)
              const categoryLabel = toolObj?.category || 'Knowledge'
              const categoryColors: Record<string, string> = {
                Knowledge: '#2563eb',
                Analysis: '#059669',
                Learning: '#d97706',
                Presentation: '#7c3aed',
              }
              const catColor = categoryColors[categoryLabel] || '#6366f1'

              return (
                <div
                  key={artifact.id}
                  className="rounded-2xl bg-white overflow-hidden transition-all hover:shadow-lg"
                  style={{
                    animation: `fadeIn 0.35s ease-out ${index * 0.05}s both`,
                    border: isExpanded ? `2px solid ${catColor}22` : '1px solid #e5e7eb',
                    boxShadow: isExpanded ? `0 8px 30px -10px ${catColor}20` : '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Card header */}
                  <div
                    className="flex items-center gap-4 px-6 py-5 cursor-pointer select-none group"
                    onClick={() => setExpandedArtifact(isExpanded ? null : artifact.id)}
                  >
                    <span
                      className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${catColor}, ${catColor}cc)` }}
                    >
                      {getToolIcon(artifact.tool)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-on-surface truncate">{artifact.title || artifact.tool}</p>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0"
                          style={{ background: `${catColor}12`, color: catColor }}
                        >
                          {categoryLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {artifact.createdAt.toLocaleString()}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {artifact.sourceCount} source{artifact.sourceCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Edit button */}
                      {isVisualStudio && (
                        <button
                          onClick={(e) => { e.stopPropagation(); editArtifact(artifact) }}
                          className="p-2.5 rounded-xl text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-all opacity-0 group-hover:opacity-100"
                          title="Open Studio Editor"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteArtifact(artifact.id) }}
                        className="p-2.5 rounded-xl text-on-surface-variant hover:text-error hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                        title="Delete artifact"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {/* Expand/collapse chevron */}
                      <span
                        className="p-1.5 rounded-lg text-on-surface-variant transition-all duration-300"
                        style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </span>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                      {/* Divider with category color accent */}
                      <div className="mx-6 h-px" style={{ background: `linear-gradient(90deg, ${catColor}30, transparent)` }} />

                      <div className="px-6 py-6">
                        <div
                          className="prose-atlas max-w-none"
                          dangerouslySetInnerHTML={{ __html: artifact.content }}
                        />

                        {/* Action bar */}
                        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-outline-variant">
                          {isVisualStudio && (
                            <button
                              onClick={() => editArtifact(artifact)}
                              className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-xs font-semibold transition-all hover:shadow-md active:scale-[0.98]"
                              style={{ background: `linear-gradient(135deg, ${catColor}, ${catColor}cc)` }}
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Open Studio Editor
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const tmp = document.createElement('div')
                              tmp.innerHTML = artifact.content
                              navigator.clipboard.writeText(tmp.textContent || '')
                              addToast('Content copied to clipboard', 'success')
                            }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-outline-variant rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-all"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copy text
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
