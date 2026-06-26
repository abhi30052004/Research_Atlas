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
  layout?: string
  title: string
  subtitle?: string
  bullets: string[]
  speaker_notes: string
  source_reference?: string
  icon?: string
  chart_type?: string
  chart_data?: {
    title?: string
    labels: string[]
    values: Array<number | string>
    unit?: string
    insight?: string
  }
  table?: {
    columns: string[]
    rows: string[][]
  }
  timeline?: Array<{
    date?: string
    label: string
    description?: string
  }>
  diagram?: {
    type?: string
    nodes: string[]
    relationships?: string[]
  }
  image_prompt?: string
  image_search_query?: string
  image_url?: string
  image_alt?: string
}

export interface SlideDeckDocument {
  schema: 'atlas_slide_deck_v1' | 'atlas_slide_deck_v2'
  deck_title?: string
  template?: string
  color_theme?: {
    name?: string
    primary?: string
    accent?: string
    background?: string
  }
  slides: SlideDeckSlide[]
}

export type InfographicElementType =
  | 'title'
  | 'subtitle'
  | 'stat'
  | 'section'
  | 'takeaway'
  | 'icon'
  | 'image'
  | 'chart'
  | 'icon_card'
  | 'process_flow'
  | 'timeline'
  | 'mind_map'
  | 'hierarchy'

export interface InfographicElement {
  id: string
  type: InfographicElementType
  title?: string
  text?: string
  icon?: string
  source?: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  fontSize?: number
  fontStyle?: 'normal' | 'bold'
  fill?: string
  align?: 'left' | 'center' | 'right'
  imageUrl?: string
  chart_type?: 'bar' | 'line' | 'pie' | 'donut' | 'metric' | string
  chart_data?: {
    labels: string[]
    values: Array<number | string>
    unit?: string
  }
  steps?: string[]
  timeline?: Array<{
    date?: string
    label: string
    description?: string
  }>
  nodes?: Array<{
    label: string
    children?: string[]
  }>
}

export interface InfographicDocument {
  schema: 'atlas_infographic_v1' | 'atlas_infographic_v2'
  title: string
  subtitle: string
  template?: string
  color_theme?: {
    name?: string
    primary?: string
    accent?: string
    background?: string
  }
  takeaways?: string[]
  width: number
  height: number
  background: string
  elements: InfographicElement[]
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
  let trimmed = content.trim()
  if (trimmed.startsWith('```')) {
    trimmed = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
  }
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return content
  try {
    return JSON.parse(trimmed)
  } catch {
    return content
  }
}

