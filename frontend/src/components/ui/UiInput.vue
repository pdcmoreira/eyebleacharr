<script setup lang="ts">
defineProps<{
  type?: 'text' | 'password' | 'email' | 'url' | 'number'
  modelValue: string | number
  placeholder?: string
  required?: boolean
  disabled?: boolean
  label?: string
  min?: number
  max?: number
}>()

defineEmits<{
  'update:modelValue': [value: string | number]
}>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" class="text-gray-400 text-sm">{{ label }}</label>

    <input
      :type="type || 'text'"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :min="min"
      :max="max"
      class="h-9.5 px-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm transition-colors focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
