<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon'
  size?: 'sm' | 'md'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>()

const sizeClasses = computed(() => {
  const size = props.size || 'md'

  const isIcon = props.variant === 'icon'

  if (size === 'sm') {
    return isIcon ? 'h-8 w-8 p-0 text-xs' : 'h-8 px-3 text-xs'
  }

  return isIcon ? 'h-[38px] w-[38px] p-0 text-sm' : 'h-[38px] px-4 text-sm'
})

const variantClasses = computed(() => {
  const variant = props.variant || 'secondary'

  switch (variant) {
    case 'primary':
      return 'bg-cyan-600 text-white hover:enabled:bg-cyan-500'
    case 'secondary':
      return 'bg-gray-700 text-white hover:enabled:bg-gray-600'
    case 'danger':
      return 'bg-red-600/20 text-red-400 hover:enabled:bg-red-600/40'
    case 'ghost':
      return 'bg-gray-800 border-gray-700 text-white hover:enabled:bg-gray-700'
    case 'icon':
      return 'bg-gray-800 border-gray-700 text-white hover:enabled:bg-gray-700'
    default:
      return 'bg-gray-700 text-white hover:enabled:bg-gray-600'
  }
})
</script>

<template>
  <button
    :type="type || 'button'"
    :disabled
    class="inline-flex items-center justify-center gap-2 font-medium rounded-lg cursor-pointer transition-colors duration-150 whitespace-nowrap border border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
    :class="[sizeClasses, variantClasses]"
  >
    <slot />
  </button>
</template>