function normalizeMalformedVisualText(content: string): string {
  return content
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function recoverMalformedInfographic(content: string): InfographicDocument {
  const cleaned = normalizeMalformedVisualText(content)
  const field = (name: string, fallback: string) => {
    const matches = [...cleaned.matchAll(new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`, 'g'))]
    const match = matches[matches.length - 1]
    return match?.[1]?.trim() || fallback
  }
  const primary = field('primary', '#1E3A8A')
  const accent = field('accent', '#3B82F6')
  const background = field('background', '#F3F4F6')
  const title = field('title', 'Generated Infographic')
  const subtitle = field('subtitle', 'Key insights from the selected sources.')
  const template = field('template', 'executive_snapshot')

  return {
    schema: 'atlas_infographic_v2',
    title,
    subtitle,
    template,
    color_theme: {
      name: 'Recovered Professional Theme',
      primary,
      accent,
      background,
    },
    takeaways: ['Regenerate or refine this infographic for fully structured visuals.'],
    width: 900,
    height: 1000,
    background,
    elements: [
      {
        id: 'recovered_concept_1',
        type: 'icon_card',
        title: 'Recovered Infographic',
        text: 'The AI returned malformed JSON, so Atlas converted it into an editable visual fallback.',
        icon: 'Sparkles',
        x: 40,
        y: 150,
        width: 390,
        height: 130,
        fontSize: 16,
        fill: primary,
      },
      {
        id: 'recovered_concept_2',
        type: 'icon_card',
        title: 'Next Step',
        text: 'Use the visual refinement prompt to regenerate charts, icons, flows, and hierarchy.',
        icon: 'RefreshCw',
        x: 470,
        y: 150,
        width: 390,
        height: 130,
        fontSize: 16,
        fill: accent,
      },
    ],
  }
}

export function normalizeSlideDeckContent(content: unknown): SlideDeckDocument | null {
  const parsed = parseMaybeJson(content)
  const parsedObject = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as any : null
  const rawSlides = Array.isArray(parsed)
    ? parsed
    : (parsedObject && Array.isArray(parsedObject.slides) ? parsedObject.slides : null)

  if (!rawSlides) return null

  const toStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []

  const normalizeChartData = (value: any) => {
    if (!value || typeof value !== 'object') return undefined
    const labels = toStringArray(value.labels)
    const values = Array.isArray(value.values)
      ? value.values.map((item: unknown) => {
          const numeric = Number(item)
          return Number.isFinite(numeric) ? numeric : String(item ?? '').trim()
        }).filter((item: unknown) => item !== '')
      : []
    if (!labels.length || !values.length) return undefined
    return {
      title: value.title ? String(value.title) : '',
      labels,
      values,
      unit: value.unit ? String(value.unit) : '',
      insight: value.insight ? String(value.insight) : '',
    }
  }

  const normalizeTable = (value: any) => {
    if (!value || typeof value !== 'object') return undefined
    const columns = toStringArray(value.columns)
    const rows = Array.isArray(value.rows)
      ? value.rows
          .map((row: unknown) => Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : [])
          .filter((row: string[]) => row.length)
      : []
    if (!columns.length || !rows.length) return undefined
    return { columns, rows }
  }

  const normalizeTimeline = (value: any) => {
    if (!Array.isArray(value)) return undefined
    const timeline = value
      .map((item) => ({
        date: item?.date ? String(item.date) : '',
        label: String(item?.label || '').trim(),
        description: item?.description ? String(item.description) : '',
      }))
      .filter((item) => item.label)
    return timeline.length ? timeline : undefined
  }

  const normalizeDiagram = (value: any) => {
    if (!value || typeof value !== 'object') return undefined
    const nodes = toStringArray(value.nodes)
    if (!nodes.length) return undefined
    return {
      type: value.type ? String(value.type) : '',
      nodes,
      relationships: toStringArray(value.relationships),
    }
  }

  const slides: SlideDeckSlide[] = rawSlides.map((raw: any, index: number) => {
    const bullets = Array.isArray(raw?.bullets)
      ? raw.bullets.map((b: unknown) => String(b || '').trim()).filter(Boolean)
      : []
    return {
      slide_number: Number(raw?.slide_number) || index + 1,
      slide_type: String(raw?.slide_type || 'content'),
      layout: raw?.layout ? String(raw.layout) : '',
      title: String(raw?.title || `Slide ${index + 1}`),
      subtitle: raw?.subtitle ? String(raw.subtitle) : '',
      bullets,
      speaker_notes: String(raw?.speaker_notes || ''),
      source_reference: raw?.source_reference ? String(raw.source_reference) : '',
      icon: raw?.icon ? String(raw.icon) : '',
      chart_type: raw?.chart_type ? String(raw.chart_type) : '',
      chart_data: normalizeChartData(raw?.chart_data),
      table: normalizeTable(raw?.table),
      timeline: normalizeTimeline(raw?.timeline),
      diagram: normalizeDiagram(raw?.diagram),
      image_prompt: raw?.image_prompt ? String(raw.image_prompt) : '',
      image_search_query: raw?.image_search_query ? String(raw.image_search_query) : '',
      image_url: raw?.image_url || raw?.imageUrl ? String(raw.image_url || raw.imageUrl) : '',
      image_alt: raw?.image_alt ? String(raw.image_alt) : '',
    }
  })

  const colorTheme = parsedObject?.color_theme && typeof parsedObject.color_theme === 'object'
    ? {
        name: parsedObject.color_theme.name ? String(parsedObject.color_theme.name) : '',
        primary: parsedObject.color_theme.primary ? String(parsedObject.color_theme.primary) : '',
        accent: parsedObject.color_theme.accent ? String(parsedObject.color_theme.accent) : '',
        background: parsedObject.color_theme.background ? String(parsedObject.color_theme.background) : '',
      }
    : undefined

  return {
    schema: parsedObject?.schema === 'atlas_slide_deck_v2' ? 'atlas_slide_deck_v2' : 'atlas_slide_deck_v1',
    deck_title: parsedObject?.deck_title ? String(parsedObject.deck_title) : '',
    template: parsedObject?.template ? String(parsedObject.template) : '',
    color_theme: colorTheme,
    slides,
  }
}

export function renderSlideDeckDocument(doc: SlideDeckDocument): string {
  return DOMPurify.sanitize(renderSlideDeckHtml(doc.slides, doc))
}

function parseInfographicSections(input: string): { title: string; subtitle: string; stats: string[]; sections: string[]; takeaways: string[] } {
  const lines = input.split('\n').map((line) => line.trim()).filter(Boolean)
  let title = 'Infographic'
  let subtitle = 'Key insights at a glance'
  const stats: string[] = []
  const sections: string[] = []
  const takeaways: string[] = []
  let mode: 'stats' | 'sections' | 'takeaways' | null = null

  for (const line of lines) {
    const clean = line.replace(/^[-*]\s*/, '')
    const lower = clean.toLowerCase()
    if (lower.includes('headline')) continue
    if (lower.includes('sub-headline')) continue
    if (/^#{1,3}\s/.test(line)) {
      const heading = line.replace(/^#{1,3}\s*/, '')
      if (heading.toLowerCase().includes('key statistics')) mode = 'stats'
      else if (heading.toLowerCase().includes('main sections')) mode = 'sections'
      else if (heading.toLowerCase().includes('key takeaways')) mode = 'takeaways'
      else mode = null
      continue
    }
    if (title === 'Infographic' && !line.startsWith('#')) {
      title = clean.slice(0, 72)
      continue
    }
    if (subtitle === 'Key insights at a glance' && !lower.includes('source:')) {
      subtitle = clean.slice(0, 140)
      continue
    }
    if (mode === 'stats' && !lower.includes('source:')) stats.push(clean)
    if (mode === 'sections' && !lower.includes('source:')) sections.push(clean)
    if (mode === 'takeaways' && !lower.includes('source:')) takeaways.push(clean)
  }

  if (!stats.length) stats.push(...lines.filter((line) => /\d/.test(line)).slice(0, 4))
  if (!sections.length) sections.push(...lines.filter((line) => line.length > 24).slice(0, 4))
  if (!takeaways.length) takeaways.push(...lines.slice(-3))
  return { title, subtitle, stats: stats.slice(0, 6), sections: sections.slice(0, 5), takeaways: takeaways.slice(0, 3) }
}

export function normalizeInfographicContent(content: unknown): InfographicDocument | null {
  const parsed = parseMaybeJson(content)
  if (
    parsed &&
    typeof parsed === 'object' &&
    ['atlas_infographic_v1', 'atlas_infographic_v2'].includes(String((parsed as any).schema || '')) &&
    Array.isArray((parsed as any).elements)
  ) {
    const rawDoc = parsed as any
    const palette = rawDoc.color_theme && typeof rawDoc.color_theme === 'object'
      ? {
          name: rawDoc.color_theme.name ? String(rawDoc.color_theme.name) : '',
          primary: rawDoc.color_theme.primary ? String(rawDoc.color_theme.primary) : '',
          accent: rawDoc.color_theme.accent ? String(rawDoc.color_theme.accent) : '',
          background: rawDoc.color_theme.background ? String(rawDoc.color_theme.background) : '',
        }
      : undefined
    const elements = rawDoc.elements.map((raw: any, index: number) => {
      const column = index % 2
      const row = Math.floor(index / 2)
      const type = String(raw?.type || 'section') as InfographicElementType
      const defaultWidth = ['process_flow', 'timeline', 'mind_map', 'hierarchy'].includes(type) ? 820 : 390
      const defaultHeight = ['process_flow', 'timeline', 'mind_map', 'hierarchy'].includes(type) ? 150 : 120
      const normalizeStringArray = (value: unknown): string[] =>
        Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []
      const normalizeNodes = (value: unknown) =>
        Array.isArray(value)
          ? value.map((node: any) => ({
              label: String(node?.label || node?.name || '').trim(),
              children: normalizeStringArray(node?.children),
            })).filter((node) => node.label)
          : undefined
      const normalizeTimeline = (value: unknown) =>
        Array.isArray(value)
          ? value.map((item: any) => ({
              date: item?.date ? String(item.date) : '',
              label: String(item?.label || '').trim(),
              description: item?.description ? String(item.description) : '',
            })).filter((item) => item.label)
          : undefined
      const chartData = raw?.chart_data && typeof raw.chart_data === 'object'
        ? {
            labels: normalizeStringArray(raw.chart_data.labels),
            values: Array.isArray(raw.chart_data.values)
              ? raw.chart_data.values.map((value: unknown) => {
                  const numeric = Number(value)
                  return Number.isFinite(numeric) ? numeric : String(value ?? '').trim()
                }).filter((value: unknown) => value !== '')
              : [],
            unit: raw.chart_data.unit ? String(raw.chart_data.unit) : '',
          }
        : undefined

      return {
        id: String(raw?.id || `${type}_${index + 1}`),
        type,
        title: raw?.title ? String(raw.title) : '',
        text: raw?.text ? String(raw.text) : '',
        icon: raw?.icon ? String(raw.icon) : '',
        source: raw?.source ? String(raw.source) : '',
        x: Number(raw?.x) || (type === 'title' || type === 'subtitle' || defaultWidth > 500 ? 40 : column === 0 ? 40 : 470),
        y: Number(raw?.y) || 150 + row * 150,
        width: Number(raw?.width) || defaultWidth,
        height: Number(raw?.height) || defaultHeight,
        rotation: Number(raw?.rotation) || 0,
        fontSize: Number(raw?.fontSize) || (type === 'title' ? 42 : type === 'subtitle' ? 18 : 16),
        fontStyle: raw?.fontStyle === 'bold' ? 'bold' : 'normal',
        fill: raw?.fill ? String(raw.fill) : (type === 'chart' ? '#1d4ed8' : '#0f172a'),
        align: ['left', 'center', 'right'].includes(String(raw?.align)) ? raw.align : 'left',
        imageUrl: raw?.imageUrl || raw?.image_url ? String(raw.imageUrl || raw.image_url) : '',
        chart_type: raw?.chart_type ? String(raw.chart_type) : '',
        chart_data: chartData?.labels.length && chartData.values.length ? chartData : undefined,
        steps: normalizeStringArray(raw?.steps),
        timeline: normalizeTimeline(raw?.timeline),
        nodes: normalizeNodes(raw?.nodes),
      } as InfographicElement
    })

    return {
      schema: rawDoc.schema === 'atlas_infographic_v2' ? 'atlas_infographic_v2' : 'atlas_infographic_v1',
      title: String(rawDoc.title || 'Infographic'),
      subtitle: String(rawDoc.subtitle || 'Key insights at a glance'),
      template: rawDoc.template ? String(rawDoc.template) : '',
      color_theme: palette,
      takeaways: Array.isArray(rawDoc.takeaways) ? rawDoc.takeaways.map((item: unknown) => String(item || '')).filter(Boolean) : [],
      width: Number(rawDoc.width) || 900,
      height: Number(rawDoc.height) || 1000,
      background: String(rawDoc.background || palette?.background || '#f8fafc'),
      elements,
    }
  }

  if (typeof parsed !== 'string') return null
  const visualText = normalizeMalformedVisualText(parsed)
  if (visualText.includes('atlas_infographic_v2') || visualText.includes('atlas_infographic_v1') || parsed.trim().startsWith('```')) {
    return recoverMalformedInfographic(parsed)
  }
  const data = parseInfographicSections(parsed)
  const elements: InfographicElement[] = [
    { id: 'title', type: 'title', text: data.title, x: 36, y: 24, width: 820, height: 64, fontSize: 42, fontStyle: 'bold', fill: '#0f172a', align: 'left' },
    { id: 'subtitle', type: 'subtitle', text: data.subtitle, x: 36, y: 92, width: 820, height: 44, fontSize: 18, fill: '#334155', align: 'left' },
  ]
  data.stats.forEach((stat, i) => {
    elements.push({
      id: `stat_${i + 1}`,
      type: 'stat',
      text: stat,
      x: i % 2 === 0 ? 36 : 450,
      y: 154 + Math.floor(i / 2) * 86,
      width: 380,
      height: 72,
      fontSize: 19,
      fontStyle: 'bold',
      fill: '#1d4ed8',
    })
  })
  data.sections.forEach((section, i) => {
    elements.push({
      id: `section_${i + 1}`,
      type: 'section',
      text: section,
      x: i % 2 === 0 ? 36 : 450,
      y: 420 + Math.floor(i / 2) * 92,
      width: 380,
      height: 78,
      fontSize: 16,
      fill: '#0f172a',
    })
  })
  data.takeaways.forEach((takeaway, i) => {
    elements.push({
      id: `takeaway_${i + 1}`,
      type: 'takeaway',
      text: takeaway,
      x: 36,
      y: 640 + i * 58,
      width: 794,
      height: 52,
      fontSize: 15,
      fill: '#0f172a',
    })
  })

  return {
    schema: 'atlas_infographic_v1',
    title: data.title,
    subtitle: data.subtitle,
    width: 900,
    height: 880,
    background: '#f8fafc',
    elements,
  }
}

export function createEnrichedInfographicDocument(doc: InfographicDocument): InfographicDocument {
  const hasIcon = doc.elements.some((el) => el.type === 'icon')
  const hasImage = doc.elements.some((el) => el.type === 'image')
  const elements = [...doc.elements]
  if (!hasIcon) {
    elements.push({
      id: 'auto_icon_1',
      type: 'icon',
      text: '📊',
      x: doc.width - 86,
      y: 26,
      width: 42,
      height: 42,
      fontSize: 36,
      fill: '#1d4ed8',
      align: 'center',
    })
  }
  if (!hasImage) {
    elements.push({
      id: 'auto_image_1',
      type: 'image',
      text: 'Paste image URL to replace',
      x: doc.width - 230,
      y: doc.height - 190,
      width: 190,
      height: 120,
      fontSize: 13,
      fill: '#64748b',
      align: 'center',
    })
  }
  return { ...doc, elements }
}

function safeInfographicColor(value: unknown, fallback: string) {
  const color = String(value || '').trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback
}

function renderInfographicChart(el: InfographicElement, accent: string) {
  const labels = el.chart_data?.labels || []
  const values = (el.chart_data?.values || []).map((value) => Number(value)).filter((value) => Number.isFinite(value))
  if (!labels.length || !values.length) return ''
  const max = Math.max(...values, 1)
  return `
    <div class="rounded-lg border border-outline-variant bg-white p-3">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div>
          <p class="text-[11px] font-bold uppercase text-outline">${escapeHtml(el.chart_type || 'chart')}</p>
          <h3 class="text-sm font-bold text-on-surface">${escapeHtml(el.title || 'Data insight')}</h3>
        </div>
        ${el.icon ? `<span class="text-xl">${escapeHtml(el.icon)}</span>` : ''}
      </div>
      <div class="space-y-2">
        ${values.map((value, index) => {
          const width = Math.max(8, Math.round((value / max) * 100))
          return `
            <div>
              <div class="mb-1 flex justify-between gap-3 text-[11px]">
                <span class="text-on-surface-variant">${escapeHtml(labels[index] || `Item ${index + 1}`)}</span>
                <span class="font-bold text-on-surface">${escapeHtml(value)}${escapeHtml(el.chart_data?.unit || '')}</span>
              </div>
              <div class="h-2.5 rounded-full bg-surface-container-high">
                <div class="h-full rounded-full" style="width:${width}%;background:${accent}"></div>
              </div>
            </div>
          `
        }).join('')}
      </div>
      ${el.text ? `<p class="mt-3 text-xs leading-relaxed text-on-surface-variant">${escapeHtml(el.text)}</p>` : ''}
      ${el.source ? `<p class="mt-2 text-[11px] font-mono text-outline">Source: ${escapeHtml(el.source)}</p>` : ''}
    </div>
  `
}

function renderInfographicProcess(el: InfographicElement, primary: string) {
  const steps = el.steps || []
  if (!steps.length) return ''
  return `
    <div class="rounded-lg border border-outline-variant bg-white p-3 md:col-span-2">
      <h3 class="mb-3 text-sm font-bold text-on-surface">${escapeHtml(el.title || 'Process flow')}</h3>
      <div class="grid gap-2" style="grid-template-columns:repeat(${Math.min(Math.max(steps.length, 2), 6)},minmax(0,1fr))">
        ${steps.map((step, index) => `
          <div class="rounded-lg bg-surface-container-low p-3 text-center">
            <div class="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style="background:${primary}">${index + 1}</div>
            <p class="text-xs font-semibold text-on-surface">${escapeHtml(step)}</p>
          </div>
        `).join('')}
      </div>
      ${el.source ? `<p class="mt-2 text-[11px] font-mono text-outline">Source: ${escapeHtml(el.source)}</p>` : ''}
    </div>
  `
}

function renderInfographicTimeline(el: InfographicElement, accent: string) {
  const items = el.timeline || []
  if (!items.length) return ''
  return `
    <div class="rounded-lg border border-outline-variant bg-white p-3 md:col-span-2">
      <h3 class="mb-3 text-sm font-bold text-on-surface">${escapeHtml(el.title || 'Timeline')}</h3>
      <div class="space-y-3">
        ${items.map((item) => `
          <div class="grid grid-cols-[92px_1fr] gap-3">
            <span class="text-[11px] font-bold" style="color:${accent}">${escapeHtml(item.date || 'Phase')}</span>
            <div class="border-l pl-3" style="border-color:${accent}">
              <p class="text-sm font-semibold text-on-surface">${escapeHtml(item.label)}</p>
              ${item.description ? `<p class="text-xs text-on-surface-variant">${escapeHtml(item.description)}</p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      ${el.source ? `<p class="mt-2 text-[11px] font-mono text-outline">Source: ${escapeHtml(el.source)}</p>` : ''}
    </div>
  `
}

function renderInfographicNodeMap(el: InfographicElement, primary: string, mode: 'mind' | 'hierarchy') {
  const nodes = el.nodes || []
  if (!nodes.length) return ''
  return `
    <div class="rounded-lg border border-outline-variant bg-white p-3 md:col-span-2">
      <h3 class="mb-3 text-sm font-bold text-on-surface">${escapeHtml(el.title || (mode === 'mind' ? 'Mind map' : 'Hierarchy'))}</h3>
      <div class="grid gap-3 md:grid-cols-${mode === 'mind' ? '3' : '2'}">
        ${nodes.map((node) => `
          <div class="rounded-lg bg-surface-container-low p-3">
            <p class="text-sm font-bold" style="color:${primary}">${escapeHtml(node.label)}</p>
            ${(node.children || []).length ? `
              <ul class="mt-2 space-y-1">
                ${(node.children || []).map((child) => `<li class="text-xs text-on-surface-variant">- ${escapeHtml(child)}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `).join('')}
      </div>
      ${el.source ? `<p class="mt-2 text-[11px] font-mono text-outline">Source: ${escapeHtml(el.source)}</p>` : ''}
    </div>
  `
}


function renderInfographicHeroVisual(doc: InfographicDocument, imageEl: InfographicElement | undefined, primary: string, accent: string) {
  if (imageEl?.imageUrl) {
    return `
      <figure class="overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-lg">
        <img src="${escapeHtml(imageEl.imageUrl)}" alt="${escapeHtml(imageEl.title || doc.title || 'Infographic visual')}" class="h-[360px] w-full object-cover" loading="eager" referrerpolicy="no-referrer" />
        ${(imageEl.title || imageEl.text || imageEl.source) ? `
          <figcaption class="px-4 py-3 text-xs text-on-surface-variant">
            ${imageEl.title ? `<p class="font-bold text-on-surface">${escapeHtml(imageEl.title)}</p>` : ''}
            ${imageEl.text ? `<p class="mt-1">${escapeHtml(imageEl.text)}</p>` : ''}
            ${imageEl.source ? `<p class="mt-1 font-mono text-outline">Source: ${escapeHtml(imageEl.source)}</p>` : ''}
          </figcaption>
        ` : ''}
      </figure>
    `
  }

  return `
    <div class="relative min-h-[360px] overflow-hidden rounded-[28px] border border-white/70 p-6 text-white shadow-lg" style="background:radial-gradient(circle at 22% 20%, rgba(255,255,255,.32), transparent 24%), radial-gradient(circle at 78% 78%, rgba(255,255,255,.20), transparent 28%), linear-gradient(135deg, ${primary}, ${accent})">
      <div class="absolute -left-12 bottom-8 h-44 w-44 rounded-full bg-white/10"></div>
      <div class="absolute right-8 top-10 h-28 w-28 rounded-full bg-white/15"></div>
      <div class="absolute inset-x-10 bottom-14 h-24 rounded-[60%] bg-white/12"></div>
      <div class="relative flex min-h-[312px] flex-col items-center justify-center text-center">
        <div class="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-white/18 text-5xl shadow-inner">*</div>
        <p class="text-[11px] font-bold uppercase tracking-[0.26em] text-white/75">Central Visual</p>
        <h3 class="mt-3 max-w-md text-3xl font-black leading-tight">${escapeHtml(doc.title)}</h3>
        <p class="mt-3 max-w-sm text-sm leading-relaxed text-white/80">Use Unsplash Image in the editor to attach a live photo, or keep this generated visual panel for a clean infographic layout.</p>
      </div>
    </div>
  `
}

function renderInfographicConceptCard(el: InfographicElement, primary: string, accent: string) {
  return `
    <div class="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
      <div class="mb-2 flex items-center gap-3">
        <span class="flex h-10 w-10 items-center justify-center rounded-xl text-xl font-black text-white" style="background:linear-gradient(135deg, ${primary}, ${accent})">${escapeHtml(el.icon || '*')}</span>
        <h3 class="text-sm font-black uppercase tracking-wide text-on-surface">${escapeHtml(el.title || 'Key concept')}</h3>
      </div>
      <p class="text-sm leading-relaxed text-on-surface-variant">${escapeHtml(el.text || '')}</p>
      ${el.source ? `<p class="mt-2 text-[11px] font-mono text-outline">Source: ${escapeHtml(el.source)}</p>` : ''}
    </div>
  `
}

export function renderInfographicHtml(doc: InfographicDocument): string {
  const sorted = [...doc.elements].sort((a, b) => a.y - b.y)
  const byType = (type: InfographicElementType) => sorted.filter((el) => el.type === type)
  const theme = doc.color_theme || {}
  const primary = safeInfographicColor(theme.primary, '#0f172a')
  const accent = safeInfographicColor(theme.accent, '#2563eb')
  const background = safeInfographicColor(doc.background || theme.background, '#f8fafc')
  const heroImage = sorted.find((el) => el.type === 'image' && el.imageUrl)
  const stats = byType('stat')
  const concepts = byType('icon_card')
  const charts = byType('chart')
  const fullWidth = sorted.filter((el) => ['process_flow', 'timeline', 'mind_map', 'hierarchy'].includes(el.type))
  const sections = byType('section')

  return DOMPurify.sanitize(`
    <section class="overflow-hidden rounded-[28px] border border-outline-variant shadow-sm" style="background:${background}">
      <div class="h-2" style="background:linear-gradient(90deg, ${primary}, ${accent})"></div>
      <div class="p-6 md:p-8">
        <div class="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div class="max-w-3xl">
            <p class="text-[11px] font-bold uppercase tracking-[0.22em] text-outline">Infographic Studio</p>
            <h2 class="mt-2 text-4xl font-black leading-tight text-on-surface">${escapeHtml(doc.title)}</h2>
            <p class="mt-2 text-sm leading-relaxed text-on-surface-variant">${escapeHtml(doc.subtitle)}</p>
          </div>
          <div class="flex flex-wrap gap-2 text-[11px]">
            ${doc.template ? `<span class="rounded-full bg-white/90 px-2.5 py-1 font-semibold text-on-surface-variant">Template: ${escapeHtml(doc.template)}</span>` : ''}
            ${theme.name ? `<span class="rounded-full bg-white/90 px-2.5 py-1 font-semibold text-on-surface-variant">Theme: ${escapeHtml(theme.name)}</span>` : ''}
            <span class="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 font-semibold text-on-surface-variant">
              <span class="h-2.5 w-2.5 rounded-full" style="background:${primary}"></span>
              <span class="h-2.5 w-2.5 rounded-full" style="background:${accent}"></span>
              Palette
            </span>
          </div>
        </div>

        <div class="grid gap-5 lg:grid-cols-[1fr_1.25fr_1fr]">
          <div class="space-y-4">
            <div class="border-b pb-2" style="border-color:${accent}">
              <h3 class="text-sm font-black uppercase tracking-wide text-on-surface">Core Signals</h3>
            </div>
            ${stats.slice(0, 3).map((el) => `<div class="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm"><p class="text-xl font-black leading-tight" style="color:${primary}">${escapeHtml(el.title || el.text || 'Key statistic')}</p>${el.title && el.text ? `<p class="mt-2 text-sm leading-relaxed text-on-surface-variant">${escapeHtml(el.text)}</p>` : ''}</div>`).join('')}
            ${concepts.slice(0, 3).map((el) => renderInfographicConceptCard(el, primary, accent)).join('')}
          </div>

          <div class="space-y-4">
            ${renderInfographicHeroVisual(doc, heroImage, primary, accent)}
            ${sections.slice(0, 2).map((el) => `<div class="rounded-2xl border border-white/70 bg-white/80 p-4 text-sm leading-relaxed text-on-surface shadow-sm">${escapeHtml(el.text || el.title || '')}</div>`).join('')}
          </div>

          <div class="space-y-4">
            <div class="border-b pb-2" style="border-color:${primary}">
              <h3 class="text-sm font-black uppercase tracking-wide text-on-surface">Data & Structure</h3>
            </div>
            ${charts.slice(0, 3).map((el) => renderInfographicChart(el, accent)).join('')}
            ${concepts.slice(3, 6).map((el) => renderInfographicConceptCard(el, primary, accent)).join('')}
            ${stats.slice(3, 6).map((el) => `<div class="rounded-2xl border border-white/70 bg-white/90 p-4 text-sm font-bold shadow-sm" style="color:${primary}">${escapeHtml(el.text || el.title || '')}</div>`).join('')}
          </div>
        </div>

        <div class="mt-5 grid gap-4">
          ${fullWidth.map((el) => {
            if (el.type === 'process_flow') return renderInfographicProcess(el, primary)
            if (el.type === 'timeline') return renderInfographicTimeline(el, accent)
            if (el.type === 'mind_map') return renderInfographicNodeMap(el, primary, 'mind')
            if (el.type === 'hierarchy') return renderInfographicNodeMap(el, primary, 'hierarchy')
            return ''
          }).join('')}
        </div>

        <div class="mt-5 rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
          <p class="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Key Takeaways</p>
          <div class="space-y-2">
            ${byType('takeaway').map((el) => `<p class="flex gap-2 text-sm text-on-surface-variant"><span style="color:${accent}">&bull;</span><span>${escapeHtml(el.text || '')}</span></p>`).join('')}
            ${(doc.takeaways || []).map((takeaway) => `<p class="flex gap-2 text-sm text-on-surface-variant"><span style="color:${accent}">&bull;</span><span>${escapeHtml(takeaway)}</span></p>`).join('')}
          </div>
        </div>
      </div>
    </section>
  `)
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
  if (toolType === 'infographic_content') {
    const infographicDoc = normalizeInfographicContent(parsed)
    if (infographicDoc) return renderInfographicHtml(infographicDoc)
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

