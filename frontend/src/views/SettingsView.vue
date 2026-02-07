<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ArrService, MediaServer } from '@shared/types/settings'
import { ArrServiceType } from '@shared/types/enums'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUserStore } from '@/stores/userStore'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiMultiSelect from '@/components/ui/UiMultiSelect.vue'
import UiAlert from '@/components/ui/UiAlert.vue'
import { Tv, Clapperboard, Users, Key } from 'lucide-vue-next'

const settingsStore = useSettingsStore()

const userStore = useUserStore()

// Hidden users state
const selectedHiddenUserIds = ref<string[]>([])

// Form states
const showMediaServerForm = ref(false)

const showArrServiceForm = ref(false)

const editingMediaServer = ref<MediaServer | null>(null)

const editingArrService = ref<ArrService | null>(null)

// Error states
const arrServiceError = ref<string | null>(null)

// Test results
const testResults = ref<Record<string, { success: boolean; message: string }>>({})

// Computed: single instances from arrays

const mediaServer = computed(() => settingsStore.mediaServers[0] ?? null)

const radarr = computed(
  () => settingsStore.arrServices.find((s) => s.type === ArrServiceType.RADARR) ?? null,
)

const sonarr = computed(
  () => settingsStore.arrServices.find((s) => s.type === ArrServiceType.SONARR) ?? null,
)

// Media Server form (no isActive, no name - just URL and API key)
interface MediaServerFormData {
  url: string
  apiKey: string
}

const mediaServerForm = ref<MediaServerFormData>({
  url: '',
  apiKey: '',
})

// Arr Service form (simplified - no name, no type selector)
interface ArrServiceFormData {
  url: string
  apiKey: string
  isActive: boolean
}

const arrServiceForm = ref<ArrServiceFormData>({
  url: '',
  apiKey: '',
  isActive: true,
})

// Media Server handlers
const openMediaServerForm = (server?: MediaServer) => {
  if (server) {
    editingMediaServer.value = server

    mediaServerForm.value = {
      url: server.url,
      apiKey: server.apiKey,
    }
  } else {
    editingMediaServer.value = null

    mediaServerForm.value = {
      url: '',
      apiKey: '',
    }
  }

  showMediaServerForm.value = true
}

const saveMediaServer = async () => {
  try {
    if (editingMediaServer.value) {
      await settingsStore.updateMediaServer(editingMediaServer.value.id, mediaServerForm.value)
    } else {
      await settingsStore.createMediaServer(mediaServerForm.value)
    }

    showMediaServerForm.value = false
  } catch (err) {
    console.error('Failed to save media server:', err)
  }
}

const deleteMediaServer = async (id: number) => {
  if (!confirm('Are you sure you want to delete this media server?')) {
    return
  }

  try {
    await settingsStore.deleteMediaServer(id)
  } catch (err) {
    console.error('Failed to delete media server:', err)
  }
}

const testMediaServer = async (id: number) => {
  testResults.value[`media-${id}`] = { success: false, message: 'Testing...' }

  const result = await settingsStore.testMediaServer(id)

  testResults.value[`media-${id}`] = result
}

// Arr Service handlers
const openArrServiceForm = (service?: ArrService) => {
  arrServiceError.value = null

  if (service) {
    editingArrService.value = service

    arrServiceForm.value = {
      url: service.url,
      apiKey: service.apiKey,
      isActive: service.isActive,
    }
  } else {
    editingArrService.value = null

    arrServiceForm.value = {
      url: '',
      apiKey: '',
      isActive: true,
    }
  }

  showArrServiceForm.value = true
}

const saveArrService = async () => {
  arrServiceError.value = null

  try {
    if (editingArrService.value) {
      await settingsStore.updateArrService(editingArrService.value.id, arrServiceForm.value)
    } else {
      await settingsStore.createArrService(arrServiceForm.value)
    }

    showArrServiceForm.value = false
  } catch (err: unknown) {
    // Extract error message from ApiError or fall back to generic message
    const message = err instanceof Error ? err.message : 'Unknown error'

    arrServiceError.value = message

    console.error('Failed to save arr service:', err)
  }
}

const deleteArrService = async (id: number) => {
  if (!confirm('Are you sure you want to delete this service?')) {
    return
  }

  try {
    await settingsStore.deleteArrService(id)
  } catch (err) {
    console.error('Failed to delete arr service:', err)
  }
}

