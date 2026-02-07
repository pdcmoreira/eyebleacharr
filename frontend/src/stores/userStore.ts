import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiResponse } from '@shared/types/api'
import { JellyfinUser } from '@shared/types/media'
import { api } from '@/services/api'

export const useUserStore = defineStore('user', () => {
  const users = ref<JellyfinUser[]>([])

  // All users including hidden (for settings page hidden users selector)
  const allUsers = ref<JellyfinUser[]>([])

  async function fetchUsers() {
    try {
      const response = await api.get<ApiResponse<JellyfinUser[]>>('/api/users')

      users.value = response.data ?? []
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }

  // Fetch all users including hidden (for settings page)
  async function fetchAllUsers() {
    try {
      const response = await api.get<ApiResponse<JellyfinUser[]>>('/api/users', {
        includeHidden: 'true',
      })

      allUsers.value = response.data ?? []
    } catch (err) {
      console.error('Failed to fetch all users:', err)
    }
  }

  return {
    users,
    allUsers,
    fetchUsers,
    fetchAllUsers,
  }
})
