<script setup lang="ts">
import { computed } from 'vue'
import { WatchedEpisode } from '@shared/types/media'
import { useUserStore } from '@/stores/userStore'
import { formatSize } from '@/utils/files'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'

const selected = defineModel<boolean>('selected', { default: false })

const { episode } = defineProps<{
  episode: WatchedEpisode
}>()

const userStore = useUserStore()

const watchedByNames = computed(() =>
  episode.watchedByUserIds
    .map((id) => userStore.users.find((u) => u.id === id)?.name ?? id)
    .join(', '),
)
</script>

<template>
  <div
    class="flex items-center gap-3 p-2 rounded cursor-pointer transition-colors"
    :class="[
      selected
        ? 'bg-cyan-400/20 border border-cyan-400'
        : 'bg-gray-700/30 hover:bg-gray-700/50 border border-transparent',
    ]"
    @click="selected = !selected"
  >
    <UiCheckbox :model-value="selected" />

    <div class="flex-1 min-w-0">
      <p class="text-white text-sm truncate">
        S{{ String(episode.seasonNumber).padStart(2, '0') }}E{{
          String(episode.episodeNumber).padStart(2, '0')
        }}

        <span v-if="episode.title" class="text-gray-400">- {{ episode.title }}</span>
      </p>

      <p class="text-gray-500 text-xs">
        {{ formatSize(episode.sizeBytes) }}

        <span v-if="watchedByNames" class="text-cyan-400/60"> • {{ watchedByNames }} </span>
      </p>
    </div>
  </div>
</template>
