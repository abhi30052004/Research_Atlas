import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import TopNav from '../../components/navigation/TopNav'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { fetchSources, uploadSource, uploadSourcesBatch, addUrlSource, deleteSource, generateArtifact, fetchArtifacts, deleteArtifact, fetchChats, fetchChat, createChat, type Source, type Artifact, type ProgressStage } from '../../api/workspace'
import { API_BASE_URL } from '../../api/config'

import {
  Upload,
  Link as LinkIcon,
  Trash2,
  Send,
  Copy,
  ThumbsUp,
  RefreshCw,
  Paperclip,
  FileText,
  ChevronRight,
  ChevronDown,
  X,
  BarChart3,
  Brain,
  Presentation,
  Table,
  GitCompare,
  BookOpen,
  HelpCircle,
  Newspaper,
  ClipboardList,
  Layers,
  Volume2,
  Sparkles,
  Edit3,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Redo,
  Undo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Zap,
  Download,
  Check,
  Clock,
} from 'lucide-react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
  citations?: Citation[]
}

interface Citation {
  source_name?: string
  sourceName?: string
  filename?: string
  source_id?: string
  sourceId?: string
  page_number?: number
  page?: number
}

type StudioTool = typeof STUDIO_TOOLS[number]

function parseStreamData(line: string) {
  let dataStr = line.trim()
  while (dataStr.startsWith('data:')) {
    dataStr = dataStr.slice(5).trim()
  }
  return dataStr ? JSON.parse(dataStr) : null
}

const STUDIO_TOOLS = [
  { category: "Knowledge", icon: <FileText className="w-4 h-4" />, label: "Summary", type: "summary" },
  { category: "Knowledge", icon: <Newspaper className="w-4 h-4" />, label: "Research Report", type: "research_report" },
  { category: "Knowledge", icon: <BookOpen className="w-4 h-4" />, label: "Blog Outline", type: "blog_outline" },
  { category: "Knowledge", icon: <HelpCircle className="w-4 h-4" />, label: "FAQ", type: "faq" },
  { category: "Analysis", icon: <GitCompare className="w-4 h-4" />, label: "Comparison Report", type: "comparison_report" },
  { category: "Analysis", icon: <Table className="w-4 h-4" />, label: "Data Tables", type: "data_table" },
  { category: "Analysis", icon: <ClipboardList className="w-4 h-4" />, label: "SOP", type: "sop" },
  { category: "Learning", icon: <Brain className="w-4 h-4" />, label: "Flashcards", type: "flashcards" },
  { category: "Learning", icon: <Sparkles className="w-4 h-4" />, label: "Quiz", type: "quiz" },
  { category: "Learning", icon: <Layers className="w-4 h-4" />, label: "Mind Map", type: "mind_map" },
  { category: "Presentation", icon: <Presentation className="w-4 h-4" />, label: "Slide Deck", type: "slide_deck" },
  { category: "Presentation", icon: <BarChart3 className="w-4 h-4" />, label: "Infographic Content", type: "infographic_content" },
  { category: "Presentation", icon: <Volume2 className="w-4 h-4" />, label: "Audio Overview", type: "audio_overview_script" },
]

const SUGGESTED = ['"Summarize ESG goals"', '"Identify key risks"', '"Compare with Q3"']
const SOURCE_REFRESH_FAST_MS = 2000
const SOURCE_REFRESH_SLOW_MS = 5000
const SOURCE_REFRESH_BACKOFF_AFTER_MS = 15000
const SOURCE_REFRESH_AFTER_UPLOAD_MS = 1500
const MAX_POLL_DURATION_MS = 5 * 60 * 1000 // 5 minutes

const PROGRESS_STAGE_LABELS: Record<string, string> = {
  extracting: 'Extracting text…',
  chunking: 'Chunking…',
  storing_chunks: 'Storing chunks…',
  embedding: 'Generating embeddings…',
  indexing: 'Indexing vectors…',
  completed: 'Ready',
  failed: 'Failed',
  embedding_failed: 'Ready (indexing failed)',
}

function progressStageLabel(stage?: string): string {
  return stage ? (PROGRESS_STAGE_LABELS[stage] || stage) : 'Processing…'
}


