import { api } from './client'

export interface Source {
  id: string
  type: 'PDF' | 'WEB' | 'DOCX'
  name: string
  meta: string
  status: 'processed' | 'processing'
  content?: string
  workspace_id: string
}

export interface Artifact {
  id: string
  tool: string
  title: string
  content: string
  createdAt: Date
  sourceCount: number
}

export interface Chat {
  id: string
  title: string
  workspace_id: string
  messages: any[]
}

// ---- Sources ----
export const uploadSource = async (file: File, workspaceId: string) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const { data } = await api.post(`/sources/upload?workspace_id=${workspaceId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const addUrlSource = async (url: string, workspaceId: string) => {
  const { data } = await api.post(`/sources/url`, {
    url,
    workspace_id: workspaceId,
    name: url
  })
  return data
}

export const fetchSources = async (workspaceId: string) => {
  const { data } = await api.get(`/sources?workspace_id=${workspaceId}`)
  return data.sources
}

export const deleteSource = async (sourceId: string) => {
  await api.delete(`/sources/${sourceId}`)
}

// ---- Artifacts ----
export const generateArtifact = async (params: {
  workspace_id: string
  artifact_type: string
  title?: string
  source_ids?: string[]
  custom_prompt?: string
  model?: string
}) => {
  const { data } = await api.post(`/artifacts/generate`, params)
  return data
}

export const fetchArtifacts = async (workspaceId: string) => {
  const { data } = await api.get(`/artifacts?workspace_id=${workspaceId}`)
  return data.artifacts
}

export const deleteArtifact = async (artifactId: string) => {
  await api.delete(`/artifacts/${artifactId}`)
}

// ---- Chat ----
export const fetchChats = async (workspaceId: string) => {
  const { data } = await api.get(`/chat?workspace_id=${workspaceId}`)
  return data.chats
}

export const createChat = async (workspaceId: string, model: string = 'gpt-4o') => {
  const { data } = await api.post(`/chat`, {
    workspace_id: workspaceId,
    model: model,
    title: 'New Chat'
  })
  return data
}

export const fetchChat = async (chatId: string) => {
  const { data } = await api.get(`/chat/${chatId}`)
  return data
}
