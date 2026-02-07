import { createRouter, createWebHistory } from 'vue-router'
import { useSettingsStore } from '@/stores/settingsStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { requiresSetup: true },
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('@/views/LogsView.vue'),
      meta: { requiresSetup: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
  ],
})

// Navigation guard: redirect to settings if setup not complete
router.beforeEach(async (to) => {
  const store = useSettingsStore()

  // Ensure we've loaded the media servers data
  if (!store.isInitialized) {
    await store.fetchMediaServers()
  }

  // Redirect to settings if route requires setup and no media servers exist
  if (to.meta.requiresSetup && !store.hasCompletedSetup) {
    return { name: 'settings' }
  }
})

export default router
