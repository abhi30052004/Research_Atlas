import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../api/client'

interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (user: User, token: string, refreshToken?: string) => void
  logout: () => void
  loginApi: (credentials: any) => Promise<void>
  googleLoginApi: (idToken: string) => Promise<void>
  registerApi: (userData: any) => Promise<void>
  logoutApi: () => Promise<void>
  refreshTokenApi: () => Promise<string | null>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      login: (user, token, refreshToken) =>
        set({ user, token, refreshToken: refreshToken || null, isAuthenticated: true }),
      logout: () =>
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),

      loginApi: async (credentials) => {
        const { data } = await api.post('/auth/login', credentials)
        // Backend always returns user inline — no /auth/me round-trip needed
        const u = data.user
        set({
          user: {
            id: u.id,
            name: u.full_name || u.username,
            email: u.email,
            avatar: u.avatar_url,
          },
          token: data.access_token,
          refreshToken: data.refresh_token,
          isAuthenticated: true,
        })
      },

      googleLoginApi: async (idToken) => {
        const { data } = await api.post('/auth/google', { id_token: idToken })
        const u = data.user
        set({
          user: {
            id: u.id,
            name: u.full_name || u.username,
            email: u.email,
            avatar: u.avatar_url,
          },
          token: data.access_token,
          refreshToken: data.refresh_token,
          isAuthenticated: true,
        })
      },

      registerApi: async (userData) => {
        const { data } = await api.post('/auth/register', userData)
        // Backend register returns tokens + user in one shot — no fallback needed
        const u = data.user
        set({
          user: {
            id: u.id,
            name: u.full_name || u.username,
            email: u.email,
            avatar: u.avatar_url,
          },
          token: data.access_token,
          refreshToken: data.refresh_token,
          isAuthenticated: true,
        })
      },

      logoutApi: async () => {
        try {
          const rt = get().refreshToken
          if (rt && get().token) {
            try {
              await api.post('/auth/logout', { refresh_token: rt })
            } catch {
              // Ignore logout API errors — we clear local state regardless
            }
          }
        } finally {
          set({ user: null, token: null, refreshToken: null, isAuthenticated: false })
        }
      },

      /**
       * Attempt to refresh the access token using the stored refresh token.
       * Returns the new access token on success, or null on failure (also logs out).
       */
      refreshTokenApi: async () => {
        const rt = get().refreshToken
        if (!rt) {
          get().logout()
          return null
        }

        try {
          // Use a raw axios call to avoid the interceptor loop
          const { default: axios } = await import('axios')
          const { API_BASE_URL } = await import('../api/config')
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: rt,
          })

          set({
            token: data.access_token,
            refreshToken: data.refresh_token,
          })
          return data.access_token
        } catch {
          // Refresh token is expired or revoked — full logout
          set({ user: null, token: null, refreshToken: null, isAuthenticated: false })
          return null
        }
      },
    }),
    { name: 'atlas-auth' }
  )
)
