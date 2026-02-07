<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Option {
  value: string
  label: string
}

const props = defineProps<{
  options: Option[]
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const dropdownRef = ref<HTMLElement | null>(null)

const isOpen = ref(false)

const selectedLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue)

  return opt?.label || props.placeholder || 'Select...'
})

const selectOption = (value: string) => {
  emit('update:modelValue', value)
  isOpen.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="dropdownRef" class="relative inline-block min-w-35">
    <!-- Trigger Button -->
    <button
      type="button"
      class="flex items-center justify-between gap-2 w-full h-9.5 px-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm cursor-pointer transition-colors hover:bg-gray-700 focus:outline-none focus:border-cyan-400"
      @click="isOpen = !isOpen"
    >
      <span class="truncate">{{ selectedLabel }}</span>
      <svg
        class="w-4 h-4 shrink-0 transition-transform"
        :class="{ 'rotate-180': isOpen }"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <!-- Dropdown -->
    <div
      v-if="isOpen"
      class="absolute top-[calc(100%+4px)] left-0 right-0 min-w-35 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden"
    >
      <div class="max-h-50 overflow-y-auto">
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          class="block w-full px-3 py-2 text-left text-white text-sm bg-transparent border-none cursor-pointer transition-colors"
          :class="
            option.value === modelValue
              ? 'bg-cyan-400/20 text-cyan-400 hover:bg-cyan-400/30'
              : 'hover:bg-gray-700'
          "
          @click="selectOption(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  </div>
</template>
