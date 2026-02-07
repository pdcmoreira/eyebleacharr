<script setup lang="ts">
import { WatchedMovie } from '@shared/types/media'
import { useUsersNames } from '@/composables/usersNames'
import { formatSize } from '@/utils/files'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import { Clapperboard } from 'lucide-vue-next'

const selected = defineModel<boolean>({ default: false })

const { movie } = defineProps<{
  movie: WatchedMovie
}>()

const { formattedUsersNames: watchedByNames } = useUsersNames(() => movie.watchedByUserIds)
</script>

<template>
  <div
    :class="[
      'relative rounded-lg overflow-hidden cursor-pointer transition-all',
      'border-2',
      selected
        ? 'border-cyan-400 ring-2 ring-cyan-400/50'
        : 'border-transparent hover:border-gray-600',
    ]"
    @click="selected = !selected"
  >
    <div class="aspect-2/3 bg-gray-800">
      <img
        v-if="movie.posterUrl"
        :src="movie.posterUrl"
        :alt="movie.title"
        class="w-full h-full object-cover"
      />

      <div v-else class="w-full h-full flex items-center justify-center">
        <Clapperboard class="w-12 h-12 text-gray-600" />
      </div>
    </div>

    <!-- Selection indicator -->
    <div v-if="selected" class="absolute top-2 right-2 flex">
      <UiCheckbox model-value />
    </div>

    <!-- Info overlay -->
    <div class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 to-transparent p-3">
      <h3 class="text-white font-bold text-sm truncate">{{ movie.title }}</h3>

      <p class="text-gray-200 text-xs">{{ movie.year }} • {{ formatSize(movie.sizeBytes) }}</p>

      <p v-if="watchedByNames" class="text-cyan-400/80 text-xs truncate">
        Watched by {{ watchedByNames }}
      </p>
    </div>
  </div>
</template>
