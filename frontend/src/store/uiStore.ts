import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export interface Notification {
  id: string
  icon: 'artifact' | 'source' | 'chat' | 'workspace'
  title: string
  description: string
  time: Date
  read: boolean
}

export interface AICall {
  id: string
  tool: string
  timestamp: Date
}

export type ThemeOption = 'light' | 'dark' | 'system'
interface UIState {
  searchOpen: boolean
  sidebarOpen: boolean
  toasts: Toast[]
  notifications: Notification[]
  aiCalls: AICall[]
  aiDailyLimit: number
  setSearchOpen: (open: boolean) => void
  setSidebarOpen: (open: boolean) => void
  addToast: (message: string, type?: Toast['type']) => void
  removeToast: (id: string) => void
  addNotification: (n: Omit<Notification, 'id' | 'time' | 'read'>) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  recordAICall: (tool: string) => void
  setAIDailyLimit: (limit: number) => void
  getTodayCallCount: () => number

  // Global user settings
  theme: ThemeOption
  liveStreaming: boolean
  autoSave: boolean
  emailNotifications: boolean
  pushNotifications: boolean
  weeklyDigest: boolean

  setTheme: (t: ThemeOption) => void
  setLiveStreaming: (v: boolean) => void
  setAutoSave: (v: boolean) => void
  setEmailNotifications: (v: boolean) => void
  setPushNotifications: (v: boolean) => void
  setWeeklyDigest: (v: boolean) => void
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate()
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      searchOpen: false,
      sidebarOpen: true,
      toasts: [],
      notifications: [],
      aiCalls: [],
      aiDailyLimit: 10,

      setSearchOpen: (open) => set({ searchOpen: open }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      addToast: (message, type = 'info') =>
        set((state) => ({
          toasts: [...state.toasts, { id: Date.now().toString(), message, type }],
        })),

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      addNotification: (n) =>
        set((state) => ({
          notifications: [
            { ...n, id: Date.now().toString(), time: new Date(), read: false },
            ...state.notifications,
          ].slice(0, 50), // keep max 50
        })),

      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markAllNotificationsRead: () =>
        set(() => ({
          notifications: [],
        })),

      recordAICall: (tool) =>
        set((state) => ({
          aiCalls: [
            { id: Date.now().toString(), tool, timestamp: new Date() },
            ...state.aiCalls,
          ].slice(0, 200), // keep max 200
        })),

      setAIDailyLimit: (limit) => set({ aiDailyLimit: limit }),

      getTodayCallCount: () => {
        const today = new Date()
        return get().aiCalls.filter((c) =>
          isSameDay(new Date(c.timestamp), today)
        ).length
      },

      // Global user settings
      theme: 'system',
      liveStreaming: true,
      autoSave: true,
      emailNotifications: true,
      pushNotifications: false,
      weeklyDigest: true,
      shareAnalytics: false,
      showProfile: true,

      setTheme: (t) => set({ theme: t }),
      setLiveStreaming: (v) => set({ liveStreaming: v }),
      setAutoSave: (v) => set({ autoSave: v }),
      setEmailNotifications: (v) => set({ emailNotifications: v }),
      setPushNotifications: (v) => set({ pushNotifications: v }),
      setWeeklyDigest: (v) => set({ weeklyDigest: v }),
    }),
    {
      name: 'atlas-ui',
      partialize: (state) => ({
        notifications: state.notifications,
        aiCalls: state.aiCalls,
        aiDailyLimit: state.aiDailyLimit,
        theme: state.theme,
        liveStreaming: state.liveStreaming,
        autoSave: state.autoSave,
        emailNotifications: state.emailNotifications,
        pushNotifications: state.pushNotifications,
        weeklyDigest: state.weeklyDigest,
      }),
    }
  )
)
