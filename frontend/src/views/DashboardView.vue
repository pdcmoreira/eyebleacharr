<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { DeletePreviewItem } from '@shared/types/media'
import { useUserStore } from '@/stores/userStore'
import { useMediaStore } from '@/stores/mediaStore'
import UiButton from '@/components/ui/UiButton.vue'
import DeletePreviewModal from '@/components/dashboard/DeletePreviewModal.vue'
import DashboardTabs from '@/components/dashboard/DashboardTabs.vue'
import FilterBar from '@/components/dashboard/FilterBar.vue'
import BulkActions from '@/components/dashboard/BulkActions.vue'
import MovieCard from '@/components/dashboard/MovieCard.vue'
import SeriesCard from '@/components/dashboard/SeriesCard.vue'
import { RefreshCw, Loader2 } from 'lucide-vue-next'

const userStore = useUserStore()

const store = useMediaStore()

const activeTab = ref<'movies' | 'series'>('movies')

const showDeleteDialog = ref(false)

const isDeleting = ref(false)

const isLoadingPreview = ref(false)

const deletePreviewItems = ref<DeletePreviewItem[]>([])

const formatDate = (dateStr?: string) => {
  if (!dateStr) {
    return '-'
  }

  return new Date(dateStr).toLocaleDateString()
}

const fetchMedia = async () => {
  switch (activeTab.value) {
    case 'movies':
      return store.fetchMovies()
    case 'series':
      return store.fetchSeries()
  }
}

// Delete handlers

const confirmDelete = async () => {
  showDeleteDialog.value = true

  isLoadingPreview.value = true

  deletePreviewItems.value = []

  try {
    const preview = await store.fetchDeletePreview()

    deletePreviewItems.value = preview
  } catch (err) {
    console.error('Failed to fetch delete preview:', err)
  } finally {
    isLoadingPreview.value = false
  }
}

const executeDelete = async () => {
  isDeleting.value = true

  try {
    await store.deleteSelected()

    showDeleteDialog.value = false
  } catch (err) {
    console.error('Delete failed:', err)
  } finally {
    isDeleting.value = false
  }
}

const cancelDelete = () => {
  showDeleteDialog.value = false
}

// User filter options
const userOptions = computed(() =>
  userStore.users.map((user) => ({ value: user.id, label: user.name })),
)

// Sort options
const sortOptions = [
  { value: 'lastWatchedAt', label: 'Last Watched' },
  { value: 'title', label: 'Title' },
  { value: 'year', label: 'Year' },
  { value: 'sizeBytes', label: 'Size' },
]

// Watch for tab/filter changes and refetch data
watch(
  [activeTab, () => store.filterUserIds, () => store.sortBy, () => store.sortOrder],

  fetchMedia,
)

const toggleSortOrder = () => {
  store.setSort(store.sortBy, store.sortOrder === 'asc' ? 'desc' : 'asc')
}

// Initialize
onMounted(async () => {
  await Promise.all([userStore.fetchUsers(), store.fetchSyncStatus()])

  await fetchMedia()

  // If sync is currently running, start polling for syncing completion
  store.startPollingIfSyncing()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h2 class="text-3xl font-extrabold text-white mb-2 tracking-tight">Watched Media</h2>
      </div>

      <div class="flex flex-col items-end gap-1">
        <!-- Sync Button -->
        <UiButton
          variant="secondary"
          :disabled="store.syncStatus?.isRunning"
          @click="store.triggerSync()"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': store.syncStatus?.isRunning }" />

          {{ store.syncStatus?.isRunning ? 'Syncing...' : 'Sync Now' }}
        </UiButton>

        <p class="text-gray-400 text-sm">
          <template v-if="store.syncStatus">
            Last synced:

            {{ store.syncStatus.lastSyncAt ? formatDate(store.syncStatus.lastSyncAt) : 'Never' }}

            <span v-if="store.syncStatus.isRunning" class="text-cyan-400 ml-2">• Syncing...</span>
          </template>
        </p>
      </div>
    </div>

    <!-- Filters -->
    <FilterBar
      v-model:filter-user-ids="store.filterUserIds"
      v-model:sort-by="store.sortBy"
      :user-options
      :sort-options
      :sort-order="store.sortOrder"
      @toggle-sort-order="toggleSortOrder"
    />

    <!-- Tabs and Bulk Actions Row -->
    <div class="flex items-center justify-between border-b border-gray-700 mb-6">
      <!-- Tabs (left side) -->
      <DashboardTabs
        v-model="activeTab"
        :movies-count="store.movies.length"
        :series-count="store.series.length"
      />

      <!-- Bulk Actions (right side) -->
      <BulkActions
        v-model:all-movies-selected="store.allMoviesSelected"
        v-model:all-episodes-selected="store.allEpisodesSelected"
        :active-tab
        :has-selection="store.hasSelection"
        :selected-movie-count="store.selectedMoviesIds.length"
        :selected-episode-count="store.selectedEpisodesIds.length"
        :has-movies="!!store.movies.length"
        :has-series="!!store.series.length"
        @delete="confirmDelete"
      />
    </div>

    <!-- Loading -->
    <div
      v-if="store.isLoading"
      class="flex flex-col items-center justify-center py-20 text-gray-400"
    >
      <Loader2 class="w-10 h-10 mb-4 animate-spin text-cyan-400" />

      Loading...
    </div>

    <!-- Movies Grid -->
    <div
      v-else-if="activeTab === 'movies'"
      class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
    >
      <MovieCard
        v-for="movie in store.movies"
        :key="movie.id"
        :model-value="store.isMovieSelected(movie.id)"
        :movie="movie"
        @update:model-value="store.selectMovie(movie.id, $event)"
      />

      <div v-if="!store.movies.length" class="col-span-full text-center py-20 text-gray-500">
        No watched movies found.
      </div>
    </div>

    <!-- Series Grid -->
    <div v-else-if="activeTab === 'series'" class="space-y-6">
      <SeriesCard
        v-for="series in store.series"
        :key="series.id"
        v-model="store.selectedEpisodesIds"
        :series
        :users="userStore.users"
      />

      <div v-if="!store.series.length" class="text-center py-20 text-gray-500">
        No watched series found.
      </div>
    </div>

    <!-- Delete Preview Modal -->
    <DeletePreviewModal
      v-if="showDeleteDialog"
      :is-loading="isLoadingPreview"
      :is-deleting="isDeleting"
      :preview-items="deletePreviewItems"
      @confirm="executeDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>
