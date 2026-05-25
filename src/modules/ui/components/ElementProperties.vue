<template>
  <div class="element-properties">
    <!-- 名称 -->
    <div class="property-group">
      <label>名称</label>
      <input type="text" v-model="localName" class="full-width" />
    </div>

    <!-- 位置 -->
    <div class="property-group">
      <label>位置</label>
      <div class="two-col">
        <input type="number" v-model.number="localX" placeholder="X" />
        <input type="number" v-model.number="localY" placeholder="Y" />
      </div>
    </div>

    <!-- 尺寸 -->
    <div class="property-group">
      <label>尺寸</label>
      <div class="two-col">
        <input type="number" v-model.number="localWidth" placeholder="宽" min="1" />
        <input type="number" v-model.number="localHeight" placeholder="高" min="1" />
      </div>
    </div>

    <!-- 旋转 -->
    <div class="property-group">
      <label>旋转</label>
      <input type="number" v-model.number="localRotation" class="full-width" step="1" />
    </div>

    <!-- 透明度 -->
    <div class="property-group">
      <label>透明度</label>
      <input type="range" v-model.number="localOpacity" min="0" max="1" step="0.01" class="full-width" />
      <span class="range-val">{{ Math.round(localOpacity * 100) }}%</span>
    </div>

    <!-- 圆角 (仅矩形) -->
    <div class="property-group" v-if="element.type === 'rect'">
      <label>圆角</label>
      <input type="number" v-model.number="localCornerRadius" min="0" class="full-width" />
    </div>

    <!-- 填充 -->
    <div class="property-group">
      <label>填充颜色</label>
      <div class="color-row">
        <input type="color" v-model="localFill" />
        <button class="mini-btn" @click="localFill = 'transparent'">透明</button>
      </div>
    </div>

    <!-- 描边 -->
    <div class="property-group">
      <label>描边颜色</label>
      <input type="color" v-model="localStroke" />
    </div>
    <div class="property-group">
      <label>描边宽度</label>
      <input type="number" v-model.number="localStrokeWidth" min="0" class="full-width" />
    </div>

    <!-- 文本专属 -->
    <template v-if="element.type === 'text'">
      <div class="property-group">
        <label>文本内容</label>
        <textarea v-model="localContent" class="full-width" rows="2" />
      </div>
      <div class="property-group">
        <label>字号</label>
        <input type="number" v-model.number="localFontSize" min="8" max="200" class="full-width" />
      </div>
      <div class="property-group">
        <label>字体</label>
        <select v-model="localFontFamily" class="full-width">
          <option value="Arial">Arial</option>
          <option value="Microsoft YaHei">微软雅黑</option>
          <option value="SimSun">宋体</option>
          <option value="SimHei">黑体</option>
          <option value="Courier New">Courier New</option>
          <option value="Times New Roman">Times New Roman</option>
        </select>
      </div>
      <div class="property-group">
        <label>字体颜色</label>
        <input type="color" v-model="localColor" />
      </div>
      <div class="property-group">
        <label>样式</label>
        <div class="bius-row">
          <button class="bius-btn" :class="{ active: fontWeight === 'bold' }" @click="toggleBold" title="加粗">B</button>
          <button class="bius-btn" :class="{ active: fontStyle === 'italic' }" @click="toggleItalic" title="斜体"><i>I</i></button>
          <button class="bius-btn" :class="{ active: textDecoration === 'underline' }" @click="toggleUnderline" title="下划线"><u>U</u></button>
          <button class="bius-btn" :class="{ active: textDecoration === 'line-through' }" @click="toggleStrikethrough" title="删除线"><s>S</s></button>
        </div>
      </div>
    </template>

    <!-- 图片专属 -->
    <template v-if="element.type === 'image'">
      <div class="property-group">
        <label>图片地址</label>
        <input type="text" v-model="localImageUrl" class="full-width" placeholder="https://..." />
      </div>
    </template>

    <!-- 锁定 -->
    <div class="property-group">
      <label>
        <input type="checkbox" v-model="localLocked" /> 锁定元素
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { CanvasElement, FontWeight, FontStyle } from '@/core/types'

const props = defineProps<{ element: CanvasElement }>()

const emit = defineEmits<{ change: [properties: Record<string, unknown>] }>()

