<template>
  <div id="app">
    <header class="app-header">
      <div class="brand">
        <div class="brand-mark">
          <Shapes :size="20" :stroke-width="1.8" />
        </div>
        <div class="brand-copy">
          <h1 class="logo">Canvas Editor</h1>
          <div class="save-status">
            <span class="status-dot"></span>
            <span>本地画布 · 已自动保存</span>
          </div>
        </div>
      </div>

      <div class="header-status">
        <MousePointer2 :size="14" />
        <span v-if="selectedElementIds.length">
          已选择 {{ selectedElementIds.length }} 个元素
        </span>
        <span v-else>画布工作区</span>
      </div>

      <div class="header-actions">
        <button class="icon-button" @click="handleUndo" :disabled="!canUndo" title="撤销 (Ctrl+Z)">
          <Undo2 :size="17" />
        </button>
        <button class="icon-button" @click="handleRedo" :disabled="!canRedo" title="重做 (Ctrl+Y)">
          <Redo2 :size="17" />
        </button>
        <button class="save-button" @click="handleSave" title="数据已启用自动保存">
          <Save :size="15" />
          <span>保存</span>
        </button>
      </div>
    </header>

    <div class="app-container">
      <nav class="left-toolbar" aria-label="元素工具">
        <div v-for="tool in toolItems" :key="tool.key" class="tool-slot">
          <button
            class="tool-button"
            :class="{ active: tool.key === 'table' && isTablePickerOpen }"
            :title="tool.label"
            :data-table-picker-trigger="tool.key === 'table' ? '' : undefined"
            @click="tool.action"
          >
            <component :is="tool.icon" :size="19" :stroke-width="1.8" />
          </button>
          <TableSizePicker
            v-if="tool.key === 'table' && isTablePickerOpen"
            @select="handleTableInsert"
            @close="isTablePickerOpen = false"
          />
        </div>
      </nav>

      <main class="main-content">
        <div class="canvas-wrapper">
          <div class="canvas-container">
            <CanvasArea
              :elements="elements"
              :selectedIds="selectedElementIds"
              @selectionChange="handleSelectionChange"
            />

            <FloatingToolbar
              v-if="selectedElements.length > 0"
              :elements="selectedElements"
              @delete="handleDelete"
              @duplicate="handleDuplicate"
              @bringToFront="handleBringToFront"
              @sendToBack="handleSendToBack"
            />

            <div v-if="selectedElements.length === 0" class="canvas-hint">
              <span class="canvas-hint-dot"></span>
              <span>画布已就绪</span>
            </div>
          </div>
        </div>
      </main>

      <aside class="right-sidebar">
        <div class="inspector-shell">
          <div class="inspector-tabs">
            <button class="inspector-tab active">
              <SlidersHorizontal :size="15" />
              <span>属性</span>
            </button>
          </div>

          <div v-if="selectedElements.length === 1 && selectedElements[0]" class="inspector-scroll">
            <ElementProperties
              :element="selectedElements[0]"
              @change="handleElementPropertyChange"
            />
          </div>

          <div v-else class="inspector-empty">
            <div class="empty-icon">
              <MousePointer2 v-if="selectedElements.length === 0" :size="22" />
              <Layers3 v-else :size="22" />
            </div>
            <strong>
              {{
                selectedElements.length === 0
                  ? '未选择元素'
                  : `已选择 ${selectedElements.length} 个元素`
              }}
            </strong>
          </div>
        </div>
      </aside>
    </div>

    <input
      ref="imageInput"
      type="file"
      accept="image/png,image/jpeg"
      hidden
      @change="handleImageUpload"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCanvasStore } from '@/core/store/canvas'
import { storeToRefs } from 'pinia'
import { useShortcuts } from '@/core/composables/useShortcuts'
import { fileToBase64 } from '@/lib/utils/file'
import {
  ChartColumn,
  Circle,
  Image as ImageIcon,
  Layers3,
  MousePointer2,
  Redo2,
  Save,
  Shapes,
  SlidersHorizontal,
  Square,
  Triangle,
  Type,
  Undo2,
  Table2,
} from 'lucide-vue-next'

import CanvasArea from '@/modules/rendering/CanvasArea.vue'
import FloatingToolbar from '@/modules/ui/components/FloatingToolbar.vue'
import ElementProperties from '@/modules/ui/components/ElementProperties.vue'
import TableSizePicker from '@/modules/ui/components/TableSizePicker.vue'
import type { CanvasElement } from '@/core/types'
import { createDefaultChartData } from '@/core/charts'
import { createTableConfig, getTableDimensions } from '@/core/tables'

// 1. 初始化 Store
const canvasStore = useCanvasStore()
// 启用快捷键
useShortcuts()

