import { create } from 'zustand'
import { api } from '../api/client'

export interface Workspace {
  id: string
  title: string
  description: string
  tag: string
  tagColor: string
  files: number
  members: number
  updatedAt: string
}

interface WorkspaceState {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  isLoading: boolean
  error: string | null
  fetchWorkspaces: () => Promise<void>
  setActiveWorkspace: (id: string) => void
  addWorkspace: (ws: Omit<Workspace, 'id'>) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  workspaces: [],
  activeWorkspaceId: null,
  isLoading: false,
  error: null,
  
  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.get('/workspaces')
      const workspaceList = Array.isArray(data) ? data : data.workspaces || []
      // Map backend fields to frontend interface if necessary
      const mappedWorkspaces = workspaceList.map((ws: any) => ({
        id: ws.id,
        title: ws.name,
        description: ws.description,
        tag: ws.category || 'General',
        tagColor: 'text-secondary bg-secondary-fixed/30', // Fallback color
        files: ws.source_count ?? ws.file_count ?? 0,
        members: ws.member_count || 1,
        updatedAt: ws.updated_at || new Date().toISOString()
      }))
      set({ workspaces: mappedWorkspaces, isLoading: false })
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to fetch workspaces', isLoading: false })
    }
  },
  
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  
  addWorkspace: async (ws) => {
    try {
      const { data } = await api.post('/workspaces', { name: ws.title, description: ws.description })
      const newWs: Workspace = {
        id: data.id,
        title: data.name,
        description: data.description,
        tag: data.category || 'General',
        tagColor: 'text-secondary bg-secondary-fixed/30',
        files: 0,
        members: 1,
        updatedAt: data.updated_at || new Date().toISOString()
      }
      set((state) => ({ workspaces: [...state.workspaces, newWs] }))
    } catch (err) {
      console.error('Failed to create workspace', err)
    }
  },
  
  deleteWorkspace: async (id) => {
    try {
      await api.delete(`/workspaces/${id}`)
      set((state) => ({
        workspaces: state.workspaces.filter((w) => w.id !== id),
      }))
    } catch (err) {
      console.error('Failed to delete workspace', err)
    }
  },
}))
