<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useSemesterStore } from '../stores/semester'
import config from "../assets/config.json"
import logo from "../assets/Logo C.jpg"

const router         = useRouter()
const userStore      = useUserStore()
const semesterStore  = useSemesterStore()
const username = ref('')
const password = ref('')
const state    = ref<'idle' | 'loading' | 'fail'>('idle')
const errMsg   = ref('')
const showPinPopup = ref(false)
const showErrorPopup = ref(false)

const apiBase   = (config.apiRoute ?? 'https://cosai.nrru.ac.th:8000').replace(/\/$/, '')
const DEFAULT_PIN = '123456'

function buildName(o: any) {
  return `${o.prefixname ?? ''}${o.firstname ?? ''} ${o.lastname ?? ''}`.trim()
}

async function loginSystem() {
  const url=`${apiBase}/user/get_user/${encodeURIComponent(username.value)}/${encodeURIComponent(password.value)}`
  const res  = await fetch(url)
  const data = await res.json()
  if (!data || data.detail) return null
  return data
}

async function syncNRRUUser(o: any, pwd: string) {
  try {
    const check = await fetch(`${apiBase}/user/is_exist/${encodeURIComponent(o.username)}`).then(r => r.json())
    if (!check.exists) {
      await fetch(`${apiBase}/user/add/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name:    o.username,
          name:         buildName(o),
          password:     pwd,
          description:  o.departmentname ?? '',
          picture:      o.picture        ?? '',
          user_type:    'user',
          created_date: new Date().toISOString(),
        }),
      })
    }
  } catch { /* non-critical */ }
}

async function loginNRRU() {
  const url  = `https://cos.nrru.ac.th/NRRUCredential/NRRUCredential1.php?userName=${encodeURIComponent(username.value)}&password=${encodeURIComponent(password.value)}`
  const data = await fetch(url).then(r => r.json())
  if (!Array.isArray(data) || !data[0] || data[0].status <= 0) return null
  const o = data[0]
  await syncNRRUUser(o, password.value)
  return {
    id:          parseInt(o.staffid)   || 0,
    user_name:   o.username            ?? username.value,
    name:        buildName(o),
    picture:     o.picture             ?? '',
    description: o.departmentname      ?? '',
    user_type:   String(o.usertype     ?? ''),
  }
}

async function provisionUserAccess(userName: string) {
  try {
    const res = await fetch(`${apiBase}/user_access/add/`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name:    userName,
        pwd:          DEFAULT_PIN,
        pin_count:    0,
        created_date: new Date().toISOString(),
      }),
    })
    const data = await res.json()
    // Flag === false means the useraccess row already existed — user
    // already has a PIN (possibly changed), so don't show the default one.
    showPinPopup.value = data?.Flag !== false
  } catch {
    showPinPopup.value = false // non-critical — skip popup if unreachable
  }
}

function isMobileDevice(): boolean {
  return window.matchMedia('(max-width: 768px)').matches
}

function goToSchedule() {
  if (userStore.userType === 'admin') {
    router.push('/dashboard')
    return
  }
  router.push(isMobileDevice() ? '/mobile/home' : '/desktop/overview')
}

async function login() {
  if (!username.value || !password.value) return
  state.value  = 'loading'
  errMsg.value = ''
  try {
    const user = await loginSystem() ?? await loginNRRU()
    if (!user) {
      state.value  = 'fail'
      errMsg.value = 'Login is incorrect'
      showErrorPopup.value = true
      return
    }
    userStore.setUser(user)
    await semesterStore.fetchActiveSemester(apiBase)
    await provisionUserAccess(user.user_name)
    if (showPinPopup.value) {
      state.value = 'idle'
      return // hold on the login page until the user acknowledges the PIN popup
    }
    state.value = 'idle'
    goToSchedule()
  } catch {
    state.value  = 'fail'
    errMsg.value = 'Cannot connect to server'
    showErrorPopup.value = true
  }
}

function acknowledgePinPopup() {
  showPinPopup.value = false
  goToSchedule()
}

// Only closes the overlay — errMsg stays in the inline box until the next
// attempt clears it, so the reason is still on screen after dismissing.
function dismissErrorPopup() {
  showErrorPopup.value = false
}





</script>