// 2. 使用 storeToRefs 替换本地状态
const {
  elementsArray: elements,
  selectedIds: selectedElementIds,
  selectedElements,
  canUndo,
  canRedo,
} = storeToRefs(canvasStore)

// 3. 异步加载数据 (IndexedDB)
onMounted(async () => {
  await canvasStore.initializeWithSampleData()
})

// --- 事件处理器 ---

const addShape = (type: CanvasElement['type']) => {
  canvasStore.addElement({
    type,
    name: `${type} ${elements.value.length + 1}`,
    x: 100 + elements.value.length * 50,
    y: 100 + elements.value.length * 50,
    width: type === 'chart' ? 420 : 100,
    height: type === 'chart' ? 260 : 100,
    style: {
      fill: '#2f6fed',
      stroke: '#d7deea',
      strokeWidth: 1,
      ...(type === 'text' ? { fontSize: 16, fontFamily: 'Arial', color: '#273449' } : {}),
    },
    ...(type === 'chart'
      ? {
          chart: {
            chartType: 'bar' as const,
            data: createDefaultChartData(),
            xField: 'month',
            yFields: ['sales', 'profit'],
            title: '销售趋势',
          },
        }
      : {}),
    content: type === 'text' ? '文本' : undefined,
  })
}

const imageInput = ref<HTMLInputElement>()

const triggerImageUpload = () => {
  imageInput.value?.click()
}

const isTablePickerOpen = ref(false)

const handleTableInsert = (rows: number, columns: number) => {
  const dimensions = getTableDimensions(rows, columns)
  canvasStore.addElement({
    type: 'table',
    name: `表格 ${rows} × ${columns}`,
    x: 120 + elements.value.length * 30,
    y: 120 + elements.value.length * 30,
    width: dimensions.width,
    height: dimensions.height,
    style: {
      fill: '#ffffff',
      stroke: '#d7deea',
      strokeWidth: 1,
      fontSize: 12,
      fontFamily: 'Arial',
      color: '#273449',
    },
    table: createTableConfig(rows, columns),
  })
  isTablePickerOpen.value = false
}

const toolItems = [
  { key: 'rect', label: '矩形', icon: Square, action: () => addShape('rect') },
  { key: 'circle', label: '圆形', icon: Circle, action: () => addShape('circle') },
  { key: 'triangle', label: '三角形', icon: Triangle, action: () => addShape('triangle') },
  { key: 'text', label: '文本', icon: Type, action: () => addShape('text') },
  {
    key: 'table',
    label: '表格',
    icon: Table2,
    action: () => {
      isTablePickerOpen.value = !isTablePickerOpen.value
    },
  },
  { key: 'chart', label: '图表', icon: ChartColumn, action: () => addShape('chart') },
  { key: 'image', label: '图片', icon: ImageIcon, action: triggerImageUpload },
]

const handleSelectionChange = (selectedElements: CanvasElement[]) => {
  const ids = selectedElements.map((el) => el.id)
  canvasStore.selectMultiple(ids)
}

const handleElementPropertyChange = (properties: Partial<CanvasElement>) => {
  if (selectedElements.value.length === 1) {
    canvasStore.updateElement(selectedElements.value[0]!.id, properties)
  }
}

const handleDelete = () => canvasStore.deleteSelectedElements()
const handleDuplicate = () => canvasStore.copySelectedElements()
const handleBringToFront = () => canvasStore.bringToFront()
const handleSendToBack = () => canvasStore.sendToBack()
const handleSave = () => console.log('保存：已启用自动保存')
const handleUndo = () => canvasStore.undo()
const handleRedo = () => canvasStore.redo()

// --- 图片上传 ---

const handleImageUpload = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const dataUrl = await fileToBase64(file)
    canvasStore.addElement({
      type: 'image',
      name: file.name,
      x: 100 + elements.value.length * 50,
      y: 100 + elements.value.length * 50,
      width: 200,
      height: 200,
      imageUrl: dataUrl,
      style: { fill: '#f1f4f9', stroke: '#d7deea', strokeWidth: 0 },
    })
  } catch (err) {
    console.error('图片加载失败:', err)
  }

  input.value = ''
}
</script>

<style scoped>
#app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-header {
  height: 48px;
  background: #2c3e50;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  z-index: 1000;
}

.app-container {
  display: flex;
  flex: 1;
  height: calc(100vh - 48px);
  min-height: 0;
  overflow: hidden;
}

.left-sidebar,
.right-sidebar {
  width: 240px;
  background: #f8f9fa;
  border-right: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
}

.right-sidebar {
  border-right: none;
  border-left: 1px solid #e9ecef;
}

