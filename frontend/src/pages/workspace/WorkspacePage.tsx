import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import TopNav from '../../components/navigation/TopNav'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import {
  fetchSources, uploadSource, uploadSourcesBatch, addUrlSource, deleteSource,
  generateArtifact, fetchArtifacts, deleteArtifact, fetchChats, fetchChat, createChat,
  Source, Artifact
} from '../../api/workspace'
import { API_BASE_URL } from '../../api/config'

import { FileText, Zap, Edit3 } from 'lucide-react'

// Imported types, constants, and utilities
import { Message } from './types'
import {
  STUDIO_TOOLS,
  SOURCE_REFRESH_FAST_MS,
  SOURCE_REFRESH_SLOW_MS,
  SOURCE_REFRESH_BACKOFF_AFTER_MS,
  SOURCE_REFRESH_AFTER_UPLOAD_MS,
  MAX_POLL_DURATION_MS
} from './constants'
import {
  parseStreamData,
  mapSourceType,
  mapSourceStatus,
  mapApiSource,
  displayNameFromUrl,
  getTool,
  formatToolName,
  normalizeArtifactContent,
  normalizeSlideDeckContent
} from './utils'

// Imported Components
import { SourcesSidebar } from './components/SourcesSidebar'
import { StudioToolsSidebar } from './components/StudioToolsSidebar'
import { ChatTab } from './components/ChatTab'
import { StudioOutputTab } from './components/StudioOutputTab'
import { EditableTab } from './components/EditableTab'

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
  const [regeneratePrompt, setRegeneratePrompt] = useState('')
  const [isEditorRegenerating, setIsEditorRegenerating] = useState(false)

  // Chat — copy & like feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<string[]>([])

  const hydrateArtifact = useCallback((artifact: any, fallbackSourceIds: string[] = []): Artifact => {
    const tool = artifact.artifact_type || artifact.tool
    const slideDeckDoc = (getTool(tool)?.type || tool) === 'slide_deck'
      ? normalizeSlideDeckContent(artifact.content)
      : null
    return {
      ...artifact,
      id: artifact.id || artifact._id,
      tool,
      title: artifact.title || formatToolName(tool),
      createdAt: new Date(artifact.created_at || artifact.createdAt || new Date()),
      sourceCount: artifact.source_ids?.length || artifact.sourceCount || fallbackSourceIds.length,
      sourceIds: artifact.source_ids || fallbackSourceIds,
      structuredContent: slideDeckDoc || undefined,
      content: slideDeckDoc ? normalizeArtifactContent(tool, slideDeckDoc) : normalizeArtifactContent(tool, artifact.content)
    }
  }, [])

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
        setArtifacts((fetchedArtifacts || []).map((a: any) => hydrateArtifact(a)))

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
  }, [workspaceId, setActiveWorkspace, hydrateArtifact])

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
      if (err?.response?.status === 401) {
        console.warn('Source polling stopped: authentication expired')
        return
      }
      console.error('Failed to refresh sources', err)
    }
  }, [workspaceId])

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

    if (todayCount >= aiDailyLimit) {
      addToast(`Daily AI limit reached (${aiDailyLimit}/${aiDailyLimit}). Increase your limit in Settings → AI Limits.`, 'warning')
      return
    }

    setInput('')
    const tempMsgId = Date.now().toString()
    const userMsg: Message = { id: tempMsgId, role: 'user', content }
    setMessages((m) => [...m, userMsg])
    setIsTyping(true)
    recordAICall('Chat')

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

    if (todayCount >= aiDailyLimit) {
      addToast(`Daily AI limit reached (${aiDailyLimit}/${aiDailyLimit}). Increase your limit in Settings → AI Limits.`, 'warning')
      return
    }

    const idx = messages.findIndex((m) => m.id === msgId)
    if (idx < 0) return
    setIsTyping(true)
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

  /* ---- Regenerate Artifact in Editor ---- */
  const handleEditorRegenerate = async () => {
    if (!editingArtifact || !workspaceId || isEditorRegenerating) return
    
    if (todayCount >= aiDailyLimit) {
      addToast(`Daily AI limit reached (${aiDailyLimit}/${aiDailyLimit}). Increase your limit in Settings → AI Limits.`, 'warning')
      return
    }

    if (!regeneratePrompt.trim()) {
      addToast('Please describe what to regenerate.', 'warning')
      return
    }

    setIsEditorRegenerating(true)
    addToast('Regenerating artifact...', 'info')

    try {
      const toolObj = STUDIO_TOOLS.find(t => t.label === editingArtifact.tool || t.type === editingArtifact.tool)
      const artifact_type = toolObj ? toolObj.type : 'summary'

      const rawArtifact = await generateArtifact({
        workspace_id: workspaceId,
        artifact_type: artifact_type,
        title: editingArtifact.title,
        source_ids: editingArtifact.sourceIds || [],
        custom_prompt: regeneratePrompt
      })

      const regeneratedArtifact = hydrateArtifact(rawArtifact, editingArtifact.sourceIds || [])
      const newContent = regeneratedArtifact.content
      
      if (editorRef.current) {
        editorRef.current.innerHTML = newContent
      }
      setEditingArtifact(regeneratedArtifact)
      setRegeneratePrompt('')
      recordAICall('Regenerate Artifact')
      addToast('Regeneration complete. Click Save Changes to apply.', 'success')

    } catch (err: any) {
      const message = err?.response?.data?.detail || 'Failed to regenerate artifact'
      addToast(message, 'error')
    } finally {
      setIsEditorRegenerating(false)
    }
  }


  /* ---- Export helpers for Editable tab ---- */
  const exportAsPdf = () => {
    if (!editingArtifact) return
    const content = editorRef.current?.innerHTML?.trim() || editingArtifact.content
    const title = editingArtifact.tool
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
    if (!editingArtifact) return
    const content = editorRef.current?.innerHTML?.trim() || editingArtifact.content
    const title = editingArtifact.tool
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

    const tempSources: Source[] = files.map((file, i) => ({
      id: `temp_${Date.now()}_${i}`,
      type: mapSourceType(file.name.split('.').pop()?.toUpperCase() || 'TXT'),
      name: file.name,
      meta: `Uploading • ${(file.size / 1024).toFixed(0)} KB`,
      status: 'processing' as const,
      workspace_id: workspaceId,
      progressStage: 'extracting',
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
      processingStartRef.current = Date.now()
      refreshSources()
      window.setTimeout(refreshSources, SOURCE_REFRESH_AFTER_UPLOAD_MS)
    } catch (error) {
      const tempIds = new Set(tempSources.map((t) => t.id))
      setSources((s) => s.filter((src) => !tempIds.has(src.id)))
      addToast(`Failed to upload ${label}`, 'error')
    }
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

      const newArtifact: Artifact = hydrateArtifact(rawArtifact, selectedReadySourceIds)

      setArtifacts((prev) => [newArtifact, ...prev])
      setEditingArtifact(newArtifact)
      setSelectedTool(null)
      setExpandedArtifact(newArtifact.id)
      recordAICall(selectedTool)

      addNotification({
        icon: 'artifact',
        title: 'Artifact generated',
        description: `Your ${newArtifact.tool || newArtifact.title} is ready in Studio Output.`,
      })
      addToast(`${newArtifact.tool || newArtifact.title} generated successfully!`, 'success')

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
  }, [selectedTool, workspaceId, isGeneratingArtifact, sources, readySources, selectedReadySourceIds, hasProcessingSources, todayCount, aiDailyLimit, recordAICall, addNotification, addToast, refreshSources, hydrateArtifact])

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
        <SourcesSidebar
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
          showUrlInput={showUrlInput}
          setShowUrlInput={setShowUrlInput}
          urlValue={urlValue}
          setUrlValue={setUrlValue}
          addUrl={addUrl}
          readySources={readySources}
          selectedReadySources={selectedReadySources}
          selectAllReadySources={selectAllReadySources}
          clearSelectedSources={clearSelectedSources}
          sources={sources}
          selectedSourceIds={selectedSourceIds}
          toggleSourceSelection={toggleSourceSelection}
          handleDeleteSource={handleDeleteSource}
        />

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
            <ChatTab
              messages={messages}
              sources={sources}
              selectedReadySources={selectedReadySources}
              readySources={readySources}
              isTyping={isTyping}
              canChat={canChat}
              input={input}
              setInput={setInput}
              sendMessage={sendMessage}
              copyMessage={copyMessage}
              copiedId={copiedId}
              likeMessage={likeMessage}
              likedIds={likedIds}
              regenerateMessage={regenerateMessage}
              messagesEndRef={messagesEndRef}
            />
          )}

          {/* ═══════════════ TAB: Studio Output ═══════════════ */}
          {!isLoadingWorkspace && activeTab === 'output' && (
            <StudioOutputTab
              artifacts={artifacts}
              expandedArtifact={expandedArtifact}
              setExpandedArtifact={setExpandedArtifact}
              editArtifact={editArtifact}
              handleDeleteArtifact={handleDeleteArtifact}
              addToast={addToast}
            />
          )}

          {/* ═══════════════ TAB: Editable ═══════════════ */}
          {!isLoadingWorkspace && activeTab === 'editor' && (
            <EditableTab
              editingArtifact={editingArtifact}
              setEditingArtifact={setEditingArtifact}
              setArtifacts={setArtifacts}
              editorRef={editorRef}
              regeneratePrompt={regeneratePrompt}
              setRegeneratePrompt={setRegeneratePrompt}
              handleEditorRegenerate={handleEditorRegenerate}
              isEditorRegenerating={isEditorRegenerating}
              exportAsPdf={exportAsPdf}
              exportAsDocx={exportAsDocx}
              setActiveTab={setActiveTab}
              execCmd={execCmd}
            />
          )}
        </div>

        {/* Right: Studio Tools */}
        <StudioToolsSidebar
          selectedTool={selectedTool}
          setSelectedTool={setSelectedTool}
          handleGenerate={handleGenerate}
          canGenerate={canGenerate}
          isGeneratingArtifact={isGeneratingArtifact}
          generateHint={generateHint}
          selectedReadySourcesLength={selectedReadySources.length}
        />
      </div>
    </div>
  )
}
