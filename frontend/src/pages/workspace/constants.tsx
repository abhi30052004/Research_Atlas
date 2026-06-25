import {
  FileText,
  Newspaper,
  BookOpen,
  HelpCircle,
  GitCompare,
  Table,
  ClipboardList,
  Brain,
  Sparkles,
  Layers,
  Presentation,
  BarChart3,
  Volume2
} from 'lucide-react'
import { StudioTool } from './types'

export const STUDIO_TOOLS: StudioTool[] = [
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

export const SUGGESTED = ['"Summarize"', '"Key Points"', '"Insights"']
export const SOURCE_REFRESH_FAST_MS = 2000
export const SOURCE_REFRESH_SLOW_MS = 5000
export const SOURCE_REFRESH_BACKOFF_AFTER_MS = 15000
export const SOURCE_REFRESH_AFTER_UPLOAD_MS = 1500
export const MAX_POLL_DURATION_MS = 5 * 60 * 1000 // 5 minutes

export const PROGRESS_STAGE_LABELS: Record<string, string> = {
  extracting: 'Extracting text…',
  chunking: 'Chunking…',
  storing_chunks: 'Storing chunks…',
  embedding: 'Generating embeddings…',
  indexing: 'Indexing vectors…',
  completed: 'Ready',
  failed: 'Failed',
  embedding_failed: 'Ready (indexing failed)',
}