const testArrService = async (id: number) => {
  testResults.value[`arr-${id}`] = { success: false, message: 'Testing...' }

  const result = await settingsStore.testArrService(id)

  testResults.value[`arr-${id}`] = result
}

const toggleArrServiceActive = async (service: ArrService) => {
  try {
    await settingsStore.updateArrService(service.id, { isActive: !service.isActive })
  } catch (err) {
    console.error('Failed to toggle arr service:', err)
  }
}

// Hidden users handlers
const allUserOptions = computed(() =>
  userStore.users.map((user) => ({ value: user.id, label: user.name })),
)

const saveHiddenUsers = async () => {
  try {
    await settingsStore.saveHiddenUsers(selectedHiddenUserIds.value)
  } catch (err) {
    console.error('Failed to save hidden users:', err)
  }
}

// TMDB API Key handlers
const tmdbApiKeyInput = ref('')

const saveTmdbApiKey = async () => {
  try {
    await settingsStore.saveTmdbApiKey(tmdbApiKeyInput.value)

    testResults.value['tmdb'] = { success: true, message: 'Saved!' }
  } catch (err) {
    console.error('Failed to save TMDB API key:', err)
  }
}

const testTmdbConnection = async () => {
  const keyToTest = tmdbApiKeyInput.value || settingsStore.tmdbApiKey

  if (!keyToTest) {
    testResults.value['tmdb'] = { success: false, message: 'No API key provided' }

    return
  }

  testResults.value['tmdb'] = { success: false, message: 'Testing...' }

  const result = await settingsStore.testTmdbConnection(keyToTest)

  testResults.value['tmdb'] = result
}

onMounted(async () => {
  await Promise.all([
    settingsStore.fetchMediaServers(),
    settingsStore.fetchArrServices(),
    settingsStore.fetchHiddenUsers(),
    settingsStore.fetchTmdbApiKey(),
    userStore.fetchAllUsers(),
  ])

  // Initialize local state from store

  selectedHiddenUserIds.value = [...settingsStore.hiddenUserIds]

  tmdbApiKeyInput.value = settingsStore.tmdbApiKey
})
</script>

