<script setup lang="ts">
import { ref, computed } from 'vue'

const { title, size = 'sm' } = defineProps<{
  title?: string
  size?: 'sm' | 'md' | 'lg'
}>()

const emit = defineEmits<{
  close: []
}>()

const sizeClasses = computed(() => ({
  'max-w-2xl': size === 'md',
  'max-w-4xl': size === 'lg',
  'max-w-md': size === 'sm',
}))

// Track if the mousedown started on the backdrop to prevent closing
// when the user clicks inside the modal and drags outside
const mouseDownOnBackdrop = ref(false)

function handleMouseDown(event: MouseEvent) {
  mouseDownOnBackdrop.value = event.target === event.currentTarget
}

function handleClick(event: MouseEvent) {
  if (mouseDownOnBackdrop.value && event.target === event.currentTarget) {
    emit('close')
  }

  mouseDownOnBackdrop.value = false
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @mousedown="handleMouseDown"
      @click="handleClick"
    >
      <div
        class="bg-gray-800 rounded-xl w-[calc(100%-2rem)] m-4 shadow-2xl border border-gray-700 overflow-hidden text-left"
        :class="sizeClasses"
      >
        <div v-if="title" class="px-6 pt-6">
          <h3 class="text-xl font-bold text-white m-0">{{ title }}</h3>
        </div>

        <div class="p-6">
          <slot />
        </div>

        <div v-if="$slots.footer" class="px-6 pb-6 flex justify-end gap-3">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
