<script setup lang="ts">
import { ref, onMounted } from 'vue'
import config from '../assets/config.json'

const apiBase = (config.apiRoute ?? 'http://localhost:8000').replace(/\/$/, '')

interface Room {
  id: number
  room_no: string
  panorama: string | null
  room_type: string | null
  floor_no: number | null
  building: string | null
  computer_no: number | null
  seat_no: number | null
}

const rooms      = ref<Room[]>([])
const listState  = ref<'idle' | 'loading' | 'error'>('idle')
const listErrMsg = ref('')

async function fetchRooms() {
  listState.value  = 'loading'
  listErrMsg.value = ''
  try {
    const res = await fetch(`${apiBase}/room/get_all_rooms`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    rooms.value = await res.json()
    listState.value = 'idle'
  } catch (e) {
    listState.value  = 'error'
    listErrMsg.value = `Failed to load rooms: ${e}`
  }
}

onMounted(fetchRooms)

// ---------------------------------------------------------------------------
// Add / edit room modal
// ---------------------------------------------------------------------------
const showFormModal = ref(false)
const formMode       = ref<'add' | 'edit'>('add')
const editingId       = ref<number | null>(null)
const formState       = ref<'idle' | 'loading' | 'error'>('idle')
const formErrMsg      = ref('')

const emptyForm = () => ({
  room_no:     '',
  panorama:    '',
  room_type:   '',
  floor_no:    0,
  building:    '',
  computer_no: 0,
  seat_no:     0,
})

const form = ref(emptyForm())

function openAddModal() {
  formMode.value  = 'add'
  editingId.value = null
  form.value      = emptyForm()
  formState.value  = 'idle'
  formErrMsg.value = ''
  showFormModal.value = true
}

function openEditModal(room: Room) {
  formMode.value  = 'edit'
  editingId.value = room.id
  form.value = {
    room_no:     room.room_no ?? '',
    panorama:    room.panorama ?? '',
    room_type:   room.room_type ?? '',
    floor_no:    room.floor_no ?? 0,
    building:    room.building ?? '',
    computer_no: room.computer_no ?? 0,
    seat_no:     room.seat_no ?? 0,
  }
  formState.value  = 'idle'
  formErrMsg.value = ''
  showFormModal.value = true
}

function closeFormModal() {
  showFormModal.value = false
}

async function submitForm() {
  if (!form.value.room_no) return
  formState.value  = 'loading'
  formErrMsg.value = ''

  const now = new Date().toISOString()
  const payload = {
    room_no:     form.value.room_no,
    panorama:    form.value.panorama,
    room_type:   form.value.room_type,
    floor_no:    Number(form.value.floor_no) || 0,
    building:    form.value.building,
    computer_no: Number(form.value.computer_no) || 0,
    seat_no:     Number(form.value.seat_no) || 0,
    created_at:  now,
    updated_at:  now,
  }

  try {
    const url    = formMode.value === 'add' ? `${apiBase}/room/add` : `${apiBase}/room/update/${editingId.value}`
    const method = formMode.value === 'add' ? 'POST' : 'PUT'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    showFormModal.value = false
    await fetchRooms()
  } catch (e) {
    formState.value  = 'error'
    formErrMsg.value = `Failed to save room: ${e}`
  }
}

// ---------------------------------------------------------------------------
// Delete room
// ---------------------------------------------------------------------------
const deletingId = ref<number | null>(null)

async function deleteRoom(room: Room) {
  if (deletingId.value !== null) return
  if (!confirm(`Delete room ${room.room_no}? This cannot be undone.`)) return
  deletingId.value = room.id
  try {
    const res = await fetch(`${apiBase}/room/delete/${room.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await fetchRooms()
  } catch (e) {
    listState.value  = 'error'
    listErrMsg.value = `Failed to delete room: ${e}`
  } finally {
    deletingId.value = null
  }
}

// ---------------------------------------------------------------------------
// Upload panorama — popup + dropzone
// ---------------------------------------------------------------------------
const showPanoModal = ref(false)
const panoRoom       = ref<Room | null>(null)
const panoDragOver    = ref(false)
const panoState       = ref<'idle' | 'loading' | 'error' | 'done'>('idle')
const panoErrMsg      = ref('')
const panoFileInput   = ref<HTMLInputElement | null>(null)

function openPanoModal(room: Room) {
  panoRoom.value    = room
  panoDragOver.value = false
  panoState.value    = 'idle'
  panoErrMsg.value   = ''
  showPanoModal.value = true
}

function closePanoModal() {
  showPanoModal.value = false
}

function onPanoDragOver(e: DragEvent) {
  e.preventDefault()
  panoDragOver.value = true
}

function onPanoDragLeave() {
  panoDragOver.value = false
}

function onPanoDrop(e: DragEvent) {
  e.preventDefault()
  panoDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) uploadPanoramaFile(file)
}

function onPanoBrowse() {
  panoFileInput.value?.click()
}

function onPanoFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) uploadPanoramaFile(file)
}

async function uploadPanoramaFile(file: File) {
  if (!panoRoom.value) return
  if (!/\.(png|jpe?g)$/i.test(file.name)) {
    panoState.value  = 'error'
    panoErrMsg.value = 'Only PNG and JPG files are allowed.'
    return
  }

  panoState.value  = 'loading'
  panoErrMsg.value = ''
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await fetch(`${apiBase}/room/upload_panorama/${panoRoom.value.room_no}`, {
      method: 'POST',
      body,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    panoState.value = 'done'
    await fetchRooms()
    setTimeout(() => { showPanoModal.value = false }, 700)
  } catch (e) {
    panoState.value  = 'error'
    panoErrMsg.value = `Failed to upload panorama: ${e}`
  }
}

// ---------------------------------------------------------------------------
// Upload a single room image
// ---------------------------------------------------------------------------
const imageFileInput   = ref<HTMLInputElement | null>(null)
const imageTargetRoom  = ref<string | null>(null)
const imageUploadState = ref<'idle' | 'loading' | 'error' | 'done'>('idle')
const imageErrMsg      = ref('')

function triggerImageUpload(room: Room) {
  imageTargetRoom.value  = room.room_no
  imageUploadState.value = 'idle'
  imageErrMsg.value      = ''
  imageFileInput.value?.click()
}

async function onImageFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file  = input.files?.[0]
  const roomNo = imageTargetRoom.value
  input.value = ''
  if (!file || !roomNo) return

  if (!/\.(png|jpe?g)$/i.test(file.name)) {
    imageUploadState.value = 'error'
    imageErrMsg.value      = 'Only PNG and JPG files are allowed.'
    return
  }

  imageUploadState.value = 'loading'
  imageErrMsg.value      = ''
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await fetch(`${apiBase}/room/upload_image/${roomNo}`, {
      method: 'POST',
      body,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    imageUploadState.value = 'done'
  } catch (e) {
    imageUploadState.value = 'error'
    imageErrMsg.value      = `Failed to upload image for ${roomNo}: ${e}`
  } finally {
    imageTargetRoom.value = null
  }
}

// ---------------------------------------------------------------------------
// Accessory (application) popup
// ---------------------------------------------------------------------------
interface AppItem {
  code: string
  application: string
  icon: string
  usage: boolean
}

const showAppModal   = ref(false)
const appRoom         = ref<Room | null>(null)
const appList          = ref<AppItem[]>([])
const appListState     = ref<'idle' | 'loading' | 'error'>('idle')
const appListErrMsg    = ref('')
const togglingApp       = ref<string | null>(null)
const toggleErrMsg      = ref('')

function openAppModal(room: Room) {
  appRoom.value       = room
  toggleErrMsg.value  = ''
  showAppModal.value  = true
  fetchAppList()
}

function closeAppModal() {
  showAppModal.value = false
}

async function fetchAppList() {
  if (!appRoom.value) return
  appListState.value  = 'loading'
  appListErrMsg.value = ''
  try {
    const res = await fetch(`${apiBase}/application/get_list_application/?room_no=${appRoom.value.room_no}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    appList.value = await res.json()
    appListState.value = 'idle'
  } catch (e) {
    appList.value        = []
    appListState.value   = 'error'
    appListErrMsg.value  = `Failed to load applications: ${e}`
  }
}

async function toggleApp(app: AppItem) {
  if (!appRoom.value || togglingApp.value !== null) return
  togglingApp.value  = app.code
  toggleErrMsg.value = ''
  try {
    if (!app.usage) {
      const res = await fetch(`${apiBase}/application/set_application/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_no: appRoom.value.room_no, application: app.code }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } else {
      const params = new URLSearchParams({ room_no: appRoom.value.room_no, application: app.code })
      const res = await fetch(`${apiBase}/application/unset_application/?${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }
    app.usage = !app.usage
  } catch (e) {
    toggleErrMsg.value = `Failed to update ${app.application.trim()}: ${e}`
  } finally {
    togglingApp.value = null
  }
}

// ---------------------------------------------------------------------------
// Accessory (physical equipment) popup
// ---------------------------------------------------------------------------
interface AccessoryItem {
  code: string
  accessory: string
  icon: string
  usage: boolean
}

const showAccessoryModal   = ref(false)
const accessoryRoom         = ref<Room | null>(null)
const accessoryList          = ref<AccessoryItem[]>([])
const accessoryListState     = ref<'idle' | 'loading' | 'error'>('idle')
const accessoryListErrMsg    = ref('')
const togglingAccessory       = ref<string | null>(null)
const accessoryToggleErrMsg   = ref('')

// The API's "icon" field is an HTML credit link (e.g. Flaticon attribution),
// not an image URL — extract href/text instead of rendering the HTML directly
// to avoid injecting untrusted markup.
function parseIconCredit(html: string): { href: string; text: string } | null {
  const match = html.match(/<a\s+href="([^"]+)"[^>]*>([^<]*)<\/a>/i)
  if (!match) return null
  return { href: match[1], text: match[2] }
}

function openAccessoryModal(room: Room) {
  accessoryRoom.value       = room
  accessoryToggleErrMsg.value = ''
  showAccessoryModal.value  = true
  fetchAccessoryList()
}

function closeAccessoryModal() {
  showAccessoryModal.value = false
}

async function fetchAccessoryList() {
  if (!accessoryRoom.value) return
  accessoryListState.value  = 'loading'
  accessoryListErrMsg.value = ''
  try {
    const res = await fetch(`${apiBase}/accessory/get_list_accessory/?room_no=${accessoryRoom.value.room_no}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    accessoryList.value = await res.json()
    accessoryListState.value = 'idle'
  } catch (e) {
    accessoryList.value        = []
    accessoryListState.value   = 'error'
    accessoryListErrMsg.value  = `Failed to load accessories: ${e}`
  }
}

async function toggleAccessory(item: AccessoryItem) {
  if (!accessoryRoom.value || togglingAccessory.value !== null) return
  togglingAccessory.value     = item.code
  accessoryToggleErrMsg.value = ''
  try {
    if (!item.usage) {
      const res = await fetch(`${apiBase}/accessory/set_accessory/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_no: accessoryRoom.value.room_no, accessory: item.code }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } else {
      const params = new URLSearchParams({ room_no: accessoryRoom.value.room_no, accessory: item.code })
      const res = await fetch(`${apiBase}/accessory/unset_accessory/?${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }
    item.usage = !item.usage
  } catch (e) {
    accessoryToggleErrMsg.value = `Failed to update ${item.accessory}: ${e}`
  } finally {
    togglingAccessory.value = null
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <div class="card-header">
        <p class="card-title">Rooms</p>
        <button class="btn" @click="openAddModal">+ Add Room</button>
      </div>

      <div v-if="listState === 'loading'" class="hint">Loading…</div>
      <div v-else-if="listState === 'error'" class="msg error-box">{{ listErrMsg }}</div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>Room No</th>
            <th>Type</th>
            <th>Floor</th>
            <th>Building</th>
            <th>PCs</th>
            <th>Seats</th>
            <th>Panorama</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rooms.length === 0">
            <td colspan="8" class="empty">No rooms found.</td>
          </tr>
          <tr v-for="room in rooms" :key="room.id">
            <td>{{ room.room_no }}</td>
            <td>{{ room.room_type ?? '—' }}</td>
            <td>{{ room.floor_no ?? '—' }}</td>
            <td>{{ room.building ?? '—' }}</td>
            <td>{{ room.computer_no ?? '—' }}</td>
            <td>{{ room.seat_no ?? '—' }}</td>
            <td>
              <span class="badge" :class="room.panorama ? 'badge-active' : 'badge-inactive'">
                {{ room.panorama ? 'Set' : 'Not set' }}
              </span>
            </td>
            <td>
              <div class="actions">
                <button type="button" class="action-btn" @click="openEditModal(room)">Edit</button>
                <button
                  type="button"
                  class="action-btn action-danger"
                  :disabled="deletingId === room.id"
                  @click="deleteRoom(room)"
                >
                  {{ deletingId === room.id ? 'Deleting…' : 'Delete' }}
                </button>
                <button type="button" class="action-btn" @click="openPanoModal(room)">Panorama</button>
                <button
                  type="button"
                  class="action-btn"
                  :disabled="imageUploadState === 'loading' && imageTargetRoom === room.room_no"
                  @click="triggerImageUpload(room)"
                >
                  {{ imageUploadState === 'loading' && imageTargetRoom === room.room_no ? 'Uploading…' : '+ Image' }}
                </button>
                <button type="button" class="action-btn" @click="openAppModal(room)">Applications</button>
                <button type="button" class="action-btn" @click="openAccessoryModal(room)">Accessory</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="imageUploadState === 'error'" class="msg error-box">{{ imageErrMsg }}</div>
      <div v-else-if="imageUploadState === 'done'" class="msg ok-box">Image uploaded successfully.</div>
    </div>

    <!-- Hidden input shared by the "+ Image" buttons -->
    <input
      ref="imageFileInput"
      type="file"
      accept=".png,.jpg,.jpeg"
      class="hidden-input"
      @change="onImageFileSelect"
    />

    <!-- Add / edit room popup -->
    <Teleport to="body">
      <div v-if="showFormModal" class="overlay" @click.self="closeFormModal">
        <div class="modal">
          <button class="modal-close" aria-label="Close" @click="closeFormModal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          <p class="card-title">{{ formMode === 'add' ? 'Add Room' : 'Edit Room' }}</p>

          <form class="form" @submit.prevent="submitForm">
            <div class="field">
              <label class="lbl">Room No</label>
              <input v-model="form.room_no" type="text" class="input" required :disabled="formMode === 'edit'" />
            </div>

            <div class="field">
              <label class="lbl">Room Type</label>
              <select v-model="form.room_type" class="input">
                <option value="" disabled>Select a type</option>
                <option value="class room">class room</option>
                <option value="meeting room">meeting room</option>
                <option value="other">other</option>
              </select>
            </div>

            <div class="field-row">
              <div class="field">
                <label class="lbl">Floor No</label>
                <input v-model.number="form.floor_no" type="number" class="input" />
              </div>
              <div class="field">
                <label class="lbl">Building</label>
                <input v-model="form.building" type="text" class="input" />
              </div>
            </div>

            <div class="field-row">
              <div class="field">
                <label class="lbl">Computer No</label>
                <input v-model.number="form.computer_no" type="number" class="input" />
              </div>
              <div class="field">
                <label class="lbl">Seat No</label>
                <input v-model.number="form.seat_no" type="number" class="input" />
              </div>
            </div>

            <button class="btn" type="submit" :disabled="formState === 'loading'">
              <span v-if="formState === 'loading'" class="spinner"></span>
              {{ formState === 'loading' ? 'Saving…' : (formMode === 'add' ? 'Create' : 'Save') }}
            </button>
          </form>

          <div v-if="formState === 'error'" class="msg error-box">{{ formErrMsg }}</div>
        </div>
      </div>
    </Teleport>

    <!-- Upload panorama popup + dropzone -->
    <Teleport to="body">
      <div v-if="showPanoModal" class="overlay" @click.self="closePanoModal">
        <div class="modal">
          <button class="modal-close" aria-label="Close" @click="closePanoModal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          <p class="card-title">Upload Panorama — {{ panoRoom?.room_no }}</p>

          <div
            class="dropzone"
            :class="{ 'drag-over': panoDragOver, uploading: panoState === 'loading' }"
            @dragover="onPanoDragOver"
            @dragleave="onPanoDragLeave"
            @drop="onPanoDrop"
            @click="onPanoBrowse"
          >
            <span v-if="panoState === 'loading'" class="spinner spinner-dark"></span>
            <template v-else>
              <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 7.5m0 0L7.5 12M12 7.5V16.5" />
              </svg>
              <p class="dropzone-text">Drag &amp; drop an image here, or click to browse</p>
              <p class="dropzone-hint">PNG or JPG</p>
            </template>
          </div>
          <input
            ref="panoFileInput"
            type="file"
            accept=".png,.jpg,.jpeg"
            class="hidden-input"
            @change="onPanoFileSelect"
          />

          <div v-if="panoState === 'error'" class="msg error-box">{{ panoErrMsg }}</div>
          <div v-else-if="panoState === 'done'" class="msg ok-box">Panorama uploaded successfully.</div>
        </div>
      </div>
    </Teleport>

    <!-- Applications popup -->
    <Teleport to="body">
      <div v-if="showAppModal" class="overlay" @click.self="closeAppModal">
        <div class="modal">
          <button class="modal-close" aria-label="Close" @click="closeAppModal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          <p class="card-title">Applications — {{ appRoom?.room_no }}</p>

          <div v-if="appListState === 'loading'" class="hint">Loading…</div>
          <div v-else-if="appListState === 'error'" class="msg error-box">{{ appListErrMsg }}</div>

          <ul v-else class="app-list">
            <li v-if="appList.length === 0" class="empty">No applications found.</li>
            <li v-for="app in appList" :key="app.code" class="app-row">
              <img :src="app.icon" :alt="app.application.trim()" class="app-icon" />
              <span class="app-name">{{ app.application.trim() }}</span>
              <input
                type="checkbox"
                class="app-checkbox"
                :checked="app.usage"
                :disabled="togglingApp === app.code"
                @change="toggleApp(app)"
              />
            </li>
          </ul>

          <div v-if="toggleErrMsg" class="msg error-box">{{ toggleErrMsg }}</div>
        </div>
      </div>
    </Teleport>

    <!-- Accessory (physical equipment) popup -->
    <Teleport to="body">
      <div v-if="showAccessoryModal" class="overlay" @click.self="closeAccessoryModal">
        <div class="modal">
          <button class="modal-close" aria-label="Close" @click="closeAccessoryModal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          <p class="card-title">Accessory — {{ accessoryRoom?.room_no }}</p>

          <div v-if="accessoryListState === 'loading'" class="hint">Loading…</div>
          <div v-else-if="accessoryListState === 'error'" class="msg error-box">{{ accessoryListErrMsg }}</div>

          <ul v-else class="app-list">
            <li v-if="accessoryList.length === 0" class="empty">No accessories found.</li>
            <li v-for="item in accessoryList" :key="item.code" class="app-row">
              <img :src="`${apiBase}/accessory/get_picture/${item.icon}`" :alt="item.accessory" class="app-icon" />
              <span class="app-name">
                {{ item.accessory }}
                <a
                  v-if="parseIconCredit(item.icon)"
                  :href="parseIconCredit(item.icon)!.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="app-icon-credit"
                >{{ parseIconCredit(item.icon)!.text }}</a>
              </span>
              <input
                type="checkbox"
                class="app-checkbox"
                :checked="item.usage"
                :disabled="togglingAccessory === item.code"
                @change="toggleAccessory(item)"
              />
            </li>
          </ul>

          <div v-if="accessoryToggleErrMsg" class="msg error-box">{{ accessoryToggleErrMsg }}</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 1.25rem 1%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.25rem;
  width: 98%;
  margin: 0 auto;
  box-sizing: border-box;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.card-title {
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-link-hover);
  margin: 0;
}

.hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.table th {
  text-align: left;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.table td {
  padding: 0.6rem;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.empty {
  text-align: center;
  color: #64748b;
  padding: 1.25rem 0.6rem;
}

.actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.action-btn {
  background: var(--bg-page);
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  color: var(--accent-link);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.3rem 0.55rem;
  cursor: pointer;
  font-family: inherit;
  transition: background .15s;
}
.action-btn:hover:not(:disabled) { background: var(--bg-surface-alt); }
.action-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.action-danger { color: var(--pill-error-text); }

.badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
}
.badge-active   { background: rgba(34,197,94,.12);  color: var(--pill-success-text); }
.badge-inactive { background: rgba(148,163,184,.15); color: var(--text-secondary); }

.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-top: 0.75rem;
}

.field-row {
  display: flex;
  gap: 0.75rem;
}
.field-row .field { flex: 1; }

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.lbl {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
}

.input {
  background: var(--bg-page);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-primary);
  padding: 0.5rem 0.7rem;
  font-size: 0.85rem;
  width: 100%;
  box-sizing: border-box;
}
.input:disabled { opacity: 0.6; cursor: not-allowed; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: #2563eb;
  border: none;
  border-radius: 0.5rem;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.55rem 1.1rem;
  cursor: pointer;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn:hover:not(:disabled) { background: #1d4ed8; }

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
.spinner-dark {
  border: 2px solid rgba(37,99,235,.25);
  border-top-color: var(--accent-link-hover);
}
@keyframes spin { to { transform: rotate(360deg); } }

.msg {
  margin-top: 1rem;
  font-size: 0.8rem;
  padding: 0.6rem 0.8rem;
  border-radius: 0.5rem;
}
.error-box { background: rgba(239,68,68,.12); color: var(--pill-error-text); border: 1px solid rgba(239,68,68,.35); }
.ok-box    { background: rgba(34,197,94,.12); color: var(--pill-success-text); border: 1px solid rgba(34,197,94,.35); }

.hidden-input { display: none; }

/* ── Dropzone ── */
.dropzone {
  margin-top: 0.85rem;
  border: 2px dashed var(--border);
  border-radius: 0.75rem;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  cursor: pointer;
  background: #f8fafc;
  transition: background .15s, border-color .15s;
  min-height: 140px;
}
.dropzone:hover,
.dropzone.drag-over {
  background: #eff6ff;
  border-color: var(--accent-link-hover);
}
.dropzone.uploading { cursor: wait; }

.dropzone-icon {
  width: 32px;
  height: 32px;
  color: var(--accent-link-hover);
}

.dropzone-text {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  text-align: center;
}

.dropzone-hint {
  font-size: 0.72rem;
  color: #64748b;
  margin: 0;
}

/* ── Popup ── */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, .65);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  z-index: 500;
}

.modal {
  position: relative;
  width: 100%;
  max-width: 460px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 25px 60px rgba(0,0,0,.5);
  box-sizing: border-box;
}

.modal-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-page);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-primary);
  cursor: pointer;
}
.modal-close svg { width: 16px; height: 16px; }
.modal-close:hover { background: var(--bg-surface-alt); }

/* ── Accessory list ── */
.app-list {
  list-style: none;
  margin: 0.85rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.app-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 0.6rem;
}

.app-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  object-fit: contain;
}

.app-name {
  flex: 1;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.app-icon-credit {
  display: block;
  font-size: 0.65rem;
  color: #64748b;
  text-decoration: none;
}
.app-icon-credit:hover { text-decoration: underline; }

.app-checkbox {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  accent-color: #2563eb;
  cursor: pointer;
}
.app-checkbox:disabled { cursor: not-allowed; opacity: 0.6; }

@media (max-width: 720px) {
  .field-row { flex-direction: column; }
  .table { font-size: 0.78rem; }
}
</style>
