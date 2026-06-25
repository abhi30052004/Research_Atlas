import { ChevronRight, RefreshCw } from 'lucide-react'
import { STUDIO_TOOLS } from '../constants'

interface StudioToolsSidebarProps {
  selectedTool: string | null
  setSelectedTool: (tool: string | null) => void
  handleGenerate: () => Promise<void>
  canGenerate: boolean
  isGeneratingArtifact: boolean
  generateHint: string | null
  selectedReadySourcesLength: number
}

export function StudioToolsSidebar({
  selectedTool,
  setSelectedTool,
  handleGenerate,
  canGenerate,
  isGeneratingArtifact,
  generateHint,
  selectedReadySourcesLength,
}: StudioToolsSidebarProps) {
  return (
    <aside className="w-56 bg-surface-container-low border-l border-outline-variant hidden xl:flex flex-col flex-shrink-0">
      <div className="p-4">
        <h2 className="text-xs font-mono font-medium text-outline uppercase tracking-widest mb-4">Studio Tools</h2>
        <div className="space-y-0.5">
          {STUDIO_TOOLS.map((tool) => (
            <button
              key={tool.label}
              onClick={() => setSelectedTool(tool.label)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors text-xs font-medium group ${selectedTool === tool.label
                ? 'bg-secondary/10 text-secondary'
                : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                }`}
            >
              <span className={`flex-shrink-0 ${selectedTool === tool.label ? 'text-secondary' : 'text-outline group-hover:text-secondary'}`}>
                {tool.icon}
              </span>
              <span>{tool.label}</span>
              {selectedTool === tool.label && <ChevronRight className="w-3 h-3 ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      {selectedTool && (
        <div className="mx-4 mb-4 p-3 bg-surface-container-lowest border border-outline-variant rounded-lg">
          <p className="text-xs font-semibold text-on-surface mb-2">{selectedTool}</p>
          <p className="mb-2 text-[11px] text-on-surface-variant">
            {selectedReadySourcesLength > 0
              ? `Using ${selectedReadySourcesLength} selected source${selectedReadySourcesLength === 1 ? '' : 's'}`
              : 'No ready sources selected'}
          </p>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full py-2 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingArtifact ? (
              <span className="inline-flex items-center justify-center gap-2">
                <RefreshCw className="w-3 h-3 animate-spin" /> Generating
              </span>
            ) : (
              'Generate'
            )}
          </button>
          {generateHint && (
            <p className="mt-2 text-[11px] leading-snug text-on-surface-variant">{generateHint}</p>
          )}
        </div>
      )}
    </aside>
  )
}
