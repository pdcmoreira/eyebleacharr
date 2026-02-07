<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { LogEntry, LogFilters } from '@shared/types/logs'
import { formatTimestamp } from '@shared/utils/date'
import { logsService } from '@/services/logsService'
import LogFiltersComponent from '@/components/logs/LogFilters.vue'
import { ScrollText, Inbox } from 'lucide-vue-next'

const AUTO_REFRESH_LOGS_INTERVAL_MS = 30000

const logs = ref<LogEntry[]>([])

const loading = ref(false)

const filters = ref<LogFilters>({
  search: '',
  levels: ['INFO', 'WARNING', 'ERROR'],
  limit: 50,
})

const fetchLogs = async () => {
  try {
    loading.value = true

    const data = await logsService.getLogs(filters.value)

    logs.value = data
  } catch (error) {
    console.error('Failed to fetch logs:', error)
  } finally {
    loading.value = false
  }
}

const clearLog = async () => {
  if (!confirm('Are you sure you want to clear all logs?')) {
    return
  }

  try {
    loading.value = true

    await logsService.clearLogs()

    logs.value = []
  } catch (error) {
    console.error('Failed to clear log:', error)
  } finally {
    loading.value = false
  }
}

let refreshInterval: ReturnType<typeof setInterval>

onMounted(() => {
  fetchLogs()

  refreshInterval = setInterval(fetchLogs, AUTO_REFRESH_LOGS_INTERVAL_MS)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})

// Formatting

const getLevelClass = (level: string) => {
  level = level.toUpperCase()

  if (level === 'ERROR') {
    return 'text-red-400 font-bold'
  }

  if (level === 'WARNING' || level === 'WARN') {
    return 'text-yellow-400 font-bold'
  }

  if (level === 'DEBUG') {
    return 'text-gray-500'
  }

  return 'text-sky-400'
}
</script>

<template>
  <div>
    <LogFiltersComponent
      v-model="filters"
      :loading="loading"
      @search="fetchLogs"
      @clear="clearLog"
    />

    <div
      class="mb-8 overflow-hidden rounded-lg border border-gray-700 bg-black/40 backdrop-blur-sm shadow-2xl"
    >
      <div
        class="flex items-center justify-between border-b border-gray-700 bg-gray-800/50 px-5 py-3"
      >
        <h2 class="text-lg font-bold text-cyan-400 flex items-center gap-2">
          <ScrollText class="w-5 h-5" /> Log Stream (last {{ filters.limit }} entries)
        </h2>
        <div
          v-if="loading"
          class="animate-pulse text-xs text-cyan-400/60 uppercase tracking-widest font-bold"
        >
          Syncing...
        </div>
      </div>

      <div class="max-h-150 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
        <div v-if="logs.length" class="space-y-1">
          <div
            v-for="log in logs"
            :key="log.id"
            class="group flex gap-3 rounded px-2 py-0.5 transition-colors hover:bg-white/5"
          >
            <span class="shrink-0 text-gray-600">[{{ formatTimestamp(log.createdAt) }}]</span>

            <span :class="getLevelClass(log.level)" class="shrink-0 w-16"
              >[{{ log.level.toUpperCase() }}]</span
            >

            <span class="text-gray-300 wrap-break-word">{{ log.message }}</span>

            <span
              v-if="log.source"
              class="text-gray-500 italic shrink-0 hidden md:inline opacity-40 group-hover:opacity-100"
              >@ {{ log.source }}</span
            >
          </div>
        </div>

        <div
          v-else-if="!loading"
          class="flex flex-col items-center justify-center py-20 text-gray-600 italic"
        >
          <Inbox class="w-12 h-12 mb-4" />

          <p>No log entries found for the selected filters.</p>
        </div>
      </div>
    </div>
  </div>
</template>
