import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({
  // @ts-ignore - Vite env variables
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token to every request
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Optional: Response interceptor to handle token refresh or unauthorized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Handle unauthorized (e.g. clear store, redirect to login)
      // useAuthStore.getState().logoutApi(); // Could be implemented here if logout is fully fleshed out
    }
    return Promise.reject(error);
  }
);
