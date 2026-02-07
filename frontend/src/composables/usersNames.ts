import { computed, MaybeRefOrGetter, toValue } from 'vue'
import { useUserStore } from '@/stores/userStore'

export function useUsersNames(usersIds: MaybeRefOrGetter<string[]>) {
  const userStore = useUserStore()

  const usersNames = computed<string[]>(() =>
    Array.from(new Set(toValue(usersIds))).map(
      (id) => userStore.users.find((u) => u.id === id)?.name ?? id,
    ),
  )

  const formattedUsersNames = computed(() => usersNames.value.join(', '))

  return {
    usersNames,
    formattedUsersNames,
  }
}
