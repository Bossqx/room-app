<script setup lang="ts">
import { useRouter } from 'vue-router'
import ThemeToggle from '../views/components/ThemeToggle.vue'
import logo from '../assets/Logo C.jpg'

const router = useRouter()

function goToLogin() {
  router.push('/login')
}
</script>

<template>
  <div class="other-layout">
    <header class="topbar">
      <div class="brand">
        <img :src="logo" alt="Logo" class="brand-logo" />
        <span class="brand-title">ระบบบริหารจัดการห้องคอมพิวเตอร์สำนักคอมพิวเตอร์</span>
      </div>

      <div class="right-group">
        <ThemeToggle />
        <button type="button" class="login-link" @click="goToLogin">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
          <span>Login</span>
        </button>
      </div>
    </header>

    <main class="container">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.other-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-page);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* ── Top menu ── */
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  flex-shrink: 0;
  width: 100%;
  box-sizing: border-box;
  background: #2563eb;
  border-radius: 0 0 0.6rem 0.6rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0.6rem 1.5rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
}

.brand-logo {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.brand-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.right-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.login-link {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(255,255,255,.15);
  border: 1px solid rgba(255,255,255,.4);
  border-radius: 999px;
  color: #ffffff;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background .15s;
}
.login-link:hover { background: rgba(255,255,255,.28); }
.login-link svg { width: 16px; height: 16px; flex-shrink: 0; }

/* ── Container ── */
.container {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  padding-top: 0.5rem;
}

@media (max-width: 640px) {
  .topbar { flex-wrap: wrap; gap: 0.75rem; }
  .brand-title { white-space: normal; }
  .container { padding-top: 70rem; }
}
</style>