function TypeBadge({ type }: { type: Source['type'] }) {
  const colors: Record<Source['type'], string> = {
    PDF: 'text-red-600 bg-red-50',
    WEB: 'text-blue-600 bg-blue-50',
    DOCX: 'text-indigo-600 bg-indigo-50',
    TXT: 'text-zinc-600 bg-zinc-50',
    CSV: 'text-emerald-600 bg-emerald-50',
    XLSX: 'text-green-600 bg-green-50',
    PPTX: 'text-orange-600 bg-orange-50',
  }
  return <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${colors[type]}`}>{type}</span>
}

function mapSourceType(value: unknown): Source['type'] {
  const normalized = String(value || 'PDF').toUpperCase()
  if (normalized === 'URL' || normalized === 'WEB') return 'WEB'
  if (['PDF', 'DOCX', 'TXT', 'CSV', 'XLSX', 'PPTX'].includes(normalized)) {
    return normalized as Source['type']
  }
  return 'TXT'
}

function mapSourceStatus(value: unknown): Source['status'] {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'completed' || normalized === 'processed') return 'processed'
  if (normalized === 'failed' || normalized === 'error') return 'failed'
  if (normalized === 'pending') return 'pending'
  return 'processing'
}

function mapApiSource(source: any, workspaceId: string): Source {
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

function displayNameFromUrl(rawUrl: string): string {
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

function getTool(value: string): StudioTool | undefined {
  return STUDIO_TOOLS.find(t => t.label === value || t.type === value)
}

function sourceCitationLabel(num: string, name: string | undefined, citations: Citation[] = [], sources: Source[] = []) {
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

function convertSourceCitations(html: string, citations: Citation[] = [], sources: Source[] = []): string {
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

function renderMessageContent(content: string, isUser?: boolean, citations: Citation[] = [], sources: Source[] = []) {
  if (isUser) {
    return <div className="whitespace-pre-wrap">{content}</div>
  }
  const html = DOMPurify.sanitize(marked.parse(convertSourceCitations(content, citations, sources)) as string)
  return <div className="prose-atlas max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}

/* ---------- Tool icon lookup for artifact cards ---------- */
function getToolIcon(label: string) {
  const found = getTool(label)
  return found ? found.icon : <FileText className="w-4 h-4" />
}

function formatToolName(value: string) {
  return getTool(value)?.label || value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function parseMaybeJson(content: unknown) {
  if (typeof content !== 'string') return content
  const trimmed = content.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return content
  try {
    return JSON.parse(trimmed)
  } catch {
    return content
  }
}

function renderSlideDeckHtml(slides: any[]) {
  return `
    <div class="space-y-4">
      ${slides.map((slide, index) => `
        <section class="rounded-xl border border-outline-variant bg-white overflow-hidden shadow-sm">
          <div class="flex items-start gap-4 bg-violet-50 px-5 py-4 border-b border-violet-100">
            <div class="w-11 h-11 rounded-lg bg-violet-600 text-white flex items-center justify-center font-bold text-sm">${escapeHtml(slide.slide_number || index + 1)}</div>
            <div class="flex-1 min-w-0">
              <p class="text-[11px] font-semibold uppercase text-violet-700">${escapeHtml(slide.slide_type || 'slide')}</p>
              <h3 class="text-lg font-bold text-on-surface mt-1">${escapeHtml(slide.title || `Slide ${index + 1}`)}</h3>
            </div>
          </div>
          <div class="grid gap-5 md:grid-cols-[1fr_1.1fr] p-5">
            <div>
              <p class="text-xs font-semibold text-on-surface mb-2">Slide Content</p>
              <ul class="space-y-2">
                ${(slide.bullets || []).map((bullet: string) => `<li class="flex gap-2 text-sm text-on-surface-variant"><span class="mt-2 w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0"></span><span>${escapeHtml(bullet)}</span></li>`).join('')}
              </ul>
            </div>
            <div class="rounded-lg bg-surface-container-low p-4">
              <p class="text-xs font-semibold text-on-surface mb-2">Speaker Notes</p>
              <p class="text-sm leading-relaxed text-on-surface-variant">${escapeHtml(slide.speaker_notes || '')}</p>
              ${slide.source_reference ? `<p class="mt-3 text-[11px] font-mono text-outline">Source: ${escapeHtml(slide.source_reference)}</p>` : ''}
            </div>
          </div>
        </section>
      `).join('')}
    </div>
  `
}

function renderFlashcardsHtml(cards: any[]) {
  return `
    <div class="flashcard-grid">
      ${cards.map((card, index) => `
        <section class="flashcard-item">
          <input class="flashcard-toggle" type="checkbox" id="flashcard-${index}" />
          <label class="flashcard-shell" for="flashcard-${index}">
            <div class="flashcard-inner">
              <div class="flashcard-face flashcard-front">
                <div class="flex items-center justify-between gap-3 mb-4">
                  <span class="text-[11px] font-bold uppercase text-amber-700">Card ${escapeHtml(card.id || index + 1)}</span>
                  <span class="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-700 border border-amber-200">${escapeHtml(card.category || 'Study')}</span>
                </div>
                <p class="text-xs font-semibold text-outline mb-2">Front</p>
                <h3 class="text-base font-bold text-on-surface leading-snug">${escapeHtml(card.front || '')}</h3>
                ${card.source ? `<p class="mt-auto pt-4 text-[11px] font-mono text-outline">Source: ${escapeHtml(card.source)}</p>` : ''}
              </div>
              <div class="flashcard-face flashcard-back">
                <div class="flex items-center justify-between gap-3 mb-4">
                  <span class="text-[11px] font-bold uppercase text-amber-700">Card ${escapeHtml(card.id || index + 1)}</span>
                  <span class="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 border border-amber-200">${escapeHtml(card.card_type || 'answer')}</span>
                </div>
                <p class="text-xs font-semibold text-outline mb-2">Back</p>
                <p class="text-sm leading-relaxed text-on-surface-variant">${escapeHtml(card.back || '')}</p>
                ${card.source ? `<p class="mt-auto pt-4 text-[11px] font-mono text-outline">Source: ${escapeHtml(card.source)}</p>` : ''}
              </div>
            </div>
          </label>
        </section>
      `).join('')}
    </div>
  `
}

function renderQuizHtml(questions: any[]) {
  return `
    <div class="space-y-4">
      ${questions.map((question, index) => {
        const correct = question.correct_answer
        const options = question.options || {}
        return `
          <section class="rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
            <div class="flex flex-wrap items-center gap-2 mb-4">
              <span class="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">${escapeHtml(question.id || index + 1)}</span>
              <span class="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">${escapeHtml(question.difficulty || 'medium')}</span>
            </div>
            <h3 class="text-base font-bold text-on-surface mb-4">${escapeHtml(question.question || '')}</h3>
            <div class="grid gap-2 md:grid-cols-2">
              ${Object.entries(options).map(([key, value]) => `
                <div class="rounded-lg border px-3 py-2.5 text-sm ${key === correct ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-outline-variant bg-surface-container-low text-on-surface-variant'}">
                  <span class="font-bold mr-2">${escapeHtml(key)}.</span>${escapeHtml(value)}
                </div>
              `).join('')}
            </div>
            <div class="mt-4 rounded-lg bg-surface-container-low p-4">
              <p class="text-xs font-semibold text-on-surface mb-1">Answer: ${escapeHtml(correct)}</p>
              <p class="text-sm leading-relaxed text-on-surface-variant">${escapeHtml(question.explanation || '')}</p>
              ${question.source ? `<p class="mt-2 text-[11px] font-mono text-outline">Source: ${escapeHtml(question.source)}</p>` : ''}
            </div>
          </section>
        `
      }).join('')}
    </div>
  `
}

function renderDataTableHtml(rows: any[]) {
  const columns = ['metric', 'value', 'unit', 'context', 'source']
  const hasRows = rows.length > 0
  return `
    <div class="overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-outline-variant text-sm">
          <thead class="bg-surface-container-low">
            <tr>
              ${columns.map((column) => `
                <th class="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-on-surface">
                  ${escapeHtml(column.replace(/_/g, ' '))}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant bg-white">
            ${hasRows ? rows.map((row) => `
              <tr class="align-top hover:bg-surface-container-lowest">
                <td class="px-4 py-3 font-semibold text-on-surface">${escapeHtml(row.metric || '')}</td>
                <td class="px-4 py-3 text-on-surface-variant">${escapeHtml(row.value || '')}</td>
                <td class="px-4 py-3 text-on-surface-variant">${escapeHtml(row.unit || '')}</td>
                <td class="px-4 py-3 min-w-[260px] text-on-surface-variant">${escapeHtml(row.context || '')}</td>
                <td class="px-4 py-3 whitespace-nowrap">${row.source ? `<span class="source-cite">${escapeHtml(row.source)}</span>` : ''}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="${columns.length}" class="px-4 py-6 text-center text-sm text-on-surface-variant">
                  No table rows were generated from the selected sources.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderMindMapHtml(map: any) {
  const branches = Array.isArray(map?.branches) ? map.branches : []
  return `
    <div class="space-y-5">
      <div class="rounded-xl border border-outline-variant bg-surface-container-low px-5 py-4">
        <p class="text-[11px] font-bold uppercase tracking-wide text-outline">Central Topic</p>
        <h2 class="mt-1 text-xl font-bold text-on-surface">${escapeHtml(map?.topic || 'Mind Map')}</h2>
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        ${branches.map((branch: any, branchIndex: number) => {
          const color = /^#[0-9a-f]{6}$/i.test(String(branch.color || '')) ? branch.color : '#4F46E5'
          const children = Array.isArray(branch.children) ? branch.children : []
          return `
            <section class="rounded-xl border border-outline-variant bg-white p-4 shadow-sm">
              <div class="mb-4 flex items-center gap-3">
                <span class="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white" style="background:${escapeHtml(color)}">${branchIndex + 1}</span>
                <h3 class="text-base font-bold text-on-surface">${escapeHtml(branch.name || `Branch ${branchIndex + 1}`)}</h3>
              </div>
              <div class="space-y-3">
                ${children.map((child: any) => {
                  const grandchildren = Array.isArray(child.children) ? child.children : []
                  return `
                    <div class="rounded-lg bg-surface-container-low p-3">
                      <p class="text-sm font-semibold text-on-surface">${escapeHtml(child.name || '')}</p>
                      ${grandchildren.length ? `
                        <ul class="mt-2 space-y-1.5">
                          ${grandchildren.map((item: any) => `
                            <li class="flex gap-2 text-sm text-on-surface-variant">
                              <span class="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" style="background:${escapeHtml(color)}"></span>
                              <span>${escapeHtml(item.name || '')}</span>
                            </li>
                          `).join('')}
                        </ul>
                      ` : ''}
                    </div>
                  `
                }).join('')}
              </div>
            </section>
          `
        }).join('')}
      </div>
    </div>
  `
}

function normalizeArtifactContent(tool: string, content: unknown) {
  const parsed = parseMaybeJson(content)
  const toolType = getTool(tool)?.type || tool

  if (Array.isArray(parsed) && toolType === 'data_table') {
    return DOMPurify.sanitize(renderDataTableHtml(parsed))
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && toolType === 'mind_map') {
    return DOMPurify.sanitize(renderMindMapHtml(parsed))
  }
  if (Array.isArray(parsed) && toolType === 'slide_deck') {
    return DOMPurify.sanitize(renderSlideDeckHtml(parsed))
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

export default function WorkspacePage() {
  const { id: workspaceId } = useParams<{ id: string }>()
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const [activeTab, setActiveTab] = useState<'chat' | 'output' | 'editor'>('chat')

  const [sources, setSources] = useState<Source[]>([])
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [hasCustomSourceSelection, setHasCustomSourceSelection] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)

  // Loading states
  const [isLoadingWorkspace, setIsLoading] = useState(true)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [isGeneratingArtifact, setIsGeneratingArtifact] = useState(false)

  // Studio Output — list of generated artifacts
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [expandedArtifact, setExpandedArtifact] = useState<string | null>(null)

  // Editable — rich editor state
  const [editingArtifact, setEditingArtifact] = useState<Artifact | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  // Chat — copy & like feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<string[]>([])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    if (!workspaceId) return
    setActiveWorkspace(workspaceId)
    const loadData = async () => {
      setIsLoading(true)
      try {
        const [fetchedSources, fetchedArtifacts, fetchedChats] = await Promise.all([
          fetchSources(workspaceId),
          fetchArtifacts(workspaceId),
          fetchChats(workspaceId)
        ])
        setSources((fetchedSources || []).map((s: any) => ({
          id: s.id || s._id,
          type: mapSourceType(s.source_type || s.type),
          name: s.original_name || s.filename || s.name || 'Untitled',
          meta: s.meta || `${s.file_size ? (s.file_size / 1024).toFixed(0) + ' KB' : ''} • ${new Date(s.created_at || s.createdAt || new Date()).toLocaleDateString()}`,
          status: mapSourceStatus(s.status),
          workspace_id: workspaceId,
          chunkCount: s.chunk_count || s.chunkCount || 0,
          errorMessage: s.error_message || s.errorMessage
        })))
        setArtifacts((fetchedArtifacts || []).map((a: any) => {
          const tool = a.artifact_type || a.tool
          return {
            ...a,
            id: a.id || a._id,
            tool,
            title: a.title || formatToolName(tool),
            createdAt: new Date(a.created_at || a.createdAt || new Date()),
            sourceCount: a.source_ids?.length || a.sourceCount || 0,
            content: normalizeArtifactContent(tool, a.content)
          }
        }))

        if (fetchedChats && fetchedChats.length > 0) {
          setCurrentChatId(fetchedChats[0].id)
          // Also fetch the full chat messages
          const fullChat = await fetchChat(fetchedChats[0].id)
          setMessages((fullChat.messages || []).map((m: any) => ({
            ...m,
            role: m.role === 'assistant' ? 'ai' : m.role
          })))
        } else {
          // No chat exists, create one
          const newChat = await createChat(workspaceId)
          setCurrentChatId(newChat.id)
          setMessages([])
        }
      } catch (err) {
        console.error('Failed to load workspace data', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [workspaceId, setActiveWorkspace])

  /* ---- UI Store ---- */
  const { addToast, addNotification, recordAICall, aiCalls, aiDailyLimit } = useUIStore()

  // Compute today's call count dynamically
  const todayCount = aiCalls.filter((c) => {
    const d = new Date(c.timestamp)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  }).length

  const readySources = useMemo(() => sources.filter((s) => s.status === 'processed'), [sources])
  const selectedReadySources = useMemo(
    () => readySources.filter((s) => selectedSourceIds.includes(s.id)),
    [readySources, selectedSourceIds]
  )
  const selectedReadySourceIds = useMemo(
    () => selectedReadySources.map((s) => s.id),
    [selectedReadySources]
  )
  const hasProcessingSources = sources.some((s) => s.status === 'pending' || s.status === 'processing')
  const hasFailedSources = sources.some((s) => s.status === 'failed')
  const selectedStudioTool = selectedTool ? getTool(selectedTool) : undefined
  const isComparisonReportSelected = selectedStudioTool?.type === 'comparison_report'
  const hasSelectedReadySource = selectedReadySources.length > 0
  const canChat = hasSelectedReadySource && !isTyping
  const canGenerate = hasSelectedReadySource && (!isComparisonReportSelected || selectedReadySources.length >= 2) && !isGeneratingArtifact
  const generateHint = isGeneratingArtifact
    ? `Generating ${selectedTool}...`
    : sources.length === 0
      ? 'Add at least one source first.'
      : readySources.length === 0
        ? hasProcessingSources
          ? 'Wait until source processing finishes.'
          : hasFailedSources
            ? 'Delete or re-upload failed sources.'
            : 'No processed sources are ready yet.'
        : selectedReadySources.length === 0
          ? 'Select at least one ready source.'
          : isComparisonReportSelected && selectedReadySources.length < 2
            ? 'Select at least two ready sources for a comparison report.'
          : null

  useEffect(() => {
    const readyIds = readySources.map((source) => source.id)
    setSelectedSourceIds((previous) => {
      if (!hasCustomSourceSelection) return readyIds
      const readyIdSet = new Set(readyIds)
      return previous.filter((id) => readyIdSet.has(id))
    })
  }, [readySources, hasCustomSourceSelection])

  const toggleSourceSelection = useCallback((sourceId: string, checked: boolean) => {
    setHasCustomSourceSelection(true)
    setSelectedSourceIds((previous) => (
      checked
        ? Array.from(new Set([...previous, sourceId]))
        : previous.filter((id) => id !== sourceId)
    ))
  }, [])

  const selectAllReadySources = useCallback(() => {
    setHasCustomSourceSelection(true)
    setSelectedSourceIds(readySources.map((source) => source.id))
  }, [readySources])

  const clearSelectedSources = useCallback(() => {
    setHasCustomSourceSelection(true)
    setSelectedSourceIds([])
  }, [])

  const refreshSources = useCallback(async () => {
    if (!workspaceId) return
    try {
      const fetchedSources = await fetchSources(workspaceId)
      setSources((fetchedSources || []).map((s: any) => mapApiSource(s, workspaceId)))
    } catch (err: any) {
      // If 401 and auto-refresh also failed, stop polling silently
      if (err?.response?.status === 401) {
        console.warn('Source polling stopped: authentication expired')
        return
      }
      console.error('Failed to refresh sources', err)
    }
  }, [workspaceId])

  // Adaptive polling: fast right after upload, slows down over time, caps at MAX_POLL_DURATION_MS
  const processingStartRef = useRef<number | null>(null)
  useEffect(() => {
    if (!workspaceId || !hasProcessingSources) {
      processingStartRef.current = null
      return
    }
    if (processingStartRef.current === null) {
      processingStartRef.current = Date.now()
    }
    let timerId: number
    const tick = () => {
      const elapsed = Date.now() - (processingStartRef.current || Date.now())
      // Stop polling after MAX_POLL_DURATION_MS to prevent zombie loops
      if (elapsed > MAX_POLL_DURATION_MS) {
        console.warn('Source polling capped at 5 minutes — stopping')
        processingStartRef.current = null
        return
      }
      refreshSources()
      const delay = elapsed < SOURCE_REFRESH_BACKOFF_AFTER_MS
        ? SOURCE_REFRESH_FAST_MS
        : SOURCE_REFRESH_SLOW_MS
      timerId = window.setTimeout(tick, delay)
    }
    timerId = window.setTimeout(tick, SOURCE_REFRESH_FAST_MS)
    return () => window.clearTimeout(timerId)
  }, [workspaceId, hasProcessingSources, refreshSources])

  /* ---- Chat ---- */
  const sendMessage = async (text?: string) => {
    const content = text || input.trim()
    if (!content || !currentChatId) return

    if (sources.length === 0) {
      addToast('Add at least one source before asking Atlas.', 'warning')
      return
    }

    if (selectedReadySourceIds.length === 0) {
      addToast('Select at least one ready source before asking Atlas.', 'warning')
      return
    }

    // Check AI limit before sending
    if (todayCount >= aiDailyLimit) {
      addToast(`Daily AI limit reached (${aiDailyLimit}/${aiDailyLimit}). Increase your limit in Settings → AI Limits.`, 'warning')
      return
    }

    setInput('')
    const tempMsgId = Date.now().toString()
    const userMsg: Message = { id: tempMsgId, role: 'user', content }
    setMessages((m) => [...m, userMsg])
    setIsTyping(true)

    // Record AI call
    recordAICall('Chat')

    // Check if this was the last allowed call
    if (todayCount + 1 >= aiDailyLimit) {
      addToast(`You've reached your daily AI limit (${aiDailyLimit} calls). Increase it in Settings → AI Limits.`, 'warning')
    }

    try {
      const response = await fetch(`${API_BASE_URL}/chat/${currentChatId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${useAuthStore.getState().token}`
        },
        body: JSON.stringify({ content, model: 'gpt-4o', source_ids: selectedReadySourceIds })
      })

      if (!response.ok) throw new Error('Failed to send message')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let aiContent = ''
      let buffer = ''
      const aiMsgId = (Date.now() + 1).toString()

      setMessages((m) => [...m, { id: aiMsgId, role: 'ai', content: '' }])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = parseStreamData(line)
                if (parsed?.type === 'token' && parsed.content) {
                  aiContent += parsed.content
                  setMessages((m) => m.map(msg => msg.id === aiMsgId ? { ...msg, content: aiContent } : msg))
                } else if (parsed?.type === 'done') {
                  setMessages((m) => m.map(msg => msg.id === aiMsgId ? {
                    ...msg,
                    id: parsed.message_id || msg.id,
                    citations: parsed.citations || [],
                  } : msg))
                } else if (parsed?.type === 'error') {
                  addToast(parsed.content || 'Failed to send message', 'error')
                }
              } catch (e) {
                console.error('JSON parse error during stream:', e, line)
              }
            }
          }
        }
      }

      setIsTyping(false)
      addNotification({
        icon: 'chat',
        title: 'Chat response ready',
        description: `AI responded to: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`,
      })
    } catch (err) {
      setIsTyping(false)
      addToast('Failed to send message', 'error')
    }
  }

  /* ---- Copy & Like message ---- */
  const copyMessage = (msg: Message) => {
    // Strip markdown-style bold markers for plain text copy
    const plain = msg.content.replace(/\*\*([^*]+)\*\*/g, '$1')
    navigator.clipboard.writeText(plain)
    setCopiedId(msg.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const likeMessage = (msgId: string) => {
    setLikedIds((prev) => {
      if (prev.includes(msgId)) {
        return prev.filter((id) => id !== msgId)
      } else {
        addToast('Feedback submitted', 'success')
        return [...prev, msgId]
      }
    })
  }

  /* ---- Regenerate last AI message ---- */
  const regenerateMessage = async (msgId: string) => {
    if (!currentChatId) return

    if (sources.length > 0 && selectedReadySourceIds.length === 0) {
      addToast('Select at least one ready source before regenerating.', 'warning')
      return
    }

    // Check AI limit before regenerating
    if (todayCount >= aiDailyLimit) {
      addToast(`Daily AI limit reached (${aiDailyLimit}/${aiDailyLimit}). Increase your limit in Settings → AI Limits.`, 'warning')
      return
    }

    const idx = messages.findIndex((m) => m.id === msgId)
    if (idx < 0) return
    setIsTyping(true)

    // Record AI call
    recordAICall('Regenerate')
    if (todayCount + 1 >= aiDailyLimit) {
      addToast(`You've reached your daily AI limit (${aiDailyLimit} calls). Increase it in Settings → AI Limits.`, 'warning')
    }

    try {
      const response = await fetch(`${API_BASE_URL}/chat/${currentChatId}/messages/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${useAuthStore.getState().token}`
        },
        body: JSON.stringify({ message_id: msgId, model: 'gpt-4o', source_ids: selectedReadySourceIds })
      })

      if (!response.ok) throw new Error('Failed to regenerate')

      const data = await response.json()
      const regenerated = data.message || data
      setMessages((prev) => prev.map((msg) => (
        msg.id === msgId
          ? {
            ...regenerated,
            role: regenerated.role === 'assistant' ? 'ai' : regenerated.role,
          }
          : msg
      )))
      setIsTyping(false)
    } catch (err) {
      setIsTyping(false)
      addToast('Failed to regenerate message', 'error')
    }
  }

  /* ---- Export helpers for Editable tab ---- */
  const exportAsPdf = () => {
    if (!editorRef.current || !editingArtifact) return
    const content = editorRef.current.innerHTML
    const title = editingArtifact.tool
    // Use browser print to PDF with a styled window
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>${title}</title>
      <style>
        body { font-family: 'Inter', 'Segoe UI', sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #191c1e; line-height: 1.6; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        h2 { font-size: 20px; margin-top: 24px; }
        h3 { font-size: 16px; margin-top: 20px; }
        ul, ol { padding-left: 24px; }
        li { margin-bottom: 4px; }
        p { margin-bottom: 12px; }
        .meta { color: #76777d; font-size: 12px; margin-bottom: 24px; }
      </style></head><body>
      <h1>${title}</h1>
      <div class="meta">Exported from Atlas • ${new Date().toLocaleDateString()}</div>
      ${content}
      </body></html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  const exportAsDocx = () => {
    if (!editorRef.current || !editingArtifact) return
    const content = editorRef.current.innerHTML
    const title = editingArtifact.tool
    // Create a proper .doc file using HTML-to-Word method
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${title}</title>
      <style>
        body { font-family: 'Calibri', sans-serif; color: #191c1e; line-height: 1.6; }
        h1 { font-size: 22pt; }
        h2 { font-size: 16pt; margin-top: 18pt; }
        h3 { font-size: 13pt; margin-top: 14pt; }
        ul, ol { padding-left: 20pt; }
        li { margin-bottom: 4pt; }
        p { margin-bottom: 8pt; }
      </style></head><body>
      <h1>${title}</h1>
      <p style="color:#76777d;font-size:10pt;">Exported from Atlas • ${new Date().toLocaleDateString()}</p>
      ${content}
      </body></html>
    `
    const blob = new Blob([html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /* ---- File / URL ---- */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0 || !workspaceId) return
    const files = Array.from(fileList)

    // Create optimistic temp sources for all files
    const tempSources: Source[] = files.map((file, i) => ({
      id: `temp_${Date.now()}_${i}`,
      type: mapSourceType(file.name.split('.').pop()?.toUpperCase() || 'TXT'),
      name: file.name,
      meta: `Uploading • ${(file.size / 1024).toFixed(0)} KB`,
      status: 'processing' as const,
      workspace_id: workspaceId,
      progressStage: 'extracting' as ProgressStage,
      progressPct: 0,
    }))
    setSources((s) => [...tempSources, ...s])
    const label = files.length === 1 ? `"${files[0].name}"` : `${files.length} files`
    addToast(`Uploading ${label}...`, 'info')

    try {
      let responseSources: any[]
      if (files.length === 1) {
        const single = await uploadSource(files[0], workspaceId)
        responseSources = [single]
      } else {
        responseSources = await uploadSourcesBatch(files, workspaceId)
      }

      // Replace temp sources with real ones
      setSources((prev) => {
        const tempIds = new Set(tempSources.map((t) => t.id))
        const cleaned = prev.filter((s) => !tempIds.has(s.id))
        const mapped = responseSources.map((rs: any) => mapApiSource(rs, workspaceId))
        return [...mapped, ...cleaned]
      })
      addNotification({
        icon: 'source',
        title: files.length === 1 ? 'Source uploaded' : `${files.length} sources uploaded`,
        description: `${label} queued for processing.`,
      })
      addToast(`${label} uploaded. Processing...`, 'info')
      // Reset processing timer for fast polling
      processingStartRef.current = Date.now()
      refreshSources()
      window.setTimeout(refreshSources, SOURCE_REFRESH_AFTER_UPLOAD_MS)
    } catch (error) {
      const tempIds = new Set(tempSources.map((t) => t.id))
      setSources((s) => s.filter((src) => !tempIds.has(src.id)))
      addToast(`Failed to upload ${label}`, 'error')
    }
    // Reset file input so the same file can be selected again
    e.target.value = ''
  }

  const addUrl = async () => {
    if (!urlValue.trim() || !workspaceId) return
    const tempId = Date.now().toString()
    const urlDisplayName = displayNameFromUrl(urlValue.trim())
    const newSource: Source = {
      id: tempId,
      type: 'WEB',
      name: urlDisplayName,
      meta: urlValue,
      status: 'processing',
      workspace_id: workspaceId
    }
    setSources((s) => [newSource, ...s])
    setUrlValue('')
    setShowUrlInput(false)
    addToast(`Fetching content from URL...`, 'info')

    try {
      const responseSource = await addUrlSource(urlValue, workspaceId)
      const mappedSource: Source = {
        id: responseSource.id || responseSource._id,
        type: 'WEB',
        name: responseSource.original_name || responseSource.filename || responseSource.name || urlValue,
        meta: urlValue,
        status: mapSourceStatus(responseSource.status),
        workspace_id: workspaceId,
        chunkCount: responseSource.chunk_count || responseSource.chunkCount || 0,
        errorMessage: responseSource.error_message || responseSource.errorMessage
      }
      setSources((s) => s.map((src) => src.id === tempId ? mappedSource : src))
      addNotification({
        icon: 'source',
        title: 'Source added',
        description: `${mappedSource.name} is being processed.`,
      })
      addToast('URL source added. Processing source...', 'info')
      refreshSources()
      window.setTimeout(refreshSources, SOURCE_REFRESH_AFTER_UPLOAD_MS)
    } catch (error) {
      setSources((s) => s.filter((src) => src.id !== tempId))
      addToast('Failed to process URL', 'error')
    }
  }

  const handleDeleteSource = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSources(sources.filter((s) => s.id !== id))
    try {
      await deleteSource(id)
      addToast('Source deleted', 'info')
    } catch (err) {
      addToast('Failed to delete source', 'error')
    }
  }

  /* ---- Studio generate ---- */
  const handleGenerate = useCallback(async () => {
    if (!selectedTool || !workspaceId || isGeneratingArtifact) return

    // Check AI limit before generating
    if (todayCount >= aiDailyLimit) {
      addToast(`Daily AI limit reached (${aiDailyLimit}/${aiDailyLimit}). Increase your limit in Settings → AI Limits.`, 'warning')
      return
    }

    if (sources.length === 0) {
      addToast('Upload a PDF, DOCX, TXT, or web URL source before generating.', 'warning')
      return
    }

    if (readySources.length === 0) {
      addToast('No processed sources are ready for generation yet.', 'warning')
      if (hasProcessingSources) refreshSources()
      return
    }

    if (selectedReadySourceIds.length === 0) {
      addToast('Select at least one ready source before generating.', 'warning')
      return
    }

    setIsGeneratingArtifact(true)
    addToast(`Generating ${selectedTool}...`, 'info')

    try {
      const toolObj = STUDIO_TOOLS.find(t => t.label === selectedTool)
      const artifact_type = toolObj ? toolObj.type : 'summary'

      const rawArtifact = await generateArtifact({
        workspace_id: workspaceId,
        artifact_type: artifact_type,
        title: `${selectedTool} — ${new Date().toLocaleString()}`,
        source_ids: selectedReadySourceIds
      })

      const tool = rawArtifact.artifact_type || rawArtifact.tool || artifact_type

      const newArtifact: Artifact = {
        id: rawArtifact.id || rawArtifact._id,
        tool,
        title: rawArtifact.title || formatToolName(tool),
        content: normalizeArtifactContent(tool, rawArtifact.content),
        createdAt: new Date(rawArtifact.created_at || rawArtifact.createdAt || new Date()),
        sourceCount: rawArtifact.source_ids?.length || selectedReadySourceIds.length
      }

      setArtifacts((prev) => [newArtifact, ...prev])
      setEditingArtifact(newArtifact)
      setSelectedTool(null)
      setExpandedArtifact(newArtifact.id)
      recordAICall(selectedTool)

      // Notification
      addNotification({
        icon: 'artifact',
        title: 'Artifact generated',
        description: `Your ${newArtifact.tool || newArtifact.title} is ready in Studio Output.`,
      })
      addToast(`${newArtifact.tool || newArtifact.title} generated successfully!`, 'success')

      // Check if this was the last allowed call
      if (todayCount + 1 >= aiDailyLimit) {
        setTimeout(() => {
          addToast(`You've reached your daily AI limit (${aiDailyLimit} calls). Increase it in Settings → AI Limits.`, 'warning')
        }, 500)
      }
    } catch (err: any) {
      const message = err?.response?.data?.detail || `Failed to generate ${selectedTool}`
      addToast(message, 'error')
    } finally {
      setIsGeneratingArtifact(false)
    }
  }, [selectedTool, workspaceId, isGeneratingArtifact, sources, readySources, selectedReadySourceIds, hasProcessingSources, todayCount, aiDailyLimit, recordAICall, addNotification, addToast, refreshSources])

  /* ---- Artifact actions ---- */
  const handleDeleteArtifact = async (id: string) => {
    setArtifacts((prev) => prev.filter((a) => a.id !== id))
    if (expandedArtifact === id) setExpandedArtifact(null)
    if (editingArtifact?.id === id) setEditingArtifact(null)
    try {
      await deleteArtifact(id)
      addToast('Artifact deleted', 'info')
    } catch (err) {
      addToast('Failed to delete artifact', 'error')
    }
  }

  const editArtifact = (artifact: Artifact) => {
    setEditingArtifact(artifact)
    setActiveTab('editor')
    // set editor content after a tick so the ref is mounted
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = artifact.content
      }
    }, 50)
  }

  /* ---- Rich editor commands ---- */
  const execCmd = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  /* ---- Tab styling helper ---- */
  const tabCls = (tab: 'chat' | 'output' | 'editor') =>
    `flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${activeTab === tab
      ? 'border-secondary text-secondary'
      : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
    }`

  return (
    <div className="flex flex-col h-screen bg-surface font-sans overflow-hidden">
      <TopNav activeTab="studio" />

      <div className="flex flex-1 overflow-hidden pt-14">
        {/* Left: Sources */}
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
            )})}
          </div>
        </aside>

        {/* Center */}
        <div className="flex-1 flex flex-col bg-surface overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-outline-variant bg-surface-container-lowest px-4 flex-shrink-0">
            <button className={tabCls('chat')} onClick={() => setActiveTab('chat')}>
              <FileText className="w-4 h-4" />
              Research Chat
            </button>
            <button className={tabCls('output')} onClick={() => setActiveTab('output')}>
              <Zap className="w-4 h-4" />
              Studio Output
              {artifacts.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-secondary/10 text-secondary rounded-full">
                  {artifacts.length}
                </span>
              )}
            </button>
            {activeTab === 'editor' && (
              <button className={tabCls('editor')} onClick={() => setActiveTab('editor')}>
                <Edit3 className="w-4 h-4" />
                Editable
              </button>
            )}
          </div>

          {/* Loading Skeleton */}
          {isLoadingWorkspace && (
            <div className="flex-1 flex flex-col p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 skeleton" />
                  <div className="h-3 w-32 skeleton" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-16 w-full skeleton" />
                <div className="h-16 w-5/6 skeleton" />
                <div className="h-16 w-full skeleton" />
                <div className="h-12 w-4/6 skeleton" />
              </div>
              <div className="flex items-center gap-3 mt-auto">
                <div className="h-10 flex-1 skeleton" />
                <div className="h-10 w-10 skeleton" />
              </div>
            </div>
          )}

          {/* ═══════════════ TAB: Research Chat ═══════════════ */}
          {!isLoadingWorkspace && activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} max-w-3xl ${msg.role === 'user' ? 'ml-auto' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'ai' ? 'bg-primary' : 'bg-secondary'}`}>
                      {msg.role === 'ai' ? (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      ) : (
                        <span className="text-white text-xs font-bold">U</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className={`p-4 rounded-xl text-sm leading-relaxed ${msg.role === 'ai' ? 'bg-surface-container-low border border-outline-variant rounded-tl-none' : 'bg-secondary-container text-on-secondary-container rounded-tr-none'}`}>
                        {renderMessageContent(msg.content, msg.role === 'user', msg.citations || [], sources)}
                      </div>
                      {msg.role === 'ai' && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => copyMessage(msg)}
                            className={`px-3 py-1.5 border rounded-full text-xs transition-colors flex items-center gap-1 ${copiedId === msg.id
                              ? 'border-green-400 bg-green-50 text-green-600'
                              : 'border-outline-variant hover:bg-surface-container'
                              }`}
                          >
                            {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedId === msg.id ? 'Copied!' : 'Copy'}
                          </button>
                          <button
                            onClick={() => likeMessage(msg.id)}
                            className={`px-2.5 py-1.5 border rounded-full text-xs transition-colors ${likedIds.includes(msg.id)
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-outline-variant hover:bg-surface-container'
                              }`}
                          >
                            <ThumbsUp className={`w-3 h-3 ${likedIds.includes(msg.id) ? 'fill-primary' : ''}`} />
                          </button>
                          <button
                            onClick={() => regenerateMessage(msg.id)}
                            disabled={!canChat}
                            className="px-3 py-1.5 border border-outline-variant rounded-full text-xs hover:bg-surface-container transition-colors flex items-center gap-1 disabled:opacity-45 disabled:cursor-not-allowed"
                          >
                            <RefreshCw className="w-3 h-3" /> Regenerate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex gap-3 max-w-3xl">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl rounded-tl-none flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-6 pb-5 bg-surface-container-lowest border-t border-outline-variant pt-3 flex-shrink-0">
                <div className="mb-2 flex items-center justify-between text-[11px] text-on-surface-variant">
                  <span>
                    {selectedReadySources.length > 0
                      ? `Using ${selectedReadySources.length} of ${readySources.length} ready sources`
                      : readySources.length > 0
                        ? 'No ready sources selected'
                        : 'No ready sources available'}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s.slice(1, -1))}
                      disabled={!canChat}
                      className="whitespace-nowrap px-3 py-1.5 bg-surface-container border border-outline-variant rounded-full text-xs hover:bg-surface-container-high transition-all disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2 bg-surface border border-outline-variant shadow-sm p-2 rounded-xl focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/10 transition-all">
                  <button className="p-2 text-outline hover:text-secondary transition-colors">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <textarea
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder={canChat ? 'Ask Atlas anything about your selected sources...' : 'Select a ready source to chat...'}
                    disabled={!canChat}
                    className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 focus:border-transparent resize-none py-2 text-sm placeholder:text-outline-variant disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ maxHeight: '120px' }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || !canChat}
                    className="bg-primary text-white p-2 rounded-lg hover:bg-zinc-800 transition-all disabled:opacity-40 active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ TAB: Studio Output ═══════════════ */}
          {!isLoadingWorkspace && activeTab === 'output' && (
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
                              <button
                                onClick={(e) => { e.stopPropagation(); editArtifact(artifact) }}
                                className="p-2.5 rounded-xl text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-all opacity-0 group-hover:opacity-100"
                                title="Edit in Editable tab"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
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
                                  <button
                                    onClick={() => editArtifact(artifact)}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-xs font-semibold transition-all hover:shadow-md active:scale-[0.98]"
                                    style={{ background: `linear-gradient(135deg, ${catColor}, ${catColor}cc)` }}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" /> Edit in Editable
                                  </button>
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
          )}

          {/* ═══════════════ TAB: Editable ═══════════════ */}
          {!isLoadingWorkspace && activeTab === 'editor' && (
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
          )}
        </div>

        {/* Right: Studio Tools */}
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
                {selectedReadySources.length > 0
                  ? `Using ${selectedReadySources.length} selected source${selectedReadySources.length === 1 ? '' : 's'}`
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
      </div>
    </div>
  )
}
