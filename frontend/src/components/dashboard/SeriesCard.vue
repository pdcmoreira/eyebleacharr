<script setup lang="ts">
import { computed } from 'vue'
import { WatchedSeries } from '@shared/types/media'
import { useSelection } from '@/composables/selection'
import { useUsersNames } from '@/composables/usersNames'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import EpisodeItem from '@/components/dashboard/EpisodeItem.vue'
import { Tv } from 'lucide-vue-next'

const selectedEpisodeIds = defineModel<number[]>({ required: true })

const { series } = defineProps<{
  series: WatchedSeries
}>()

const { allSelected, isSelected, select } = useSelection(
  computed(() => series.episodes.map((e) => e.id)),
  selectedEpisodeIds,
)

const { formattedUsersNames: watchedByNames } = useUsersNames(
  computed(() => series.episodes.flatMap((e) => e.watchedByUserIds)),
)
</script>

<template>
  <div class="bg-gray-800/50 rounded-lg overflow-hidden">
    <!-- Series Header -->
    <div class="flex items-center gap-4 p-4 border-b border-gray-700">
      <div class="w-16 h-24 bg-gray-700 rounded overflow-hidden shrink-0">
        <img
          v-if="series.posterUrl"
          :src="series.posterUrl"
          :alt="series.title"
          class="w-full h-full object-cover"
        />

        <div v-else class="w-full h-full flex items-center justify-center">
          <Tv class="w-8 h-8 text-gray-600" />
        </div>
      </div>

      <div class="flex-1">
        <h3 class="text-white font-bold text-lg">{{ series.title }}</h3>

        <p class="text-gray-400 text-sm">
          {{ series.year }} • {{ series.episodes.length }} watched episodes
        </p>

        <p v-if="watchedByNames" class="text-cyan-400/80 text-sm">
          Watched by {{ watchedByNames }}
        </p>
      </div>

      <div class="px-3 py-2 rounded bg-gray-700/50 flex items-center" @click.stop>
        <UiCheckbox v-model="allSelected" label="Select all" />
      </div>
    </div>

    <!-- Episodes -->
    <div class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
      <EpisodeItem
        v-for="episode in series.episodes"
        :key="episode.id"
        :episode="episode"
        :selected="isSelected(episode.id)"
        @update:selected="select(episode.id, $event)"
      />
    </div>
  </div>
</template>
