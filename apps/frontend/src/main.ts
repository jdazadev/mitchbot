import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import i18n, { initializeLocale } from './i18n'
import App from './App.vue'
import './style.css'

async function bootstrap() {
  await initializeLocale()
  const app = createApp(App)
  app.use(createPinia())
  app.use(i18n)
  app.use(router)
  app.mount('#app')
}

void bootstrap()
