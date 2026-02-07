<script setup lang="ts">
import { LogFilters } from '@shared/types/logs'
import UiButton from '@/components/ui/UiButton.vue'
import { Eraser } from 'lucide-vue-next'

const logFilters = defineModel<LogFilters>({ required: true })

defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  search: []
  clear: []
}>()

// Debounced emit of search event

let searchTimeout: ReturnType<typeof setTimeout>

const debouncedSearch = () => {
  clearTimeout(searchTimeout)

  searchTimeout = setTimeout(() => {
    emit('search')
  }, 300)
}

// Input bindings

const updateSearch = (search: string) => {
  logFilters.value = { ...logFilters.value, search }

  debouncedSearch()
}

const updateLimit = (limit: number) => {
  logFilters.value = { ...logFilters.value, limit }

  emit('search')
}

const toggleLevel = (level: string) => {
  const currentLevels = logFilters.value.levels

  const levels = currentLevels.includes(level)
    ? currentLevels.filter((l) => l !== level)
    : [...currentLevels, level]

  logFilters.value = { ...logFilters.value, levels }

  emit('search')
}
</script>

<template>
  <div class="bg-gray-800 rounded-lg p-5 mb-8">
    <div class="flex flex-wrap gap-5 mb-5">
      <div class="flex flex-col gap-1">
        <label class="font-bold text-gray-300 text-sm">Search:</label>

        <input
          :value="logFilters.search"
          type="text"
          placeholder="Search logs..."
          class="font-mono px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400 text-sm"
          @input="updateSearch(($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="font-bold text-gray-300 text-sm">Log Levels:</label>

        <div class="flex gap-3 flex-wrap items-center h-full">
          <label
            v-for="level in ['DEBUG', 'INFO', 'WARNING', 'ERROR']"
            :key="level"
            class="flex items-center gap-2 font-normal text-xs cursor-pointer select-none"
          >
            <input
              type="checkbox"
              :value="level"
              :checked="logFilters.levels.includes(level)"
              class="rounded border-gray-600 text-cyan-400 focus:ring-cyan-400 bg-gray-700 w-4 h-4"
              @change="toggleLevel(level)"
            />

            {{ level }}
          </label>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="font-bold text-gray-300 text-sm">Limit:</label>

        <input
          :value="logFilters.limit"
          type="number"
          min="10"
          max="5000"
          class="font-mono px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400 text-sm w-24"
          @change="updateLimit(parseInt(($event.target as HTMLInputElement).value) || 50)"
        />
      </div>
    </div>

    <div class="flex flex-wrap gap-4">
      <UiButton variant="ghost" size="sm" :disabled="loading" @click="$emit('clear')">
        <Eraser class="w-4 h-4" /> Clear Log
      </UiButton>
    </div>
  </div>
</template>