.main-content {
  flex: 1;
  background: #f1f3f4;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.canvas-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  font-size: 18px;
  font-weight: 600;
}

.file-actions {
  display: flex;
  gap: 8px;
}

.toolbar-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 12px;
}

.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.panel {
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.shape-library {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.shape-item {
  padding: 12px;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  text-align: center;
  font-size: 14px;
}

.shape-item:hover {
  border-color: #3498db;
  background: #f8f9fa;
}

.layers-panel {
  max-height: 300px;
  overflow-y: auto;
}

.layer-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 2px;
  font-size: 12px;
}

.layer-item:hover {
  background: #e9ecef;
}

.layer-item.active {
  background: #3498db;
  color: white;
}

.layer-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* UI refresh: light workspace, single tool rail, inspector layout. */
#app {
  --workspace-bg: #f3f5f9;
  --panel-bg: #ffffff;
  --panel-border: #e6eaf0;
  --text-strong: #172033;
  --text-muted: #7a869a;
  --primary: #2f6fed;
  --primary-soft: #edf3ff;
  color: var(--text-strong);
  background: var(--workspace-bg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

.app-header {
  height: 62px;
  background: var(--panel-bg);
  color: var(--text-strong);
  border-bottom: 1px solid var(--panel-border);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 18px;
}

.brand,
.header-actions,
.header-status {
  display: flex;
  align-items: center;
}

.brand {
  gap: 10px;
  min-width: 0;
}

.brand-mark {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #ffffff;
  background: linear-gradient(145deg, #4b8bff, #2f6fed);
  box-shadow: 0 7px 16px rgba(47, 111, 237, 0.22);
}

.brand-copy {
  min-width: 0;
}

.logo {
  margin: 0;
  color: var(--text-strong);
  font-size: 15px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0;
}

.save-status {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22b573;
  box-shadow: 0 0 0 3px rgba(34, 181, 115, 0.1);
}

.header-status {
  gap: 7px;
  height: 32px;
  padding: 0 12px;
  color: #526077;
  background: #f7f9fc;
  border: 1px solid #edf0f5;
  border-radius: 8px;
  font-size: 12px;
}

.header-actions {
  justify-self: end;
  gap: 7px;
}

.icon-button,
.save-button,
.tool-button,
.inspector-tab {
  appearance: none;
  font: inherit;
}

.icon-button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  color: #4d5b70;
  background: #ffffff;
  cursor: pointer;
}

.icon-button:hover:not(:disabled) {
  color: var(--primary);
  border-color: #c9d8fa;
  background: #f8faff;
}

.icon-button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.save-button {
  height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 13px;
  border: 0;
  border-radius: 8px;
  color: #ffffff;
  background: var(--primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 7px 16px rgba(47, 111, 237, 0.18);
}

.save-button:hover {
  background: #235fd8;
}

.left-toolbar {
  width: 64px;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: var(--panel-bg);
  border-right: 1px solid var(--panel-border);
  flex-shrink: 0;
  z-index: 20;
}

.tool-button {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 9px;
  color: #5c6a7f;
  background: transparent;
  cursor: pointer;
}

.tool-slot {
  position: relative;
}

.tool-button.active {
  color: var(--primary);
  border-color: #d8e3fb;
  background: var(--primary-soft);
}

.tool-button:hover {
  color: var(--primary);
  border-color: #d8e3fb;
  background: var(--primary-soft);
}

.main-content {
  background: var(--workspace-bg);
}

.canvas-container {
  background: #ffffff;
}

.canvas-hint {
  position: absolute;
  left: 16px;
  bottom: 14px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 9px;
  color: #7a869a;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(230, 234, 240, 0.9);
  border-radius: 7px;
  font-size: 11px;
  pointer-events: none;
}

.canvas-hint-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #aab4c3;
}

.right-sidebar {
  width: 350px;
  background: var(--panel-bg);
  border-left: 1px solid var(--panel-border);
  overflow: hidden;
}

.inspector-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.inspector-tabs {
  height: 54px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--panel-border);
  flex-shrink: 0;
}

.inspector-tab {
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 11px;
  border: 0;
  border-radius: 7px;
  color: #5f6c80;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
}

.inspector-tab.active {
  color: var(--primary);
  background: var(--primary-soft);
}

.inspector-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px 20px;
}

.inspector-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #8b96a8;
  font-size: 12px;
}

.empty-icon {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  color: #96a2b5;
  background: #f6f8fb;
  border: 1px solid #e8ecf2;
  border-radius: 14px;
}

@media (max-width: 980px) {
  .header-status {
    display: none;
  }

  .app-header {
    grid-template-columns: 1fr auto;
  }

  .right-sidebar {
    width: 320px;
  }
}
</style>
