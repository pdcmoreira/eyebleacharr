/**
 * Settings Store
 * Manages media servers, arr services, and app settings configurations
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, ApiError } from '@/services/api'
import { ApiResponse } from '@shared/types/api'
import { MediaServer, ArrService, ConnectionTestResult } from '@shared/types/settings'

export const useSettingsStore = defineStore('settings', () => {
  const mediaServers = ref<MediaServer[]>([])

  const arrServices = ref<ArrService[]>([])

  const isLoading = ref(false)

  const error = ref<string | null>(null)

  const isInitialized = ref(false)

  // Computed: check if at least one media server is configured
  const hasCompletedSetup = computed(() => mediaServers.value.length > 0)

  // App Settings
  const hiddenUserIds = ref<string[]>([])
  const tmdbApiKey = ref<string>('')

  // Media Servers

  async function fetchMediaServers() {
    isLoading.value = true

    try {
      const response = await api.get<ApiResponse<MediaServer[]>>('/api/settings/media-servers')

      mediaServers.value = response.data ?? []
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message
    } finally {
      isLoading.value = false

      isInitialized.value = true
    }
  }

  // Accepts simplified form data - name/type/isActive are all set by backend
  async function createMediaServer(data: { url: string; apiKey: string }) {
    isLoading.value = true

    try {
      const response = await api.post<ApiResponse<MediaServer>>('/api/settings/media-servers', data)

      if (response.data) {
        mediaServers.value.push(response.data)
      }

      return response.data
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message

      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateMediaServer(id: number, data: Partial<MediaServer>) {
    isLoading.value = true

    try {
      const response = await api.put<ApiResponse<MediaServer>>(
        `/api/settings/media-servers/${id}`,
        data,
      )

      const index = mediaServers.value.findIndex((s) => s.id === id)

      if (index !== -1 && response.data) {
        mediaServers.value[index] = response.data
      }

      return response.data
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message

      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteMediaServer(id: number) {
    isLoading.value = true

    try {
      await api.delete(`/api/settings/media-servers/${id}`)

      mediaServers.value = mediaServers.value.filter((s) => s.id !== id)
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message

      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function testMediaServer(id: number): Promise<ConnectionTestResult> {
    try {
      const response = await api.post<ApiResponse<ConnectionTestResult>>(
        `/api/settings/media-servers/${id}/test`,
      )

      return response.data ?? { success: false, message: 'No response data' }
    } catch (err) {
      return {
        success: false,
        message: err instanceof ApiError ? err.message : (err as Error).message,
      }
    }
  }

  // Arr Services

  async function fetchArrServices() {
    isLoading.value = true

    try {
      const response = await api.get<ApiResponse<ArrService[]>>('/api/settings/arr-services')

      arrServices.value = response.data ?? []
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message
    } finally {
      isLoading.value = false
    }
  }

  // Accepts simplified form data - type is auto-detected by backend
  async function createArrService(data: { url: string; apiKey: string; isActive?: boolean }) {
    isLoading.value = true

    try {
      const response = await api.post<ApiResponse<ArrService>>('/api/settings/arr-services', data)

      if (response.data) {
        arrServices.value.push(response.data)
      }

      return response.data
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message

      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateArrService(id: number, data: Partial<ArrService>) {
    isLoading.value = true

    try {
      const response = await api.put<ApiResponse<ArrService>>(
        `/api/settings/arr-services/${id}`,
        data,
      )

      const index = arrServices.value.findIndex((s) => s.id === id)

      if (index !== -1 && response.data) {
        arrServices.value[index] = response.data
      }

      return response.data
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message

      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteArrService(id: number) {
    isLoading.value = true

    try {
      await api.delete(`/api/settings/arr-services/${id}`)

      arrServices.value = arrServices.value.filter((s) => s.id !== id)
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message

      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function testArrService(id: number): Promise<ConnectionTestResult> {
    try {
      const response = await api.post<ApiResponse<ConnectionTestResult>>(
        `/api/settings/arr-services/${id}/test`,
      )

      return response.data ?? { success: false, message: 'No response data' }
    } catch (err) {
      return {
        success: false,
        message: err instanceof ApiError ? err.message : (err as Error).message,
      }
    }
  }

  // App Settings

  async function fetchHiddenUsers() {
    try {
      const response = await api.get<ApiResponse<string[]>>('/api/settings/app/hiddenUserIds')

      hiddenUserIds.value = response.data ?? []
    } catch (err) {
      console.error('Failed to fetch hidden users:', err)
    }
  }

  async function saveHiddenUsers(ids: string[]) {
    try {
      await api.put('/api/settings/app/hiddenUserIds', { value: ids })

      hiddenUserIds.value = ids
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message

      throw err
    }
  }

  async function fetchTmdbApiKey() {
    try {
      const response = await api.get<ApiResponse<string>>('/api/settings/app/tmdbApiKey')

      tmdbApiKey.value = response.data ?? ''
    } catch (err) {
      console.error('Failed to fetch TMDB API key:', err)
    }
  }

  async function saveTmdbApiKey(apiKey: string) {
    try {
      await api.put('/api/settings/app/tmdbApiKey', { value: apiKey })

      tmdbApiKey.value = apiKey
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message

      throw err
    }
  }

  async function testTmdbConnection(apiKey: string): Promise<ConnectionTestResult> {
    try {
      const response = await api.post<ApiResponse<ConnectionTestResult>>(
        '/api/settings/tmdb/test',
        { apiKey },
      )

      return response.data ?? { success: false, message: 'No response data' }
    } catch (err) {
      return {
        success: false,
        message: err instanceof ApiError ? err.message : (err as Error).message,
      }
    }
  }

  return {
    mediaServers,
    arrServices,
    hiddenUserIds,
    tmdbApiKey,
    isLoading,
    error,
    isInitialized,
    hasCompletedSetup,
    fetchMediaServers,
    createMediaServer,
    updateMediaServer,
    deleteMediaServer,
    testMediaServer,
    fetchArrServices,
    createArrService,
    updateArrService,
    deleteArrService,
    testArrService,
    fetchHiddenUsers,
    saveHiddenUsers,
    fetchTmdbApiKey,
    saveTmdbApiKey,
    testTmdbConnection,
  }
})
