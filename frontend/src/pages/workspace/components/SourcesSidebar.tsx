import React from 'react'
import { Upload, Link as LinkIcon, X, FileText, Trash2, Check } from 'lucide-react'
import { Source } from '../../../api/workspace'
import { TypeBadge } from './TypeBadge'
import { progressStageLabel } from '../utils'

interface SourcesSidebarProps {
  fileInputRef: React.RefObject<HTMLInputElement>
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  showUrlInput: boolean
  setShowUrlInput: (show: boolean) => void
  urlValue: string
  setUrlValue: (val: string) => void
  addUrl: () => Promise<void>
  readySources: Source[]
  selectedReadySources: Source[]
  selectAllReadySources: () => void
  clearSelectedSources: () => void
  sources: Source[]
  selectedSourceIds: string[]
  toggleSourceSelection: (id: string, checked: boolean) => void
  handleDeleteSource: (id: string, e: React.MouseEvent) => Promise<void>
}

export function SourcesSidebar({
  fileInputRef,
  handleFileUpload,
  showUrlInput,
  setShowUrlInput,
  urlValue,
  setUrlValue,
  addUrl,
  readySources,
  selectedReadySources,
  selectAllReadySources,
  clearSelectedSources,
  sources,
  selectedSourceIds,
  toggleSourceSelection,
  handleDeleteSource,
}: SourcesSidebarProps) {
  return (
    <aside className="w-72 bg-surface-container-low border-r border-outline-variant hidden md:flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-outline-variant">
        <h2 className="text-xs font-mono font-medium text-outline uppercase tracking-widest mb-3">Sources</h2>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex flex-col items-center justify-center py-3 bg-surface-container-lowest border border-outline-variant rounded-lg hover:border-secondary transition-all group gap-1"
          >
            <Upload className="w-4 h-4 text-secondary" />
            <span className="text-[11px] font-medium text-on-surface-variant">Upload</span>
          </button>
          <button
            onClick={() => setShowUrlInput(true)}
            className="flex-1 flex flex-col items-center justify-center py-3 bg-surface-container-lowest border border-outline-variant rounded-lg hover:border-secondary transition-all group gap-1"
          >
            <LinkIcon className="w-4 h-4 text-secondary" />
            <span className="text-[11px] font-medium text-on-surface-variant">Add URL</span>
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.pptx" multiple className="hidden" onChange={handleFileUpload} />

        {showUrlInput && (
          <div className="mt-3 flex gap-2">
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://..."
              className="flex-1 px-3 py-2 bg-white border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-secondary transition-all"
              onKeyDown={(e) => e.key === 'Enter' && addUrl()}
              autoFocus
            />
            <button onClick={addUrl} className="px-3 py-2 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-indigo-600 transition-colors">Add</button>
            <button onClick={() => setShowUrlInput(false)} className="p-2 text-outline hover:bg-surface-container-high rounded-lg transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {readySources.length > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-on-surface-variant">
              {selectedReadySources.length} of {readySources.length} ready selected
            </span>
            <div className="flex items-center gap-2">
              <button onClick={selectAllReadySources} className="font-medium text-secondary hover:underline">
                All
              </button>
              <button onClick={clearSelectedSources} className="font-medium text-outline hover:text-on-surface">
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
        {sources.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-outline" />
            </div>
            <p className="text-sm font-medium text-on-surface-variant">No sources yet</p>
            <p className="text-xs text-outline mt-1">Upload files or add URLs</p>
          </div>
        )}
        {sources.map((src) => {
          const isReady = src.status === 'processed'
          const isSelected = selectedSourceIds.includes(src.id)
          return (
            <div key={src.id} className={`bg-surface-container-lowest border border-outline-variant p-3 rounded-lg hover:shadow-sm transition-all group ${src.status === 'processing' || src.status === 'pending' ? 'opacity-90' : ''}`}>
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={isReady && isSelected}
                    disabled={!isReady}
                    onChange={(e) => toggleSourceSelection(src.id, e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-outline-variant accent-secondary disabled:opacity-40"
                    title={isReady ? 'Use this source' : 'Source is not ready'}
                  />
                  <TypeBadge type={src.type} />
                </div>
                <div className="flex items-center gap-1">
                  {src.status === 'failed' ? (
                    <span className="flex items-center gap-1 text-[10px] text-red-600 font-medium">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> Failed
                    </span>
                  ) : src.status === 'processed' ? (
                    <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                      <Check className="w-3 h-3" /> {src.progressStage === 'embedding_failed' ? 'Ready (indexing failed)' : 'Ready'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" /> {progressStageLabel(src.progressStage)}
                    </span>
                  )}
                  <button
                    onClick={(e) => handleDeleteSource(src.id, e)}
                    className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-error transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="text-xs font-semibold text-on-surface line-clamp-1">{src.name}</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">{src.meta}</p>
              {(src.status === 'processing' || src.status === 'pending') && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-blue-600">
                      {progressStageLabel(src.progressStage)}
                    </span>
                    {typeof src.progressPct === 'number' && (
                      <span className="text-[10px] font-mono font-semibold text-blue-600">
                        {src.progressPct}%
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.max(3, src.progressPct ?? 5)}%`,
                        background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)',
                      }}
                    />
                  </div>
                </div>
              )}
              {src.status === 'failed' && src.errorMessage && (
                <p className="text-[11px] text-red-600 mt-1 line-clamp-2">{src.errorMessage}</p>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
