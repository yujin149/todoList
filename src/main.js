/** Vue 앱 진입점: 전역 스타일 → Pinia · 라우터 → App 마운트 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles/reset.css'
import './styles/common.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
