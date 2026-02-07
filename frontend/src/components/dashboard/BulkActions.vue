<script setup lang="ts">
import { Trash2, Clapperboard, Tv } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'

const allMoviesSelected = defineModel<boolean>('allMoviesSelected', { required: true })

const allEpisodesSelected = defineModel<boolean>('allEpisodesSelected', { required: true })

defineProps<{
  activeTab: 'movies' | 'series'
  hasSelection: boolean
  selectedMovieCount: number
  selectedEpisodeCount: number
  hasMovies: boolean
  hasSeries: boolean
}>()

defineEmits<{
  delete: []
}>()
</script>

<template>
  <div class="flex items-center gap-3 pb-2">
    <!-- Delete Button -->
    <UiButton v-if="hasSelection" variant="primary" size="sm" @click="$emit('delete')">
      <div class="flex items-center">
        <Trash2 class="w-4 h-4 mr-1.5" />

        <span>Delete Selected (</span>

        <template v-if="selectedMovieCount > 0">
          <Clapperboard class="w-3.5 h-3.5 mr-1" />

          <span>{{ selectedMovieCount }}</span>
        </template>

        <template v-if="selectedMovieCount > 0 && selectedEpisodeCount > 0">
          <span class="mr-1.5">,</span>
        </template>

        <template v-if="selectedEpisodeCount > 0">
          <Tv class="w-3.5 h-3.5 mr-1" />

          <span>{{ selectedEpisodeCount }}</span>
        </template>

        <span>)</span>
      </div>
    </UiButton>

    <!-- Select All Checkbox -->

    <UiCheckbox
      v-if="activeTab === 'movies' && hasMovies"
      v-model="allMoviesSelected"
      label="Select all"
    />

    <UiCheckbox
      v-if="activeTab === 'series' && hasSeries"
      v-model="allEpisodesSelected"
      label="Select all"
    />
  </div>
</template>
