import { Source, ProgressStage } from '../../api/workspace'
import { Citation } from './types'
import { STUDIO_TOOLS, PROGRESS_STAGE_LABELS } from './constants'
import { FileText } from 'lucide-react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import {
  renderSlideDeckHtml,
  renderFlashcardsHtml,
  renderQuizHtml,
  renderDataTableHtml,
  renderMindMapHtml
} from './renderers'

export interface SlideDeckSlide {
  slide_number: number
  slide_type: string
  title: string
  subtitle?: string
  bullets: string[]
  speaker_notes: string
  source_reference?: string
  icon?: string
  chart_type?: string
  image_prompt?: string
}

export interface SlideDeckDocument {
  schema: 'atlas_slide_deck_v1'
  slides: SlideDeckSlide[]
}

export function parseStreamData(line: string) {
  let dataStr = line.trim()
  while (dataStr.startsWith('data:')) {
    dataStr = dataStr.slice(5).trim()
  }
  return dataStr ? JSON.parse(dataStr) : null
}

export function progressStageLabel(stage?: string): string {
  return stage ? (PROGRESS_STAGE_LABELS[stage] || stage) : 'Processing…'
}

export function mapSourceType(value: unknown): Source['type'] {
  const normalized = String(value || 'PDF').toUpperCase()
  if (normalized === 'URL' || normalized === 'WEB') return 'WEB'
  if (['PDF', 'DOCX', 'TXT', 'CSV', 'XLSX', 'PPTX'].includes(normalized)) {
    return normalized as Source['type']
  }
  return 'TXT'
}

export function mapSourceStatus(value: unknown): Source['status'] {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'completed' || normalized === 'processed') return 'processed'
  if (normalized === 'failed' || normalized === 'error') return 'failed'
  if (normalized === 'pending') return 'pending'
  return 'processing'
}

export function mapApiSource(source: any, workspaceId: string): Source {
  const fileSize = source.file_size ? `${(source.file_size / 1024).toFixed(0)} KB` : ''
  const createdAt = new Date(source.created_at || source.createdAt || new Date()).toLocaleDateString()
  const chunkMeta = source.chunk_count ? ` - ${source.chunk_count} chunks` : ''
  const meta = source.metadata || {}
  return {
    id: source.id || source._id,
    type: mapSourceType(source.source_type || source.type),
    name: source.original_name || source.filename || source.name || 'Untitled',
    meta: source.meta || `${fileSize ? `${fileSize} - ` : ''}${createdAt}${chunkMeta}`,
    status: mapSourceStatus(source.status),
    workspace_id: workspaceId,
    chunkCount: source.chunk_count || source.chunkCount || 0,
    errorMessage: source.error_message || source.errorMessage,
    progressStage: meta.progress_stage as ProgressStage | undefined,
    progressPct: typeof meta.progress_pct === 'number' ? meta.progress_pct : undefined,
  }
}

