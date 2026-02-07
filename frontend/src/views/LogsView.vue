<script setup lang="ts">
import LogViewer from '@/components/logs/LogViewer.vue'
</script>

<template>
  <div>
    <div class="mb-10">
      <h2 class="text-3xl font-extrabold text-white mb-2 tracking-tight">System Logs</h2>

      <p class="text-gray-400 max-w-2xl">
        Real-time monitoring of application events, errors, and system health. Filter by level or
        search through historical data.
      </p>
    </div>

    <LogViewer />
  </div>
</template>
