<script setup lang="ts">
import { computed } from 'vue'
import { DeletePreviewItem } from '@shared/types/media'
import UiButton from '@/components/ui/UiButton.vue'
import UiModal from '@/components/ui/UiModal.vue'
import { Loader2, Film, Tv, ExternalLink } from 'lucide-vue-next'

const props = defineProps<{
  isLoading: boolean
  isDeleting: boolean
  previewItems: DeletePreviewItem[]
}>()

defineEmits<{
  confirm: []
  cancel: []
}>()

// Group items by delete method for summary
const summary = computed(() => {
  const result = {
    radarr: 0,
    sonarr: 0,
    jellyfin: 0,
  }

  for (const item of props.previewItems) {
    result[item.deleteMethod]++
  }

  return result
})

const methodLabel = (method: string) => {
  switch (method) {
    case 'radarr':
      return 'Radarr'
    case 'sonarr':
      return 'Sonarr'
    case 'jellyfin':
      return 'Jellyfin'
    default:
      return method
  }
}

const methodClass = (method: string) => {
  switch (method) {
    case 'radarr':
      return 'bg-orange-500/20 text-orange-400'
    case 'sonarr':
      return 'bg-blue-500/20 text-blue-400'
    case 'jellyfin':
      return 'bg-purple-500/20 text-purple-400'
    default:
      return 'bg-gray-500/20 text-gray-400'
  }
}
</script>

<template>
  <UiModal title="Confirm Deletion" size="md" @close="$emit('cancel')">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-12 text-gray-400">
      <Loader2 class="w-8 h-8 mb-4 animate-spin text-cyan-400" />

      Loading preview...
    </div>

    <!-- Preview content -->
    <div v-else>
      <!-- Summary -->
      <div class="mb-4 p-3 bg-gray-800 rounded-lg">
        <p class="text-gray-300 mb-2">
          <strong>{{ previewItems.length }}</strong> items will be deleted:
        </p>

        <div class="flex flex-wrap gap-2">
          <span
            v-if="summary.radarr > 0"
            class="px-2 py-1 rounded text-sm bg-orange-500/20 text-orange-400"
          >
            {{ summary.radarr }} via Radarr
          </span>

          <span
            v-if="summary.sonarr > 0"
            class="px-2 py-1 rounded text-sm bg-blue-500/20 text-blue-400"
          >
            {{ summary.sonarr }} via Sonarr
          </span>

          <span
            v-if="summary.jellyfin > 0"
            class="px-2 py-1 rounded text-sm bg-purple-500/20 text-purple-400"
          >
            {{ summary.jellyfin }} via Jellyfin
          </span>
        </div>
      </div>

      <!-- Item list -->
      <div class="max-h-64 overflow-y-auto space-y-2">
        <div
          v-for="item in previewItems"
          :key="`${item.type}-${item.id}`"
          class="flex items-center justify-between p-2 bg-gray-800/50 rounded"
        >
          <div class="flex items-center gap-2 min-w-0 mr-4">
            <Film v-if="item.type === 'movie'" class="w-4 h-4 text-gray-400 shrink-0" />

            <Tv v-else class="w-4 h-4 text-gray-400 shrink-0" />

            <div class="min-w-0">
              <p class="text-gray-200 text-sm truncate">
                <span v-if="item.seriesTitle">{{ item.seriesTitle }} - </span>

                <span v-if="item.seasonEpisode" class="text-gray-400">
                  {{ item.seasonEpisode }}
                </span>

                {{ item.title }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <span class="px-2 py-0.5 rounded text-xs" :class="methodClass(item.deleteMethod)">
              {{ methodLabel(item.deleteMethod) }}
            </span>

            <a
              v-if="item.externalUrl"
              :href="item.externalUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-gray-400 hover:text-cyan-400 transition-colors"
              title="Open in app"
            >
              <ExternalLink class="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <p class="mt-4 text-gray-400 text-sm">
        This will permanently remove the files from your server.
      </p>
    </div>

    <template #footer>
      <UiButton variant="secondary" :disabled="isDeleting || isLoading" @click="$emit('cancel')">
        Cancel
      </UiButton>

      <UiButton variant="danger" :disabled="isDeleting || isLoading" @click="$emit('confirm')">
        {{ isDeleting ? 'Deleting...' : 'Delete' }}
      </UiButton>
    </template>
  </UiModal>
</template>
