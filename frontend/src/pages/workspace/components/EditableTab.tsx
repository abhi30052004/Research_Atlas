import React, { useEffect, useMemo, useState } from 'react'
import {
  Edit3, Undo, Redo, Type, Bold, Italic, Underline,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Download, RefreshCw, Sparkles
} from 'lucide-react'
import { Artifact } from '../../../api/workspace'
import {
  getTool,
  getToolIcon,
  normalizeInfographicContent,
  normalizeSlideDeckContent,
  renderInfographicHtml,
  renderSlideDeckDocument,
  InfographicDocument,
  SlideDeckDocument
} from '../utils'
import { InfographicCanvasEditor } from './InfographicCanvasEditor'

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
  const isSlideDeckArtifact = Boolean(
    editingArtifact && ((getTool(editingArtifact.tool)?.type || editingArtifact.tool) === 'slide_deck')
  )
  const isInfographicArtifact = Boolean(
    editingArtifact && ((getTool(editingArtifact.tool)?.type || editingArtifact.tool) === 'infographic_content')
  )
  const isVisualStudioArtifact = isSlideDeckArtifact || isInfographicArtifact
  const visualEditPrompts = isSlideDeckArtifact
    ? [
        'Make the deck more executive and polished',
        'Add stronger visuals, charts, and speaker notes',
        'Simplify crowded slides and improve flow',
        'Change to a modern consulting-style theme',
      ]
    : isInfographicArtifact
      ? [
          'Make this infographic more visual and scannable',
          'Convert data points into charts and diagrams',
          'Improve color theme, spacing, and hierarchy',
          'Add icons, timeline, and process flow where useful',
        ]
      : []

  const [slideDeckDoc, setSlideDeckDoc] = useState<SlideDeckDocument | null>(null)
  const [infographicDoc, setInfographicDoc] = useState<InfographicDocument | null>(null)
  const renderedSlideDeckHtml = useMemo(
    () => (slideDeckDoc ? renderSlideDeckDocument(slideDeckDoc) : ''),
    [slideDeckDoc]
  )
  const renderedInfographicHtml = useMemo(
    () => (infographicDoc ? renderInfographicHtml(infographicDoc) : ''),
    [infographicDoc]
  )

  useEffect(() => {
    if (!editingArtifact || !isSlideDeckArtifact) {
      setSlideDeckDoc(null)
    } else {
      const parsed = normalizeSlideDeckContent(editingArtifact.structuredContent ?? editingArtifact.content)
      setSlideDeckDoc(parsed)
    }
  }, [editingArtifact, isSlideDeckArtifact])

  useEffect(() => {
    if (!editingArtifact || !isInfographicArtifact) {
      setInfographicDoc(null)
    } else {
      const parsed = normalizeInfographicContent(editingArtifact.structuredContent ?? editingArtifact.content)
      setInfographicDoc(parsed)
    }
  }, [editingArtifact, isInfographicArtifact])

  useEffect(() => {
    if (!isSlideDeckArtifact || !editorRef.current || !renderedSlideDeckHtml) return
    editorRef.current.innerHTML = renderedSlideDeckHtml
  }, [isSlideDeckArtifact, renderedSlideDeckHtml, editorRef])

  useEffect(() => {
    if (!isInfographicArtifact || !editorRef.current || !renderedInfographicHtml) return
    editorRef.current.innerHTML = renderedInfographicHtml
  }, [isInfographicArtifact, renderedInfographicHtml, editorRef])

  const updateSlide = (index: number, updates: Record<string, unknown>) => {
    setSlideDeckDoc((prev) => {
      if (!prev) return prev
      const nextSlides = prev.slides.map((slide, i) => (i === index ? { ...slide, ...updates } : slide))
      return { ...prev, slides: nextSlides }
    })
  }

  const updateSlideDeckMeta = (updates: Partial<SlideDeckDocument>) => {
    setSlideDeckDoc((prev) => (prev ? { ...prev, ...updates } : prev))
  }

  const saveChanges = () => {
    if (!editingArtifact) return

    if (isSlideDeckArtifact && slideDeckDoc) {
      const updatedHtml = renderSlideDeckDocument(slideDeckDoc)
      if (editorRef.current) {
        editorRef.current.innerHTML = updatedHtml
      }
      setArtifacts((prev) =>
        prev.map((a) => (a.id === editingArtifact.id
          ? { ...a, content: updatedHtml, structuredContent: slideDeckDoc }
          : a))
      )
      setEditingArtifact({ ...editingArtifact, content: updatedHtml, structuredContent: slideDeckDoc })
      return
    }

    if (isInfographicArtifact && infographicDoc) {
      const updatedHtml = renderInfographicHtml(infographicDoc)
      if (editorRef.current) editorRef.current.innerHTML = updatedHtml
      setArtifacts((prev) =>
        prev.map((a) => (a.id === editingArtifact.id
          ? { ...a, content: updatedHtml, structuredContent: infographicDoc }
          : a))
      )
      setEditingArtifact({ ...editingArtifact, content: updatedHtml, structuredContent: infographicDoc })
      return
    }

    if (editorRef.current) {
      const updated = editorRef.current.innerHTML
      setArtifacts((prev) =>
        prev.map((a) => (a.id === editingArtifact.id ? { ...a, content: updated } : a))
      )
      setEditingArtifact({ ...editingArtifact, content: updated })
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {editingArtifact ? (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-6 py-2.5 border-b border-outline-variant bg-surface-container-lowest flex-shrink-0 flex-wrap">
            {!isSlideDeckArtifact && !isInfographicArtifact && (
              <>
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
              </>
            )}

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
                placeholder={isVisualStudioArtifact ? 'Ask Atlas to refine this visual...' : 'Describe what to regenerate...'}
                className={`${isVisualStudioArtifact ? 'w-80' : 'w-64'} px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/20 transition-all placeholder:text-outline`}
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
              onClick={saveChanges}
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
            {isVisualStudioArtifact && (
              <div className="mt-4 flex flex-wrap gap-2">
                {visualEditPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setRegeneratePrompt(prompt)}
                    className="rounded-full border border-outline-variant bg-white px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:border-secondary/40 hover:bg-secondary/5 hover:text-secondary"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}          </div>

          {/* ContentEditable area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto px-12 py-8">
              {isVisualStudioArtifact && (
                <div className="mb-5 rounded-xl border border-secondary/20 bg-secondary/5 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-lg bg-secondary/10 p-2 text-secondary">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {isSlideDeckArtifact ? 'Slide Deck Studio Editor' : 'Infographic Studio Editor'}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                        Edit fields directly, or choose a refinement chip above and regenerate only this visual artifact.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {isSlideDeckArtifact && slideDeckDoc ? (
                <div className="space-y-5">
                  <section className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm">
                    <div className="mb-3">
                      <p className="text-xs uppercase font-semibold text-on-surface-variant">Deck Design</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={slideDeckDoc.deck_title || ''}
                        onChange={(e) => updateSlideDeckMeta({ deck_title: e.target.value })}
                        placeholder="Deck title"
                        className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                      />
                      <input
                        value={slideDeckDoc.template || ''}
                        onChange={(e) => updateSlideDeckMeta({ template: e.target.value })}
                        placeholder="Template style"
                        className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                      />
                      <input
                        value={slideDeckDoc.color_theme?.name || ''}
                        onChange={(e) => updateSlideDeckMeta({
                          color_theme: { ...(slideDeckDoc.color_theme || {}), name: e.target.value }
                        })}
                        placeholder="Theme name"
                        className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        {(['primary', 'accent', 'background'] as const).map((key) => (
                          <input
                            key={key}
                            value={slideDeckDoc.color_theme?.[key] || ''}
                            onChange={(e) => updateSlideDeckMeta({
                              color_theme: { ...(slideDeckDoc.color_theme || {}), [key]: e.target.value }
                            })}
                            placeholder={key}
                            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                          />
                        ))}
                      </div>
                    </div>
                  </section>
                  {slideDeckDoc.slides.map((slide, index) => (
                    <section key={`${slide.slide_number}-${index}`} className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="text-xs uppercase font-semibold text-on-surface-variant">
                          Slide {slide.slide_number} - {slide.slide_type}
                        </div>
                      </div>
                      <div className="grid gap-3">
                        <input
                          value={slide.title}
                          onChange={(e) => updateSlide(index, { title: e.target.value })}
                          placeholder="Slide title"
                          className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                        />
                        <input
                          value={slide.subtitle || ''}
                          onChange={(e) => updateSlide(index, { subtitle: e.target.value })}
                          placeholder="Subtitle"
                          className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                        />
                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            value={slide.slide_type || ''}
                            onChange={(e) => updateSlide(index, { slide_type: e.target.value })}
                            placeholder="Slide type"
                            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                          />
                          <input
                            value={slide.layout || ''}
                            onChange={(e) => updateSlide(index, { layout: e.target.value })}
                            placeholder="Layout"
                            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                          />
                        </div>
                        <textarea
                          value={(slide.bullets || []).join('\n')}
                          onChange={(e) => updateSlide(index, {
                            bullets: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean)
                          })}
                          placeholder="Bullet points (one line per bullet)"
                          className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm h-24 resize-y focus:outline-none focus:border-secondary"
                        />
                        <textarea
                          value={slide.speaker_notes || ''}
                          onChange={(e) => updateSlide(index, { speaker_notes: e.target.value })}
                          placeholder="Speaker notes"
                          className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm h-24 resize-y focus:outline-none focus:border-secondary"
                        />
                        <div className="grid gap-3 md:grid-cols-3">
                          <input
                            value={slide.icon || ''}
                            onChange={(e) => updateSlide(index, { icon: e.target.value })}
                            placeholder="Icon hint"
                            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                          />
                          <input
                            value={slide.chart_type || ''}
                            onChange={(e) => updateSlide(index, { chart_type: e.target.value })}
                            placeholder="Chart type"
                            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                          />
                          <input
                            value={slide.image_prompt || ''}
                            onChange={(e) => updateSlide(index, { image_prompt: e.target.value })}
                            placeholder="Image prompt"
                            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                          />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            value={slide.image_search_query || ''}
                            onChange={(e) => updateSlide(index, { image_search_query: e.target.value })}
                            placeholder="Image search query"
                            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                          />
                          <input
                            value={slide.image_alt || ''}
                            onChange={(e) => updateSlide(index, { image_alt: e.target.value })}
                            placeholder="Image alt text"
                            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                          />
                        </div>
                        <input
                          value={slide.source_reference || ''}
                          onChange={(e) => updateSlide(index, { source_reference: e.target.value })}
                          placeholder="Source reference"
                          className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:border-secondary"
                        />
                      </div>
                    </section>
                  ))}
                </div>
              ) : isInfographicArtifact && infographicDoc ? (
                <InfographicCanvasEditor
                  document={infographicDoc}
                  onChange={setInfographicDoc}
                  onSave={() => saveChanges()}
                />
              ) : (
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
              )}
              {(isSlideDeckArtifact || isInfographicArtifact) && (
                <div ref={editorRef} className="hidden" aria-hidden="true" />
              )}
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

