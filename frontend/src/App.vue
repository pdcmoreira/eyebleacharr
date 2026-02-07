<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useSettingsStore } from '@/stores/settingsStore'
import logo from '@/assets/images/logo.svg'

const route = useRoute()

const settingsStore = useSettingsStore()

const navLinks = [
  { to: '/', label: 'Dashboard', name: 'dashboard', requiresSetup: true },
  { to: '/logs', label: 'Logs', name: 'logs', requiresSetup: true },
  { to: '/settings', label: 'Settings', name: 'settings', requiresSetup: false },
]

const isActive = (name: string) => route.name === name

const isLinkDisabled = (link: (typeof navLinks)[0]) =>
  link.requiresSetup && !settingsStore.hasCompletedSetup

const getNavLinkClasses = (link: (typeof navLinks)[0]) => {
  if (isLinkDisabled(link)) {
    return 'text-gray-600 cursor-not-allowed pointer-events-none'
  }

  if (isActive(link.name)) {
    return 'text-cyan-400'
  }

  return 'text-gray-400 hover:text-cyan-300'
}

const handleNavClick = (e: MouseEvent, link: (typeof navLinks)[0]) => {
  if (isLinkDisabled(link)) {
    e.preventDefault()
  }
}

onMounted(async () => {
  if (!settingsStore.isInitialized) {
    await settingsStore.fetchMediaServers()
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-900 text-gray-300 font-sans selection:bg-cyan-500/30">
    <!-- Header -->
    <header class="sticky top-0 z-10 border-b border-white/5 bg-gray-900/80 backdrop-blur-md py-4">
      <div class="mx-auto max-w-7xl px-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img :src="logo" alt="Eyebleacharr Logo" class="w-10 h-10" />

          <div>
            <h1 class="text-xl font-bold tracking-tight text-white m-0 leading-tight">
              Eyebleacharr
            </h1>

            <p class="text-xs text-gray-500 font-medium">Manage Watched Media</p>
          </div>
        </div>

        <nav class="flex items-center gap-6">
          <RouterLink
            v-for="link in navLinks"
            :key="link.name"
            :to="link.to"
            class="text-sm font-semibold transition-colors"
            :class="getNavLinkClasses(link)"
            @click="handleNavClick($event, link)"
          >
            {{ link.label }}
          </RouterLink>
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="mx-auto max-w-7xl px-6 py-10">
      <RouterView />
    </main>
  </div>
</template>
