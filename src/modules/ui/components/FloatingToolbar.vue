<template>
  <div class="floating-toolbar">
    <div class="toolbar-content">
      <span class="selection-info">选中 {{ elements.length }} 个元素</span>

      <div class="toolbar-actions">
        <!-- 通用操作 -->
        <button class="action-btn" @click="$emit('delete')" title="删除 (Delete)">
          <Trash2 class="icon" />
        </button>
        <button class="action-btn" @click="$emit('duplicate')" title="复制">
          <Copy class="icon" />
        </button>
        <button class="action-btn" @click="$emit('bringToFront')" title="置顶">
          <Layers class="icon" />
        </button>
        <button class="action-btn" @click="$emit('sendToBack')" title="置底">
          <Layers class="icon flip" />
        </button>

        <span class="separator" v-if="singleElement"></span>

        <!-- 文本专属 -->
        <template v-if="singleElement?.type === 'text'">
          <button
            class="action-btn"
            :class="{ active: singleElement.style.fontWeight === 'bold' }"
            @click="toggleTextStyle('fontWeight', singleElement.style.fontWeight === 'bold' ? 'normal' : 'bold')"
            title="加粗"
          ><b>B</b></button>
          <button
            class="action-btn"
            :class="{ active: singleElement.style.fontStyle === 'italic' }"
            @click="toggleTextStyle('fontStyle', singleElement.style.fontStyle === 'italic' ? 'normal' : 'italic')"
            title="斜体"
          ><i>I</i></button>
          <button
            class="action-btn"
            :class="{ active: singleElement.style.textDecoration === 'underline' }"
            @click="toggleTextStyle('textDecoration', singleElement.style.textDecoration === 'underline' ? 'none' : 'underline')"
            title="下划线"
          ><u>U</u></button>
          <button
            class="action-btn"
            :class="{ active: singleElement.style.textDecoration === 'line-through' }"
            @click="toggleTextStyle('textDecoration', singleElement.style.textDecoration === 'line-through' ? 'none' : 'line-through')"
            title="删除线"
          ><s>S</s></button>
        </template>

        <!-- 图形专属 -->
        <template v-if="singleElement && singleElement.type !== 'text' && singleElement.type !== 'image'">
          <button class="action-btn color-btn" title="填充色">
            <span class="color-swatch" :style="{ background: singleElement.style.fill }"></span>
            <input type="color" class="color-input" :value="singleElement.style.fill" @input="updateFill" />
          </button>
          <button class="action-btn color-btn" title="描边色">
            <span class="color-swatch" :style="{ background: singleElement.style.stroke }"></span>
            <input type="color" class="color-input" :value="singleElement.style.stroke" @input="updateStroke" />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Trash2, Copy, Layers } from 'lucide-vue-next'
import type { CanvasElement } from '@/core/types'
import { useCanvasStore } from '@/core/store/canvas'

const props = defineProps<{ elements: CanvasElement[] }>()

defineEmits<{
  delete: []
  duplicate: []
  bringToFront: []
  sendToBack: []
}>()

const singleElement = computed(() => props.elements.length === 1 ? props.elements[0]! : null)

const store = useCanvasStore()

const toggleTextStyle = (key: string, value: string) => {
  if (!singleElement.value) return
  const updates: Record<string, unknown> = {
    style: { ...singleElement.value.style, [key]: value },
  }
  store.updateElement(singleElement.value.id, updates as Partial<CanvasElement>)
}

const updateFill = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  if (!singleElement.value) return
  store.updateElement(singleElement.value.id, {
    style: { ...singleElement.value.style, fill: val },
  })
}

const updateStroke = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  if (!singleElement.value) return
  store.updateElement(singleElement.value.id, {
    style: { ...singleElement.value.style, stroke: val },
  })
}
</script>

<style scoped>
.floating-toolbar {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 8px 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 12px;
  z-index: 1000;
}

.toolbar-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selection-info {
  color: #495057;
  font-weight: 500;
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.separator {
  width: 1px;
  height: 20px;
  background: #dee2e6;
  margin: 0 4px;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  color: #495057;
  font-size: 12px;
  position: relative;
}

.action-btn:hover { background: #f8f9fa; border-color: #adb5bd; }
.action-btn.active { background: #3498db; color: #fff; border-color: #3498db; }

.action-btn .icon { width: 14px; height: 14px; }
.flip { transform: rotate(180deg); }

.color-btn { padding: 2px; overflow: hidden; }
.color-swatch { display: block; width: 18px; height: 18px; border-radius: 2px; border: 1px solid #ccc; }
.color-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}
</style>
