<script setup lang="ts">
const modelValue = defineModel<boolean>({ default: false })

defineProps<{
  label?: string
  disabled?: boolean
  id?: string
}>()
</script>

<template>
  <div
    class="group inline-flex cursor-pointer select-none items-center gap-2"
    :class="{ 'pointer-events-none cursor-not-allowed opacity-50': disabled }"
    @click.stop="modelValue = !modelValue"
  >
    <div
      :id="id"
      class="flex h-5 min-h-5 w-5 min-w-5 shrink-0 items-center justify-center rounded border-2 transition-all duration-150 ease-out"
      :class="
        modelValue
          ? 'border-cyan-400 bg-cyan-400'
          : 'border-gray-500 bg-transparent group-hover:border-gray-400'
      "
    >
      <span
        class="text-xs font-bold leading-none text-black"
        :class="modelValue ? 'opacity-100' : 'opacity-0'"
        >✓</span
      >
    </div>

    <span v-if="label" class="text-sm text-gray-300">{{ label }}</span>

    <slot v-else />
  </div>
</template>
