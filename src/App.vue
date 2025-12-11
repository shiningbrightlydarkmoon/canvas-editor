<template>
  <div id="app">
    <header class="app-header">
      <div class="header-left">
        <h1 class="logo">Canvas Editor</h1>
        <div class="file-actions">
          <button class="toolbar-btn" @click="handleSave" title="数据已启用自动保存 (IndexedDB)">
            <span>保存</span>
          </button>
          <button class="toolbar-btn" @click="handleUndo" :disabled="!canUndo">
            <span>撤销 (Ctrl+Z)</span>
          </button>
          <button class="toolbar-btn" @click="handleRedo" :disabled="!canRedo">
            <span>重做 (Ctrl+Y)</span>
          </button>
        </div>
      </div>
    </header>

    <div class="app-container">
      <aside class="left-sidebar">
        <div class="panel">
          <h3 class="panel-title">图形</h3>
          <div class="shape-library">
            <div class="shape-item" @click="addShape('rect')" title="矩形">▭ 矩形</div>
            <div class="shape-item" @click="addShape('circle')" title="圆形">○ 圆形</div>
            <div class="shape-item" @click="addShape('triangle')" title="三角形">△ 三角形</div>
            <div class="shape-item" @click="addShape('text')" title="文本">T 文本</div>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title">图层</h3>
          <div class="layers-panel">
            <div
              v-for="element in elements"
              :key="element.id"
              class="layer-item"
              :class="{ active: selectedElementIds.includes(element.id) }"
              @click="selectElement(element.id)"
            >
              <span class="layer-name">
                {{ element.name || `${element.type} ${element.id.slice(-4)}` }}
              </span>
            </div>
          </div>
        </div>
      </aside>

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
            />
          </div>
        </div>
      </main>

      <aside class="right-sidebar">
        <div class="panel" v-if="selectedElements.length === 1 && selectedElements[0]">
          <h3 class="panel-title">属性</h3>
          <ElementProperties :element="selectedElements[0]" @change="handleElementPropertyChange" />
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useCanvasStore } from '@/core/store/canvas'
import { storeToRefs } from 'pinia'
import { useShortcuts } from '@/core/composables/useShortcuts'

import CanvasArea from '@/modules/rendering/CanvasArea.vue'
import FloatingToolbar from '@/modules/ui/components/FloatingToolbar.vue'
import ElementProperties from '@/modules/ui/components/ElementProperties.vue'
import type { CanvasElement } from '@/core/types'

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
    width: 100,
    height: 100,
    style: {
      fill: '#3498db',
      stroke: '#000000',
      strokeWidth: 1,
      ...(type === 'text' ? { fontSize: 16, fontFamily: 'Arial', color: '#2c3e50' } : {}),
    },
    content: type === 'text' ? '文本' : undefined,
  })
}

const selectElement = (id: string) => {
  canvasStore.selectElement(id)
}

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
const handleSave = () => console.log('保存：已启用自动保存')
const handleUndo = () => canvasStore.undo()
const handleRedo = () => canvasStore.redo()
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
</style>
