import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index'
import './assets/theme.css'
import { installDocumentI18n } from './i18n'

function resetInitialDashboardScroll() {
  if (window.location.pathname !== '/' && window.location.pathname !== '/dashboard-first') return
  window.scrollTo({ left: 0, top: 0, behavior: 'auto' })
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

resetInitialDashboardScroll()
window.addEventListener('pageshow', resetInitialDashboardScroll)
window.addEventListener('load', resetInitialDashboardScroll, { once: true })

createApp(App).use(createPinia()).use(router).mount('#app')
installDocumentI18n()

void router.isReady().then(() => {
  resetInitialDashboardScroll()
  window.requestAnimationFrame(resetInitialDashboardScroll)
})
