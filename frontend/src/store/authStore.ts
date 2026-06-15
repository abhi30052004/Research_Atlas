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
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  loginApi: (credentials: any) => Promise<void>
  registerApi: (userData: any) => Promise<void>
  logoutApi: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      
      loginApi: async (credentials) => {
        const { data: tokenData } = await api.post('/auth/login', credentials)
        
        // Temporarily set token so the interceptor uses it for the /me request
        set({ token: tokenData.access_token })
        
        const { data: userData } = await api.get('/auth/me')
        set({
          user: {
            id: userData.id,
            name: userData.full_name || userData.username,
            email: userData.email,
            avatar: userData.avatar_url
          },
          token: tokenData.access_token,
          isAuthenticated: true
        })
      },

      registerApi: async (userData) => {
        await api.post('/auth/register', userData)
        // After register, automatically log in
        await get().loginApi({ email: userData.email, password: userData.password })
      },

      logoutApi: async () => {
        try {
          if (get().token) {
            // Optional: Call backend logout if it exists and takes refresh token, 
            // but for simple JWT we just clear the store
          }
        } finally {
          set({ user: null, token: null, isAuthenticated: false })
        }
      }
    }),
    { name: 'atlas-auth' }
  )
)