<template>
  <div class="page">
    <div class="bg-grid"></div>

    <div class="panel">
    <div class="console">
      <!-- Brand -->
      <div class="brand">
        <div class="brand-icon">
          <img :src="logo" alt="Room Manager logo" class="brand-logo" />
        </div>
        <div>
          <p class="brand-name">Room Manager</p>
          <p class="brand-sub">Nakhon Ratchasima Rajabhat University</p>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Form -->
      <p class="form-title">Sign in to your account</p>

      <div class="field">
        <label class="lbl">Username</label>
        <div class="input-wrap">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          <input
            v-model="username"
            type="text"
            class="input"
            placeholder="Enter your username"
            autocomplete="username"
            :disabled="state === 'loading'"
            @keyup.enter="login"
          />
        </div>
      </div>

      <div class="field">
        <label class="lbl">Password</label>
        <div class="input-wrap">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <input
            v-model="password"
            type="password"
            class="input"
            placeholder="Enter your password"
            autocomplete="current-password"
            :disabled="state === 'loading'"
            @keyup.enter="login"
          />
        </div>
      </div>

      <div v-if="errMsg" class="error-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="err-icon">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        {{ errMsg }}
      </div>

      <button
        class="btn"
        @click="login"
        :disabled="!username || !password || state === 'loading'"
      >
        <span v-if="state === 'loading'" class="spinner"></span>
        {{ state === 'loading' ? 'Signing in…' : 'Sign In' }}
      </button>

      <p class="footer">Room Management System &copy; NRRU</p>
    </div>
    </div>

    <!-- First-time PIN popup -->
    <div v-if="showPinPopup" class="pin-overlay">
      <div class="pin-modal">
        <p class="pin-title">Your Room Access PIN</p>
        <p class="pin-value">{{ DEFAULT_PIN }}</p>
        <p class="pin-hint">
          Use this PIN to verify room access. You can change it anytime from the PIN menu.
        </p>
        <button class="btn" @click="acknowledgePinPopup">Continue</button>
      </div>
    </div>

    <!-- Login failure popup -->
    <div v-if="showErrorPopup" class="pin-overlay" @click.self="dismissErrorPopup">
      <div class="pin-modal">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="popup-err-icon">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <p class="pin-title">Sign in failed</p>
        <p class="popup-err-msg">{{ errMsg }}</p>
        <p class="pin-hint">Check your username and password, then try again.</p>
        <button class="btn" @click="dismissErrorPopup">Try Again</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  position: relative;
  overflow: hidden;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(59,130,246,.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59,130,246,.04) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

.panel {
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  box-sizing: border-box;
}

.console {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 1.25rem;
  padding: 2.25rem 2rem;
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  box-shadow: 0 25px 50px rgba(0,0,0,.5);
}

/* Brand */
.brand {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}
.brand-icon {
  width: 44px;
  height: 44px;
  background: var(--bg-surface);
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.brand-logo { width: 100%; height: 100%; object-fit: cover; }
.brand-name { font-size: 1rem; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.2; }
.brand-sub  { font-size: 0.65rem; color: #64748b; margin: 0; line-height: 1.4; }

.divider { height: 1px; background: #334155; margin: 0 -0.25rem; }

.form-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0;
}

/* Fields */
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.lbl   { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.input-icon {
  position: absolute;
  left: 0.75rem;
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
  pointer-events: none;
  flex-shrink: 0;
}
.input {
  width: 100%;
  background: var(--bg-page);
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  color: var(--text-primary);
  font-size: 0.95rem;
  padding: 0.6rem 0.85rem 0.6rem 2.4rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color .15s;
}
.input:focus    { border-color: #3b82f6; }
.input:disabled { opacity: 0.5; }
.input::placeholder { color: var(--text-secondary); }

/* Error */
.error-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--pill-error-bg);
  color: var(--pill-error-text);
  border: 1px solid #ef4444;
  border-radius: 0.6rem;
  padding: 0.55rem 0.75rem;
  font-size: 0.85rem;
}
.err-icon { width: 16px; height: 16px; flex-shrink: 0; }

/* Button */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #fff;
  border: none;
  border-radius: 0.6rem;
  padding: 0.7rem 1rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 0.25rem;
  transition: opacity .15s;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn:not(:disabled):hover { opacity: 0.9; }

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.footer {
  text-align: center;
  font-size: 0.65rem;
  color: #334155;
  margin: 0.5rem 0 0;
}

/* First-time PIN popup */
.pin-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 50;
}
.pin-modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 2rem;
  width: 100%;
  max-width: 360px;
  text-align: center;
  box-shadow: 0 25px 50px rgba(0,0,0,.5);
}
.pin-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #64748b;
  margin: 0 0 0.75rem;
}
.pin-value {
  font-family: monospace;
  font-size: 2rem;
  font-weight: 700;
  color: var(--pill-success-text);
  letter-spacing: 0.2em;
  margin: 0 0 0.75rem;
}
.pin-hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0 0 1.25rem;
  line-height: 1.4;
}
.pin-modal .btn { margin-top: 0; }

.popup-err-icon {
  width: 44px;
  height: 44px;
  color: #ef4444;
  margin: 0 auto 0.75rem;
  display: block;
}
.popup-err-msg {
  font-size: 1.05rem;
  font-weight: 600;
  color: #b91c1c;
  margin: 0 0 0.75rem;
}

</style>
