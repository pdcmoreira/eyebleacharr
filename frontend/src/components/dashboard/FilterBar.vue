<script setup lang="ts">
import UiMultiSelect from '@/components/ui/UiMultiSelect.vue'
import UiSingleSelect from '@/components/ui/UiSingleSelect.vue'
import UiButton from '@/components/ui/UiButton.vue'

const filterUserIds = defineModel<string[]>('filterUserIds', { required: true })

const sortBy = defineModel<string>('sortBy', { required: true })

defineProps<{
  userOptions: { value: string; label: string }[]
  sortOptions: { value: string; label: string }[]
  sortOrder: 'asc' | 'desc'
}>()

defineEmits<{
  toggleSortOrder: []
}>()
</script>

<template>
  <div class="mb-6 flex items-center gap-4">
    <label class="text-gray-400 text-sm">Filter by user:</label>

    <UiMultiSelect v-model="filterUserIds" :options="userOptions" placeholder="All users" />

    <label class="text-gray-400 text-sm ml-4">Sort by:</label>

    <UiSingleSelect v-model="sortBy" :options="sortOptions" />

    <UiButton
      variant="icon"
      :title="sortOrder === 'asc' ? 'Ascending' : 'Descending'"
      @click="$emit('toggleSortOrder')"
    >
      <svg
        class="w-4 h-4 transition-transform"
        :class="{ 'rotate-180': sortOrder === 'desc' }"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
          clip-rule="evenodd"
        />
      </svg>
    </UiButton>
  </div>
</template>
