import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiResponse } from '@shared/types/api'
import {
  WatchedMovie,
  WatchedSeries,
  SyncStatus,
  DeleteResult,
  DeletePreviewItem,
} from '@shared/types/media'
import { useUserStore } from '@/stores/userStore'
import { api, ApiError } from '@/services/api'
import { useSelection } from '@/composables/selection'

export const useMediaStore = defineStore('media', () => {
  const userStore = useUserStore()

  // State

  const movies = ref<WatchedMovie[]>([])

  const series = ref<WatchedSeries[]>([])

  const syncStatus = ref<SyncStatus | null>(null)

  const isLoading = ref(false)

  const error = ref<string | null>(null)

  // Selected items for deletion

  const selectedMoviesIds = ref<number[]>([])

  const selectedEpisodesIds = ref<number[]>([])

  const hasSelection = computed(
    () => selectedMoviesIds.value.length > 0 || selectedEpisodesIds.value.length > 0,
  )

  const selectionCount = computed(
    () => selectedMoviesIds.value.length + selectedEpisodesIds.value.length,
  )

  const {
    allSelected: allMoviesSelected,
    isSelected: isMovieSelected,
    select: selectMovie,
  } = useSelection(() => movies.value.map((m) => m.id), selectedMoviesIds)

  const {
    allSelected: allEpisodesSelected,
    isSelected: isEpisodeSelected,
    select: selectEpisode,
  } = useSelection(
    () => series.value.flatMap((s) => s.episodes.map((e) => e.id)),
    selectedEpisodesIds,
  )

  // Filters

  const filterUserIds = ref<string[]>([])

  const sortBy = ref<string>('lastWatchedAt')

  const sortOrder = ref<'asc' | 'desc'>('desc')

  // Actions
  async function fetchMovies() {
    isLoading.value = true

    error.value = null

    try {
      const params: Record<string, string> = {
        sort: sortBy.value,
        order: sortOrder.value,
        status: 'watched',
      }

      if (filterUserIds.value.length) {
        params.userIds = filterUserIds.value.join(',')
      }

      const response = await api.get<ApiResponse<WatchedMovie[]>>('/api/media/movies', params)

      movies.value = response.data ?? []
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message
    } finally {
      isLoading.value = false
    }
  }

  async function fetchSeries() {
    isLoading.value = true

    error.value = null

    try {
      const params: Record<string, string> = {
        sort: sortBy.value,
        order: sortOrder.value,
        status: 'watched',
      }

      if (filterUserIds.value.length) {
        params.userIds = filterUserIds.value.join(',')
      }

      const response = await api.get<ApiResponse<WatchedSeries[]>>('/api/media/series', params)

      series.value = response.data ?? []
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message
    } finally {
      isLoading.value = false
    }
  }

  async function fetchSyncStatus() {
    try {
      const response = await api.get<ApiResponse<SyncStatus>>('/api/media/sync/status')

      syncStatus.value = response.data ?? null
    } catch (err) {
      console.error('Failed to fetch sync status:', err)
    }
  }

  async function triggerSync() {
    try {
      await api.post('/api/media/sync')

      // Start polling for sync completion
      await pollSyncStatus()
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message
    }
  }

  async function pollSyncStatus() {
    // Fetch initial status
    await fetchSyncStatus()

    // If sync is running, poll until complete
    if (syncStatus.value?.isRunning) {
      const pollInterval = 2000 // Poll every 2 seconds

      const maxPolls = 150 // Max 5 minutes (150 * 2s)

      let pollCount = 0

      const poll = async (): Promise<void> => {
        await fetchSyncStatus()

        pollCount++

        if (syncStatus.value?.isRunning && pollCount < maxPolls) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval))

          return poll()
        }

        // Sync finished - refresh data
        if (!syncStatus.value?.isRunning) {
          await Promise.all([fetchMovies(), fetchSeries(), userStore.fetchUsers()])
        }
      }

      await poll()
    }
  }

  // Start polling if a sync is already running (e.g., on page refresh)
  async function startPollingIfSyncing() {
    if (syncStatus.value?.isRunning) {
      await pollSyncStatus()
    }
  }

  async function deleteSelected() {
    if (!hasSelection.value) {
      return
    }

    isLoading.value = true

    error.value = null

    try {
      const response = await api.delete<ApiResponse<DeleteResult>>('/api/media/delete', {
        movieIds: Array.from(selectedMoviesIds.value),
        episodeIds: Array.from(selectedEpisodesIds.value),
      })

      const result = response.data

      console.log('Delete result:', result)

      // Clear selection

      allMoviesSelected.value = false

      allEpisodesSelected.value = false

      // Refresh data
      await Promise.all([fetchMovies(), fetchSeries()])

      return result
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : (err as Error).message

      throw err
    } finally {
      isLoading.value = false
    }
  }

  function setFilter(userIds: string[]) {
    filterUserIds.value = userIds
  }

  function setSort(field: string, order: 'asc' | 'desc') {
    sortBy.value = field
    sortOrder.value = order
  }

  async function fetchDeletePreview(): Promise<DeletePreviewItem[]> {
    if (!hasSelection.value) {
      return []
    }

    const response = await api.post<ApiResponse<DeletePreviewItem[]>>('/api/media/delete/preview', {
      movieIds: Array.from(selectedMoviesIds.value),
      episodeIds: Array.from(selectedEpisodesIds.value),
    })

    return response.data ?? []
  }

  return {
    movies,
    series,
    syncStatus,
    isLoading,
    error,
    selectedMoviesIds,
    selectedEpisodesIds,
    filterUserIds,
    sortBy,
    sortOrder,
    hasSelection,
    selectionCount,
    fetchMovies,
    fetchSeries,
    fetchSyncStatus,
    triggerSync,
    startPollingIfSyncing,
    deleteSelected,
    allMoviesSelected,
    isMovieSelected,
    selectMovie,
    allEpisodesSelected,
    isEpisodeSelected,
    selectEpisode,
    setFilter,
    setSort,
    fetchDeletePreview,
  }
})
