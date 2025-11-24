import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
// 初始化示例数据
const { useCanvasStore } = await import('@/core/store/canvas')
const canvasStore = useCanvasStore()
canvasStore.initializeWithSampleData()

app.mount('#app')
