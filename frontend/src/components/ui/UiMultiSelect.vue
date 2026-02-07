<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Option {
  value: string
  label: string
}

const props = defineProps<{
  options: Option[]
  modelValue: string[]
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const dropdownRef = ref<HTMLElement | null>(null)

const isDisabled = computed(() => props.disabled || !props.options.length)

const isOpen = ref(false)

const selectedLabels = computed(() => {
  if (!props.modelValue.length) {
    return props.placeholder || 'All'
  }

  if (props.modelValue.length === 1) {
    const opt = props.options.find((o) => o.value === props.modelValue[0])

    return opt?.label || props.modelValue[0]
  }

  return `${props.modelValue.length} selected`
})

const isSelected = (value: string) => props.modelValue.includes(value)

const toggleOption = (value: string) => {
  const newValue = isSelected(value)
    ? props.modelValue.filter((v) => v !== value)
    : [...props.modelValue, value]

  emit('update:modelValue', newValue)
}

const selectAll = () => {
  emit(
    'update:modelValue',
    props.options.map((o) => o.value),
  )
}

const clearAll = () => {
  emit('update:modelValue', [])
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
  <div ref="dropdownRef" class="relative inline-block min-w-40">
    <!-- Trigger Button -->
    <button
      type="button"
      :disabled="isDisabled"
      class="flex items-center justify-between gap-2 w-full h-9.5 px-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm cursor-pointer transition-colors hover:bg-gray-700 focus:outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
      @click="isOpen = !isOpen"
    >
      <span class="truncate">{{ selectedLabels }}</span>

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
      class="absolute top-[calc(100%+4px)] left-0 right-0 min-w-45 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden"
    >
      <!-- Quick actions -->
      <div class="flex gap-2 p-2 border-b border-gray-700">
        <button
          type="button"
          class="flex-1 px-2 py-1 text-xs text-gray-400 bg-transparent border-none rounded hover:bg-gray-700 hover:text-white transition-colors cursor-pointer"
          @click="selectAll"
        >
          Select all
        </button>

        <button
          type="button"
          class="flex-1 px-2 py-1 text-xs text-gray-400 bg-transparent border-none rounded hover:bg-gray-700 hover:text-white transition-colors cursor-pointer"
          @click="clearAll"
        >
          Clear
        </button>
      </div>

      <!-- Options -->
      <div class="max-h-50 overflow-y-auto">
        <label
          v-for="option in options"
          :key="option.value"
          class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-gray-700"
          @click.prevent="toggleOption(option.value)"
        >
          <input
            type="checkbox"
            :checked="isSelected(option.value)"
            class="w-4 h-4 accent-cyan-400 cursor-pointer"
            @click.prevent
          />
          <span class="text-white text-sm">{{ option.label }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