// Local state
const localName = ref(props.element.name || '')
const localX = ref(props.element.x)
const localY = ref(props.element.y)
const localWidth = ref(props.element.width)
const localHeight = ref(props.element.height)
const localRotation = ref(props.element.rotation || 0)
const localOpacity = ref(props.element.opacity ?? 1)
const localFill = ref(props.element.style.fill || '#3498db')
const localStroke = ref(props.element.style.stroke || '#000000')
const localStrokeWidth = ref(props.element.style.strokeWidth ?? 1)
const localCornerRadius = ref(props.element.style.cornerRadius ?? 0)
const localFontSize = ref(props.element.style.fontSize ?? 16)
const localFontFamily = ref(props.element.style.fontFamily ?? 'Arial')
const localColor = ref(props.element.style.color ?? '#2c3e50')
const localContent = ref(props.element.content || '')
const localImageUrl = ref(props.element.imageUrl || '')
const localLocked = ref(props.element.isLocked ?? false)

// BIUS toggle states
const fontWeight = ref<FontWeight>(props.element.style.fontWeight ?? 'normal')
const fontStyle = ref<FontStyle>(props.element.style.fontStyle ?? 'normal')
const textDecoration = ref(props.element.style.textDecoration ?? 'none')

const toggleBold = () => { fontWeight.value = fontWeight.value === 'bold' ? 'normal' : 'bold' }
const toggleItalic = () => { fontStyle.value = fontStyle.value === 'italic' ? 'normal' : 'italic' }
const toggleUnderline = () => { textDecoration.value = textDecoration.value === 'underline' ? 'none' : 'underline' }
const toggleStrikethrough = () => { textDecoration.value = textDecoration.value === 'line-through' ? 'none' : 'line-through' }

// Build change object
const buildChanges = (): Record<string, unknown> => {
  const changes: Record<string, unknown> = {
    name: localName.value,
    x: localX.value,
    y: localY.value,
    width: localWidth.value,
    height: localHeight.value,
    rotation: localRotation.value,
    opacity: localOpacity.value,
    isLocked: localLocked.value,
    style: {
      ...props.element.style,
      fill: localFill.value,
      stroke: localStroke.value,
      strokeWidth: localStrokeWidth.value,
      cornerRadius: localCornerRadius.value,
    },
  }

  if (props.element.type === 'text') {
    changes.content = localContent.value
    ;(changes.style as Record<string, unknown>).fontSize = localFontSize.value
    ;(changes.style as Record<string, unknown>).fontFamily = localFontFamily.value
    ;(changes.style as Record<string, unknown>).color = localColor.value
    ;(changes.style as Record<string, unknown>).fontWeight = fontWeight.value
    ;(changes.style as Record<string, unknown>).fontStyle = fontStyle.value
    ;(changes.style as Record<string, unknown>).textDecoration = textDecoration.value
  }

  if (props.element.type === 'image') {
    changes.imageUrl = localImageUrl.value
  }

  return changes
}

// Emit changes on any modification
watch(
  [
    localName, localX, localY, localWidth, localHeight, localRotation, localOpacity,
    localFill, localStroke, localStrokeWidth, localCornerRadius,
    localFontSize, localFontFamily, localColor, localContent, localImageUrl, localLocked,
    fontWeight, fontStyle, textDecoration,
  ],
  () => { emit('change', buildChanges()) },
)
</script>

<style scoped>
.element-properties { padding: 4px 0; }

.property-group { margin-bottom: 14px; }

.property-group label {
  display: block;
  font-size: 12px;
  color: #6c757d;
  margin-bottom: 4px;
  font-weight: 500;
}

.two-col { display: flex; gap: 8px; }
.two-col input { flex: 1; }

.full-width { width: 100%; }

.property-group input[type='text'],
.property-group input[type='number'],
.property-group textarea,
.property-group select {
  padding: 6px 8px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 12px;
}

.property-group input:focus,
.property-group textarea:focus,
.property-group select:focus {
  outline: none;
  border-color: #3498db;
}

.property-group textarea { resize: vertical; }

.property-group input[type='color'] {
  height: 32px;
  cursor: pointer;
  padding: 2px;
}

.color-row { display: flex; gap: 8px; align-items: center; }
.color-row input[type='color'] { flex: 1; }

.mini-btn {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  white-space: nowrap;
}
.mini-btn:hover { background: #f8f9fa; }

.range-val { font-size: 11px; color: #6c757d; margin-left: 4px; }

.bius-row { display: flex; gap: 2px; }

.bius-btn {
  width: 32px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid #dee2e6; border-radius: 4px;
  background: #fff; cursor: pointer;
  font-size: 13px; font-weight: 600;
}
.bius-btn:hover { background: #f8f9fa; }
.bius-btn.active { background: #3498db; color: #fff; border-color: #3498db; }

input[type='checkbox'] { cursor: pointer; }
</style>
