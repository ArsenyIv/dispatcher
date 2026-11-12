import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './app/App.vue'
import { bootstrap } from './app/bootstrap'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
bootstrap(pinia)
app.mount('#app')