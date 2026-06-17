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
        const { data: tokenData } = await api.post('/auth/login', credentials)
        const userData = tokenData.user || (await api.get('/auth/me')).data
        set({
          user: {
            id: userData.id,
            name: userData.full_name || userData.username,
            email: userData.email,
            avatar: userData.avatar_url,
          },
          token: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          isAuthenticated: true,
        })
      },

      registerApi: async (userData) => {
        const { data } = await api.post('/auth/register', userData)
        if (!data.access_token || !data.user) {
          await get().loginApi({ email: userData.email, password: userData.password })
          return
        }
        set({
          user: {
            id: data.user.id,
            name: data.user.full_name || data.user.username,
            email: data.user.email,
            avatar: data.user.avatar_url,
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
