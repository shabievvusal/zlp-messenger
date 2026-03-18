import { api } from './client'
import type { User } from '@/types'

export interface RegisterPayload {
  username: string
  email?: string
  phone?: string
  password: string
  first_name: string
  last_name?: string
}

export interface LoginPayload {
  login: string
  password: string
}

export interface AuthResponse {
  access_token: string
  user: User
}

export const authApi = {
  register: (data: RegisterPayload) =>
    api.post<AuthResponse>('/auth/register', data),

  login: (data: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', data, {
      headers: {
        'X-Device-Name': navigator.userAgent.slice(0, 64),
        'X-Device-Type': 'web',
      },
    }),

  logout: () => api.post('/auth/logout'),

  refresh: () => api.post<AuthResponse>('/auth/refresh'),

  me: () => api.get<User>('/auth/me'),
}
