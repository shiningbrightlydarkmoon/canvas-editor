<template>
  <div class="element-properties">
    <div class="property-group">
      <label>位置</label>
      <div class="position-inputs">
        <input type="number" v-model.number="localX" placeholder="X" />
        <input type="number" v-model.number="localY" placeholder="Y" />
      </div>
    </div>
    <div class="property-group">
      <label>尺寸</label>
      <div class="size-inputs">
        <input type="number" v-model.number="localWidth" placeholder="宽" />
        <input type="number" v-model.number="localHeight" placeholder="高" />
      </div>
    </div>
    <div class="property-group" v-if="element.type === 'text'">
      <label>文本样式</label>
      <div class="text-inputs">
        <input type="number" v-model.number="localFontSize" placeholder="字号" />
        <input type="text" v-model="localFontFamily" placeholder="字体" />
        <input type="color" v-model="localColor" />
      </div>
    </div>
    <div class="property-group">
      <label>填充颜色</label>
      <input type="color" v-model="localFill" />
    </div>
    <div class="property-group">
      <label>描边颜色</label>
      <input type="color" v-model="localStroke" />
    </div>
    <div class="property-group">
      <label>描边宽度</label>
      <input type="number" v-model.number="localStrokeWidth" min="0" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { CanvasElement } from '@/core/types/canvas'

const props = defineProps<{
  element: CanvasElement
}>()

const emit = defineEmits<{
  change: [properties: Partial<CanvasElement>]
}>()

const localX = ref(props.element.x || 0)
const localY = ref(props.element.y || 0)
const localWidth = ref(props.element.width || 100)
const localHeight = ref(props.element.height || 100)
const localFill = ref(props.element.style.fill || '#3498db')
const localStroke = ref(props.element.style.stroke || '#000000')
const localStrokeWidth = ref(props.element.style.strokeWidth || 1)
const localFontSize = ref(props.element.style.fontSize || 16)
const localFontFamily = ref(props.element.style.fontFamily || 'Arial')
const localColor = ref(props.element.style.color || '#2c3e50')

watch(
  [
    localX,
    localY,
    localWidth,
    localHeight,
    localFill,
    localStroke,
    localStrokeWidth,
    localFontSize,
    localFontFamily,
    localColor,
  ],
  () => {
    const changes: Partial<CanvasElement> = {
      x: localX.value,
      y: localY.value,
      width: localWidth.value,
      height: localHeight.value,
      style: {
        ...props.element.style,
        fill: localFill.value,
        stroke: localStroke.value,
        strokeWidth: localStrokeWidth.value,
      },
    }

    if (props.element.type === 'text') {
      changes.style!.fontSize = localFontSize.value
      changes.style!.fontFamily = localFontFamily.value
      changes.style!.color = localColor.value
    }

    emit('change', changes)
  },
)
</script>

<style scoped>
.element-properties {
  padding: 4px 0;
}

.property-group {
  margin-bottom: 16px;
}

.property-group label {
  display: block;
  font-size: 12px;
  color: #6c757d;
  margin-bottom: 4px;
  font-weight: 500;
}

.position-inputs,
.size-inputs,
.text-inputs {
  display: flex;
  gap: 8px;
}

.position-inputs input,
.size-inputs input,
.text-inputs input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 12px;
}

.position-inputs input:focus,
.size-inputs input:focus,
.text-inputs input:focus {
  outline: none;
  border-color: #3498db;
}

input[type='color'] {
  height: 32px;
  cursor: pointer;
}

.text-inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.text-inputs input {
  width: 100%;
}
</style>
