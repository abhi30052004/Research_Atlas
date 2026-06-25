import React from 'react'
import {
  Edit3, Undo, Redo, Type, Bold, Italic, Underline,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Download, RefreshCw, Sparkles
} from 'lucide-react'
import { Artifact } from '../../../api/workspace'
import { getToolIcon } from '../utils'

interface EditableTabProps {
  editingArtifact: Artifact | null
  setEditingArtifact: (artifact: Artifact | null) => void
  setArtifacts: React.Dispatch<React.SetStateAction<Artifact[]>>
  editorRef: React.RefObject<HTMLDivElement>
  regeneratePrompt: string
  setRegeneratePrompt: (prompt: string) => void
  handleEditorRegenerate: () => Promise<void>
  isEditorRegenerating: boolean
  exportAsPdf: () => void
  exportAsDocx: () => void
  setActiveTab: (tab: 'chat' | 'output' | 'editor') => void
  execCmd: (command: string, value?: string) => void
}

export function EditableTab({
  editingArtifact,
  setEditingArtifact,
  setArtifacts,
  editorRef,
  regeneratePrompt,
  setRegeneratePrompt,
  handleEditorRegenerate,
  isEditorRegenerating,
  exportAsPdf,
  exportAsDocx,
  setActiveTab,
  execCmd,
}: EditableTabProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {editingArtifact ? (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-6 py-2.5 border-b border-outline-variant bg-surface-container-lowest flex-shrink-0 flex-wrap">
            {/* Undo / Redo */}
            <button onClick={() => execCmd('undo')} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" title="Undo">
              <Undo className="w-4 h-4" />
            </button>
            <button onClick={() => execCmd('redo')} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" title="Redo">
              <Redo className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-outline-variant mx-1" />

            {/* Headings */}
            <button onClick={() => execCmd('formatBlock', 'H2')} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" title="Heading">
              <Type className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-outline-variant mx-1" />

            {/* Bold, Italic, Underline */}
            <button onClick={() => execCmd('bold')} className="p-2 rounded-lg text-on-surface-variant hover:bg-secondary/10 hover:text-secondary transition-colors" title="Bold (Ctrl+B)">
              <Bold className="w-4 h-4" />
            </button>
            <button onClick={() => execCmd('italic')} className="p-2 rounded-lg text-on-surface-variant hover:bg-secondary/10 hover:text-secondary transition-colors" title="Italic (Ctrl+I)">
              <Italic className="w-4 h-4" />
            </button>
            <button onClick={() => execCmd('underline')} className="p-2 rounded-lg text-on-surface-variant hover:bg-secondary/10 hover:text-secondary transition-colors" title="Underline (Ctrl+U)">
              <Underline className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-outline-variant mx-1" />

            {/* Lists */}
            <button onClick={() => execCmd('insertUnorderedList')} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" title="Bullet List">
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => execCmd('insertOrderedList')} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" title="Numbered List">
              <ListOrdered className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-outline-variant mx-1" />

            {/* Alignment */}
            <button onClick={() => execCmd('justifyLeft')} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" title="Align Left">
              <AlignLeft className="w-4 h-4" />
            </button>
            <button onClick={() => execCmd('justifyCenter')} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" title="Align Center">
              <AlignCenter className="w-4 h-4" />
            </button>
            <button onClick={() => execCmd('justifyRight')} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" title="Align Right">
              <AlignRight className="w-4 h-4" />
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Export buttons */}
            <button
              onClick={exportAsPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-outline-variant rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              title="Export as PDF"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            <button
              onClick={exportAsDocx}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-outline-variant rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              title="Export as DOCX"
            >
              <Download className="w-3.5 h-3.5" /> DOCX
            </button>

            <span className="w-px h-5 bg-outline-variant mx-1" />

            {/* Regenerate functionality */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={regeneratePrompt}
                onChange={(e) => setRegeneratePrompt(e.target.value)}
                placeholder="Describe what to regenerate..."
                className="w-64 px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/20 transition-all placeholder:text-outline"
              />
              <button
                onClick={handleEditorRegenerate}
                disabled={isEditorRegenerating || !regeneratePrompt.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-medium hover:bg-surface-container-high hover:text-on-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEditorRegenerating ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Regenerating</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5 text-secondary" /> Regenerate</>
                )}
              </button>
            </div>

            <span className="w-px h-5 bg-outline-variant mx-1" />

            {/* Save button */}
            <button
              onClick={() => {
                if (editorRef.current && editingArtifact) {
                  const updated = editorRef.current.innerHTML
                  setArtifacts((prev) =>
                    prev.map((a) => a.id === editingArtifact.id ? { ...a, content: updated } : a)
                  )
                  setEditingArtifact({ ...editingArtifact, content: updated })
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-indigo-600 transition-colors"
            >
              Save Changes
            </button>
          </div>

          {/* Editor header */}
          <div className="px-12 pt-8 pb-4 border-b border-outline-variant flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-md bg-secondary/10 text-secondary flex items-center justify-center">
                {getToolIcon(editingArtifact.tool)}
              </span>
              <h2 className="text-xl font-bold text-on-surface">{editingArtifact.tool}</h2>
            </div>
            <p className="text-xs text-on-surface-variant font-mono mt-1">
              Created {editingArtifact.createdAt.toLocaleString()} • {editingArtifact.sourceCount} sources • Editing
            </p>
          </div>

          {/* ContentEditable area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto px-12 py-8">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="prose prose-slate max-w-none text-sm leading-relaxed min-h-[400px] outline-none
                  [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-on-surface [&_h2]:mb-3
                  [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-on-surface [&_h3]:mb-2 [&_h3]:mt-4
                  [&_p]:text-on-surface-variant [&_p]:mb-3 [&_p]:leading-relaxed
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1 [&_ul]:text-on-surface-variant
                  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-1 [&_ol]:text-on-surface-variant
                  [&_li]:text-on-surface-variant
                  [&_strong]:text-on-surface [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{ __html: editingArtifact.content }}
              />
            </div>
          </div>
        </>
      ) : (
        /* No artifact selected for editing */
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mb-4">
            <Edit3 className="w-7 h-7 text-outline" />
          </div>
          <h3 className="text-lg font-semibold text-on-surface mb-1">No content to edit</h3>
          <p className="text-sm text-on-surface-variant max-w-sm">
            Go to <button onClick={() => setActiveTab('output')} className="text-secondary font-medium hover:underline">Studio Output</button> and click the Edit button on any generated artifact to start editing here.
          </p>
        </div>
      )}
    </div>
  )
}
