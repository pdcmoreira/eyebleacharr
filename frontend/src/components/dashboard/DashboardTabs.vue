<script setup lang="ts">
import { Clapperboard, Tv } from 'lucide-vue-next'

type Tab = 'movies' | 'series'

const activeTab = defineModel<Tab>({ required: true })

defineProps<{
  moviesCount: number
  seriesCount: number
}>()

const getTabClasses = (tab: Tab) =>
  tab === activeTab.value
    ? 'text-cyan-400 border-b-2 border-cyan-400'
    : 'text-gray-400 hover:text-white'
</script>

<template>
  <div class="flex">
    <button
      class="px-6 py-3 font-semibold transition-colors flex items-center gap-2 cursor-pointer"
      :class="getTabClasses('movies')"
      @click="activeTab = 'movies'"
    >
      <Clapperboard class="w-4 h-4" />

      <span>Movies ({{ moviesCount }})</span>
    </button>

    <button
      class="px-6 py-3 font-semibold transition-colors flex items-center gap-2 cursor-pointer"
      :class="getTabClasses('series')"
      @click="activeTab = 'series'"
    >
      <Tv class="w-4 h-4" />

      <span>Series ({{ seriesCount }})</span>
    </button>
  </div>
</template>
