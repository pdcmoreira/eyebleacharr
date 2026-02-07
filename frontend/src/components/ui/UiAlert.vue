<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next'
</script>

<template>
  <div
    class="bg-linear-to-r from-amber-500/20 to-orange-500/20 border-b border-amber-500/30 p-3 flex items-center gap-3"
  >
    <AlertCircle class="w-5 h-5 text-amber-400 shrink-0" />

    <p class="text-sm text-amber-200">
      <slot />
    </p>
  </div>
</template>