<template>
  <div>
    <div class="mb-10">
      <h2 class="text-3xl font-extrabold text-white mb-2 tracking-tight">
        {{
          settingsStore.isInitialized && !settingsStore.hasCompletedSetup
            ? 'Welcome to Eyebleacharr!'
            : 'Settings'
        }}
      </h2>

      <p class="text-gray-400">Configure your media server and *arr services.</p>

      <UiAlert v-if="settingsStore.isInitialized && !settingsStore.hasCompletedSetup" class="mt-4">
        To get started, please configure a Jellyfin server below.
      </UiAlert>
    </div>

    <!-- Media Server Section (Single Card) -->
    <section class="mb-12">
      <h3 class="text-xl font-bold text-white flex items-center gap-2 mb-4">
        <Tv class="w-5 h-5" /> Jellyfin Server
        <span v-if="!mediaServer" class="text-xs text-amber-400 ml-2">(Required)</span>
      </h3>

      <div class="bg-gray-800/50 rounded-lg p-6">
        <!-- Not configured state -->
        <div v-if="!mediaServer" class="text-center">
          <p class="text-gray-400 mb-4">No Jellyfin server configured.</p>

          <UiButton
            variant="primary"
            class="animate-pulse ring-2 ring-cyan-400"
            @click="openMediaServerForm()"
          >
            Configure Jellyfin
          </UiButton>
        </div>

        <!-- Configured state -->
        <div v-else class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-3 h-3 rounded-full bg-green-500" />

            <div>
              <p class="text-white font-medium">Jellyfin</p>

              <p class="text-gray-400 text-sm">{{ mediaServer.url }}</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span
              v-if="testResults[`media-${mediaServer.id}`]"
              class="text-sm px-2 py-1 rounded"
              :class="[
                testResults[`media-${mediaServer.id}`].success
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400',
              ]"
            >
              {{ testResults[`media-${mediaServer.id}`].message }}
            </span>

            <UiButton size="sm" variant="secondary" @click="testMediaServer(mediaServer.id)">
              Test
            </UiButton>

            <UiButton size="sm" variant="secondary" @click="openMediaServerForm(mediaServer)">
              Edit
            </UiButton>

            <UiButton size="sm" variant="danger" @click="deleteMediaServer(mediaServer.id)">
              Delete
            </UiButton>
          </div>
        </div>
      </div>
    </section>

    <!-- Arr Services Section (Two Cards: Radarr & Sonarr) -->
    <section class="mb-12">
      <h3 class="text-xl font-bold text-white flex items-center gap-2 mb-4">
        <Clapperboard class="w-5 h-5" /> *arr Services
      </h3>

      <p class="text-gray-400 text-sm mb-4">
        Configure Radarr/Sonarr to delete media via their APIs. When disabled, deletion falls back
        to Jellyfin API.
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Radarr Card -->
        <div class="bg-gray-800/50 rounded-lg p-6">
          <h4 class="text-lg font-semibold text-white mb-4">Radarr (Movies)</h4>

          <!-- Not configured -->
          <div v-if="!radarr" class="text-center">
            <p class="text-gray-500 text-sm mb-4">Not configured</p>

            <UiButton variant="secondary" @click="openArrServiceForm()">
              Configure Radarr
            </UiButton>
          </div>

          <!-- Configured -->
          <div v-else>
            <div class="flex items-center gap-3 mb-4">
              <div
                :class="['w-3 h-3 rounded-full', radarr.isActive ? 'bg-green-500' : 'bg-gray-500']"
              />

              <p class="text-gray-400 text-sm flex-1 truncate">{{ radarr.url }}</p>
            </div>

            <div class="flex items-center justify-between">
              <UiCheckbox
                :model-value="radarr.isActive"
                label="Active"
                @update:model-value="toggleArrServiceActive(radarr)"
              />

              <div class="flex items-center gap-2">
                <span
                  v-if="testResults[`arr-${radarr.id}`]"
                  class="text-xs px-2 py-1 rounded"
                  :class="[
                    testResults[`arr-${radarr.id}`].success
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400',
                  ]"
                >
                  {{ testResults[`arr-${radarr.id}`].message }}
                </span>

                <UiButton size="sm" variant="secondary" @click="testArrService(radarr.id)">
                  Test
                </UiButton>

                <UiButton size="sm" variant="secondary" @click="openArrServiceForm(radarr)">
                  Edit
                </UiButton>

                <UiButton size="sm" variant="danger" @click="deleteArrService(radarr.id)">
                  Delete
                </UiButton>
              </div>
            </div>
          </div>
        </div>

        <!-- Sonarr Card -->
        <div class="bg-gray-800/50 rounded-lg p-6">
          <h4 class="text-lg font-semibold text-white mb-4">Sonarr (Series)</h4>

          <!-- Not configured -->
          <div v-if="!sonarr" class="text-center">
            <p class="text-gray-500 text-sm mb-4">Not configured</p>

            <UiButton variant="secondary" @click="openArrServiceForm()">
              Configure Sonarr
            </UiButton>
          </div>

          <!-- Configured -->
          <div v-else>
            <div class="flex items-center gap-3 mb-4">
              <div
                :class="['w-3 h-3 rounded-full', sonarr.isActive ? 'bg-green-500' : 'bg-gray-500']"
              />

              <p class="text-gray-400 text-sm flex-1 truncate">{{ sonarr.url }}</p>
            </div>

            <div class="flex items-center justify-between">
              <UiCheckbox
                :model-value="sonarr.isActive"
                label="Active"
                @update:model-value="toggleArrServiceActive(sonarr)"
              />

              <div class="flex items-center gap-2">
                <span
                  v-if="testResults[`arr-${sonarr.id}`]"
                  class="text-xs px-2 py-1 rounded"
                  :class="[
                    testResults[`arr-${sonarr.id}`].success
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400',
                  ]"
                >
                  {{ testResults[`arr-${sonarr.id}`].message }}
                </span>

                <UiButton size="sm" variant="secondary" @click="testArrService(sonarr.id)">
                  Test
                </UiButton>

                <UiButton size="sm" variant="secondary" @click="openArrServiceForm(sonarr)">
                  Edit
                </UiButton>

                <UiButton size="sm" variant="danger" @click="deleteArrService(sonarr.id)">
                  Delete
                </UiButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Hidden Users Section -->
    <section class="mt-12">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <Users class="w-5 h-5" /> Hidden Users
        </h3>
      </div>

      <div class="bg-gray-800/50 rounded-lg p-6">
        <p class="text-gray-400 text-sm mb-4">
          Select users to hide from the dashboard filter. Useful to hide admin users.
        </p>

        <div class="flex items-center gap-4">
          <UiMultiSelect
            v-model="selectedHiddenUserIds"
            :options="allUserOptions"
            placeholder="Select users to hide"
            class="w-64"
          />

          <UiButton variant="primary" :disabled="!userStore.users.length" @click="saveHiddenUsers">
            Save
          </UiButton>
        </div>

        <p v-if="!userStore.users.length" class="text-gray-500 text-sm mt-4">
          No users found. Sync your media server to load users.
        </p>
      </div>
    </section>

    <!-- TMDB API Key Section -->
    <section class="mt-12">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <Key class="w-5 h-5" /> TMDB API Key
        </h3>
      </div>

      <div class="bg-gray-800/50 rounded-lg p-6">
        <p class="text-gray-400 text-sm mb-4">
          Helps match episodes between your media server and Sonarr more reliably. Without it,
          matching falls back to IMDB/season-episode numbers which may not work for all series.
        </p>

        <div class="flex items-center gap-4">
          <UiInput
            v-model="tmdbApiKeyInput"
            type="password"
            placeholder="Enter TMDB API key"
            class="w-80"
          />

          <!-- Test result -->
          <span
            v-if="testResults['tmdb']"
            class="text-sm px-2 py-1 rounded"
            :class="[
              testResults['tmdb'].success
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400',
            ]"
          >
            {{ testResults['tmdb'].message }}
          </span>

          <UiButton size="sm" variant="secondary" @click="testTmdbConnection"> Test </UiButton>

          <UiButton variant="primary" @click="saveTmdbApiKey"> Save </UiButton>
        </div>

        <p class="text-gray-500 text-xs mt-4">
          Get a free API key from

          <a
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            class="text-cyan-400 hover:underline"
            >themoviedb.org</a
          >
        </p>
      </div>
    </section>

    <!-- Media Server Form Modal -->
    <UiModal
      v-if="showMediaServerForm"
      :title="(editingMediaServer ? 'Edit' : 'Configure') + ' Jellyfin Server'"
      @close="showMediaServerForm = false"
    >
      <form class="space-y-4" @submit.prevent="saveMediaServer">
        <UiInput
          v-model="mediaServerForm.url"
          label="URL"
          type="url"
          placeholder="http://jellyfin:8096"
          required
        />

        <UiInput
          v-model="mediaServerForm.apiKey"
          label="API Key"
          type="password"
          placeholder="Your API key"
          required
        />

        <p class="text-gray-500 text-xs -mt-2">
          Go to Dashboard → API Keys → Create a new API key. An admin API key is required.
        </p>

        <div class="flex justify-end gap-3 pt-4">
          <UiButton variant="secondary" @click="showMediaServerForm = false">Cancel</UiButton>

          <UiButton variant="primary" type="submit">Save</UiButton>
        </div>
      </form>
    </UiModal>

    <!-- Arr Service Form Modal (Simplified - no name/type fields) -->
    <UiModal
      v-if="showArrServiceForm"
      :title="(editingArrService ? 'Edit' : 'Add') + ' *arr Service'"
      @close="showArrServiceForm = false"
    >
      <form class="space-y-4" @submit.prevent="saveArrService">
        <UiAlert v-if="arrServiceError" variant="error" class="mb-4">
          {{ arrServiceError }}
        </UiAlert>

        <UiInput
          v-model="arrServiceForm.url"
          label="URL"
          type="url"
          placeholder="http://radarr:7878 or http://sonarr:8989"
          required
        />

        <UiInput
          v-model="arrServiceForm.apiKey"
          label="API Key"
          type="password"
          placeholder="Your API key"
          required
        />

        <p class="text-gray-500 text-xs -mt-2">Go to Settings → General → Security → API Key</p>

        <p class="text-gray-400 text-sm">
          The service type (Radarr/Sonarr) will be auto-detected when you save.
        </p>

        <UiCheckbox v-model="arrServiceForm.isActive" label="Active (use for deletion)" />

        <div class="flex justify-end gap-3 pt-4">
          <UiButton variant="secondary" @click="showArrServiceForm = false">Cancel</UiButton>

          <UiButton variant="primary" type="submit">Save</UiButton>
        </div>
      </form>
    </UiModal>
  </div>
</template>