export function displayNameFromUrl(rawUrl: string): string {
  try {
    const normalized = rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`
    const url = new URL(normalized)
    const host = url.hostname.replace(/^www\./, '')
    const pathParts = url.pathname.split('/').filter(Boolean)
    const lastPart = pathParts[pathParts.length - 1]
      ?.replace(/\.[a-zA-Z0-9]{1,8}$/, '')
      .replace(/[-_]+/g, ' ')
      .trim()
    return lastPart && !['home', 'index'].includes(lastPart.toLowerCase())
      ? `${host} - ${lastPart}`.slice(0, 80)
      : host.slice(0, 80)
  } catch {
    return rawUrl.slice(0, 80)
  }
}

export function getTool(value: string) {
  return STUDIO_TOOLS.find(t => t.label === value || t.type === value)
}

export function sourceCitationLabel(num: string, name: string | undefined, citations: Citation[] = [], sources: Source[] = []) {
  const explicitName = name?.trim()
  if (explicitName) return explicitName

  const index = Number(num) - 1
  const citation = citations[index]
  const citationName = citation?.source_name || citation?.sourceName || citation?.filename
  if (citationName) {
    const page = citation.page_number || citation.page
    return page ? `${citationName} p.${page}` : citationName
  }

  const sourceId = citation?.source_id || citation?.sourceId
  const matchedSource = sourceId ? sources.find((source) => source.id === sourceId) : sources[index]
  return matchedSource?.name || `Source ${num}`
}

export function convertSourceCitations(html: string, citations: Citation[] = [], sources: Source[] = []): string {
  // Convert [Source N] and [Source: filename] to styled pills
  return html
    .replace(/\[Source\s+(\d+)(?::\s*([^\]]+))?\]/gi, (_match, num, name) => {
      const label = sourceCitationLabel(num, name, citations, sources)
      return `<span class="source-cite">${escapeHtml(label)}</span>`
    })
    .replace(/\[Source:\s*([^\]]+)\]/gi, (_match, name) => {
      return `<span class="source-cite">${escapeHtml(name.trim())}</span>`
    })
}

export function getToolIcon(label: string) {
  const found = getTool(label)
  return found ? found.icon : <FileText className="w-4 h-4" />
}

export function formatToolName(value: string) {
  return getTool(value)?.label || value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function parseMaybeJson(content: unknown) {
  if (typeof content !== 'string') return content
  const trimmed = content.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return content
  try {
    return JSON.parse(trimmed)
  } catch {
    return content
  }
}

export function normalizeSlideDeckContent(content: unknown): SlideDeckDocument | null {
  const parsed = parseMaybeJson(content)
  const rawSlides = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).slides) ? (parsed as any).slides : null)

  if (!rawSlides) return null

  const slides: SlideDeckSlide[] = rawSlides.map((raw: any, index: number) => {
    const bullets = Array.isArray(raw?.bullets)
      ? raw.bullets.map((b: unknown) => String(b || '').trim()).filter(Boolean)
      : []
    return {
      slide_number: Number(raw?.slide_number) || index + 1,
      slide_type: String(raw?.slide_type || 'content'),
      title: String(raw?.title || `Slide ${index + 1}`),
      subtitle: raw?.subtitle ? String(raw.subtitle) : '',
      bullets,
      speaker_notes: String(raw?.speaker_notes || ''),
      source_reference: raw?.source_reference ? String(raw.source_reference) : '',
      icon: raw?.icon ? String(raw.icon) : '',
      chart_type: raw?.chart_type ? String(raw.chart_type) : '',
      image_prompt: raw?.image_prompt ? String(raw.image_prompt) : '',
    }
  })

  return {
    schema: 'atlas_slide_deck_v1',
    slides,
  }
}

export function renderSlideDeckDocument(doc: SlideDeckDocument): string {
  return DOMPurify.sanitize(renderSlideDeckHtml(doc.slides))
}

export function normalizeArtifactContent(tool: string, content: unknown) {
  const parsed = parseMaybeJson(content)
  const toolType = getTool(tool)?.type || tool

  if (Array.isArray(parsed) && toolType === 'data_table') {
    return DOMPurify.sanitize(renderDataTableHtml(parsed))
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && toolType === 'mind_map') {
    return DOMPurify.sanitize(renderMindMapHtml(parsed))
  }
  if (toolType === 'slide_deck') {
    const slideDeckDoc = normalizeSlideDeckContent(parsed)
    if (slideDeckDoc) return renderSlideDeckDocument(slideDeckDoc)
  }
  if (Array.isArray(parsed) && toolType === 'flashcards') {
    return DOMPurify.sanitize(renderFlashcardsHtml(parsed))
  }
  if (Array.isArray(parsed) && toolType === 'quiz') {
    return DOMPurify.sanitize(renderQuizHtml(parsed))
  }

  let contentStr = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
  if (contentStr.match(/(^#|\*\*|\* |- |`)/m) && !contentStr.startsWith('<')) {
    let html = DOMPurify.sanitize(marked.parse(contentStr) as string)
    // Convert [Source: filename] to styled citation pills
    html = html
      .replace(/\[Source\s+(\d+)(?::\s*([^\]]+))?\]/gi, (_match: string, num: string, name: string) => {
        const label = name ? name.trim() : `Source ${num}`
        return `<span class="source-cite">${escapeHtml(label)}</span>`
      })
      .replace(/\[Source:\s*([^\]]+)\]/gi, (_match: string, name: string) => {
        return `<span class="source-cite">${escapeHtml(name.trim())}</span>`
      })
    // Wrap in prose-atlas container
    contentStr = `<div class="prose-atlas">${html}</div>`
  }
  return contentStr
}
