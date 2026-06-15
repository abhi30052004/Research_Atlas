import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import TopNav from '../../components/navigation/TopNav'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { fetchSources, uploadSource, addUrlSource, deleteSource, generateArtifact, fetchArtifacts, deleteArtifact, fetchChats, fetchChat, createChat, type Source, type Artifact } from '../../api/workspace'
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
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
  citations?: number[]
}

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


function TypeBadge({ type }: { type: Source['type'] }) {
  const colors = { PDF: 'text-red-600 bg-red-50', WEB: 'text-blue-600 bg-blue-50', DOCX: 'text-indigo-600 bg-indigo-50' }
  return <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${colors[type]}`}>{type}</span>
}

function renderMessageContent(content: string, isUser?: boolean) {
  if (isUser) {
    return <div className="whitespace-pre-wrap">{content}</div>
  }
  return (
    <div className="markdown-body prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-surface-container-high prose-pre:text-on-surface [&>ol]:list-decimal [&>ol]:pl-5 [&>ul]:list-disc [&>ul]:pl-5 [&>p]:mb-2 [&>h1]:font-bold [&>h1]:text-lg [&>h2]:font-bold [&>h2]:text-md [&>h3]:font-bold">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

/* ---------- Tool icon lookup for artifact cards ---------- */
function getToolIcon(label: string) {
  const found = STUDIO_TOOLS.find(t => t.label === label)
  return found ? found.icon : <FileText className="w-4 h-4" />
}

export default function WorkspacePage() {
  const { id: workspaceId } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<'chat' | 'output' | 'editor'>('chat')

  const [sources, setSources] = useState<Source[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)

  // Loading states
  const [, setIsLoading] = useState(true)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)

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
          type: (s.source_type || s.type || 'PDF').toUpperCase() as Source['type'],
          name: s.original_name || s.filename || s.name || 'Untitled',
          meta: s.meta || `${s.file_size ? (s.file_size / 1024).toFixed(0) + ' KB' : ''} • ${new Date(s.created_at || s.createdAt || new Date()).toLocaleDateString()}`,
          status: s.status === 'processed' || s.status === 'completed' ? 'processed' : 'processing',
          workspace_id: workspaceId
        })))
        setArtifacts((fetchedArtifacts || []).map((a: any) => {
          let contentStr = typeof a.content === 'string' ? a.content : JSON.stringify(a.content, null, 2)
          // If it looks like markdown (has headers, bold, lists, etc) and not purely HTML, parse it
          if (contentStr.match(/(^#|\*\*|\* |- |`)/m) && !contentStr.startsWith('<')) {
            contentStr = DOMPurify.sanitize(marked.parse(contentStr) as string)
          }
          return {
            ...a,
            id: a.id || a._id,
            tool: a.artifact_type || a.tool,
            createdAt: new Date(a.created_at || a.createdAt || new Date()),
            sourceCount: a.source_ids?.length || a.sourceCount || 0,
            content: contentStr
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
  }, [workspaceId])

  /* ---- UI Store ---- */
  const { addToast, addNotification, recordAICall, aiCalls, aiDailyLimit } = useUIStore()

  // Compute today's call count dynamically
  const todayCount = aiCalls.filter((c) => {
    const d = new Date(c.timestamp)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  }).length

  /* ---- Chat ---- */
  const sendMessage = async (text?: string) => {
    const content = text || input.trim()
    if (!content || !currentChatId) return

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
        body: JSON.stringify({ content, model: 'gpt-4o' })
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

    // Check AI limit before regenerating
    if (todayCount >= aiDailyLimit) {
      addToast(`Daily AI limit reached (${aiDailyLimit}/${aiDailyLimit}). Increase your limit in Settings → AI Limits.`, 'warning')
      return
    }

    const idx = messages.findIndex((m) => m.id === msgId)
    if (idx < 0) return
    setMessages((prev) => prev.filter((m) => m.id !== msgId))
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
        body: JSON.stringify({ message_id: msgId, model: 'gpt-4o' })
      })

      if (!response.ok) throw new Error('Failed to regenerate')

      const data = await response.json()
      setMessages((prev) => [...prev, data.message])
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
    const file = e.target.files?.[0]
    if (!file || !workspaceId) return
    const tempId = Date.now().toString()
    const ext = file.name.split('.').pop()?.toUpperCase() as Source['type']
    const type: Source['type'] = ['PDF', 'DOCX'].includes(ext) ? ext : 'PDF'
    const newSource: Source = {
      id: tempId,
      type,
      name: file.name,
      meta: `Uploading • ${(file.size / 1024).toFixed(0)} KB`,
      status: 'processing',
      workspace_id: workspaceId
    }
    setSources((s) => [newSource, ...s])
    addToast(`Uploading "${file.name}"...`, 'info')

    try {
      const responseSource = await uploadSource(file, workspaceId)
      const mappedSource: Source = {
        id: responseSource.id || responseSource._id,
        type: (responseSource.source_type || responseSource.type || ext).toUpperCase() as Source['type'],
        name: responseSource.original_name || responseSource.filename || responseSource.name || file.name,
        meta: `${(file.size / 1024).toFixed(0)} KB • ${new Date().toLocaleDateString()}`,
        status: 'processed',
        workspace_id: workspaceId
      }
      setSources((s) => s.map((src) => src.id === tempId ? mappedSource : src))
      addNotification({
        icon: 'source',
        title: 'Source processed',
        description: `${mappedSource.name} is ready to query.`,
      })
      addToast(`"${mappedSource.name}" processed successfully`, 'success')
    } catch (error) {
      setSources((s) => s.filter((src) => src.id !== tempId))
      addToast(`Failed to upload "${file.name}"`, 'error')
    }
  }

  const addUrl = async () => {
    if (!urlValue.trim() || !workspaceId) return
    const tempId = Date.now().toString()
    const newSource: Source = {
      id: tempId,
      type: 'WEB',
      name: urlValue,
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
        status: 'processed',
        workspace_id: workspaceId
      }
      setSources((s) => s.map((src) => src.id === tempId ? mappedSource : src))
      addNotification({
        icon: 'source',
        title: 'Source processed',
        description: `${mappedSource.name} is ready to query.`,
      })
      addToast('URL source processed successfully', 'success')
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
    if (!selectedTool || !workspaceId) return

    // Check AI limit before generating
    if (todayCount >= aiDailyLimit) {
      addToast(`Daily AI limit reached (${aiDailyLimit}/${aiDailyLimit}). Increase your limit in Settings → AI Limits.`, 'warning')
      return
    }

    // Record AI call
    recordAICall(selectedTool)
    addToast(`Generating ${selectedTool}...`, 'info')

    try {
      const toolObj = STUDIO_TOOLS.find(t => t.label === selectedTool)
      const artifact_type = toolObj ? toolObj.type : 'summary'

      const rawArtifact = await generateArtifact({
        workspace_id: workspaceId,
        artifact_type: artifact_type,
        title: `${selectedTool} — ${new Date().toLocaleString()}`,
        source_ids: sources.map(s => s.id)
      })

      let contentStr = typeof rawArtifact.content === 'string' ? rawArtifact.content : JSON.stringify(rawArtifact.content, null, 2)
      if (contentStr.match(/(^#|\*\*|\* |- |`)/m) && !contentStr.startsWith('<')) {
        contentStr = DOMPurify.sanitize(marked.parse(contentStr) as string)
      }

      const newArtifact: Artifact = {
        id: rawArtifact.id || rawArtifact._id,
        tool: rawArtifact.artifact_type || rawArtifact.tool || selectedTool,
        title: rawArtifact.title || selectedTool,
        content: contentStr,
        createdAt: new Date(rawArtifact.created_at || rawArtifact.createdAt || new Date()),
        sourceCount: rawArtifact.source_ids?.length || sources.length
      }

      setArtifacts((prev) => [newArtifact, ...prev])
      setEditingArtifact(newArtifact)
      setSelectedTool(null)
      setExpandedArtifact(newArtifact.id)

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
    } catch (err) {
      addToast(`Failed to generate ${selectedTool}`, 'error')
    }
  }, [selectedTool, workspaceId, sources, todayCount, aiDailyLimit, recordAICall, addNotification, addToast])

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
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={handleFileUpload} />

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
            {sources.map((src) => (
              <div key={src.id} className={`bg-surface-container-lowest border border-outline-variant p-3 rounded-lg hover:shadow-sm transition-all group ${src.status === 'processing' ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between mb-1.5">
                  <TypeBadge type={src.type} />
                  <div className="flex items-center gap-1">
                    {src.status === 'processing' ? (
                      <span className="flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" /> Processing
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Processed
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
              </div>
            ))}
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

          {/* ═══════════════ TAB: Research Chat ═══════════════ */}
          {activeTab === 'chat' && (
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
                        {renderMessageContent(msg.content, msg.role === 'user')}
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
                            className="px-3 py-1.5 border border-outline-variant rounded-full text-xs hover:bg-surface-container transition-colors flex items-center gap-1"
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
                <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
                  {SUGGESTED.map((s) => (
                    <button key={s} onClick={() => sendMessage(s.slice(1, -1))} className="whitespace-nowrap px-3 py-1.5 bg-surface-container border border-outline-variant rounded-full text-xs hover:bg-surface-container-high transition-all">
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
                    placeholder="Ask Atlas anything about your sources..."
                    className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 focus:border-transparent resize-none py-2 text-sm placeholder:text-outline-variant"
                    style={{ maxHeight: '120px' }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim()}
                    className="bg-primary text-white p-2 rounded-lg hover:bg-zinc-800 transition-all disabled:opacity-40 active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ TAB: Studio Output ═══════════════ */}
          {activeTab === 'output' && (
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
                      const toolObj = STUDIO_TOOLS.find(t => t.label === artifact.tool)
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
                                  className="prose prose-slate max-w-none text-sm leading-relaxed
                                    [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-on-surface [&_h1]:mb-4 [&_h1]:mt-0 [&_h1]:pb-3 [&_h1]:border-b [&_h1]:border-outline-variant
                                    [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-on-surface [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2
                                    [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-on-surface [&_h3]:mb-2 [&_h3]:mt-5
                                    [&_p]:text-on-surface-variant [&_p]:mb-3 [&_p]:leading-[1.75]
                                    [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ul]:text-on-surface-variant
                                    [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1.5 [&_ol]:text-on-surface-variant
                                    [&_li]:text-on-surface-variant [&_li]:leading-relaxed
                                    [&_strong]:text-on-surface [&_strong]:font-semibold
                                    [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-on-surface-variant [&_blockquote]:my-4
                                    [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
                                    [&_th]:bg-surface-container [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-on-surface [&_th]:border [&_th]:border-outline-variant
                                    [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-sm [&_td]:border [&_td]:border-outline-variant [&_td]:text-on-surface-variant
                                    [&_tr:hover]:bg-surface-container-low
                                    [&_code]:bg-surface-container [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                                    [&_pre]:bg-surface-container [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:my-4"
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
          {activeTab === 'editor' && (
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
              <button
                onClick={handleGenerate}
                className="w-full py-2 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-indigo-600 transition-colors"
              >
                Generate
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
