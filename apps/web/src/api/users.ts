import { api } from './client'
import type { User } from '@/types'

export const usersApi = {
  search: (q: string) => api.get<User[]>('/users/search', { params: { q } }),
  getById: (id: string) => api.get<User>(`/users/${id}`),
}
