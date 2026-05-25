<template>
  <div
    class="text-edit-overlay"
    :style="overlayStyle"
  >
    <textarea
      ref="textareaRef"
      v-model="editText"
      class="edit-textarea"
      :style="textareaStyle"
      @keydown.enter.prevent="commit"
      @keydown.escape.prevent="cancel"
      @blur="commit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import type { CanvasElement } from '@/core/types'

const props = defineProps<{
  element: CanvasElement
  zoom: number
  panX: number
  panY: number
}>()

const emit = defineEmits<{
  commit: [content: string]
  cancel: []
}>()

const textareaRef = ref<HTMLTextAreaElement>()
const editText = ref(props.element.content || '')

// Convert canvas coordinates to screen position
const overlayStyle = computed(() => {
  const sx = props.element.x * props.zoom + props.panX
  const sy = props.element.y * props.zoom + props.panY
  return {
    left: `${sx}px`,
    top: `${sy}px`,
    width: `${props.element.width * props.zoom}px`,
    minHeight: `${props.element.height * props.zoom}px`,
  }
})

const textareaStyle = computed(() => ({
  fontSize: `${(props.element.style.fontSize ?? 16) * props.zoom}px`,
  fontFamily: props.element.style.fontFamily ?? 'Arial',
  color: props.element.style.color ?? '#2c3e50',
  fontWeight: props.element.style.fontWeight ?? 'normal',
  fontStyle: props.element.style.fontStyle ?? 'normal',
}))

const commit = () => {
  if (editText.value !== props.element.content) {
    emit('commit', editText.value)
  } else {
    emit('cancel')
  }
}

const cancel = () => {
  editText.value = props.element.content || ''
  emit('cancel')
}

onMounted(async () => {
  await nextTick()
  textareaRef.value?.focus()
  textareaRef.value?.select()
})
</script>

<style scoped>
.text-edit-overlay {
  position: absolute;
  z-index: 2000;
  pointer-events: auto;
}

.edit-textarea {
  width: 100%;
  min-height: 100%;
  padding: 4px;
  border: 2px solid #3498db;
  border-radius: 2px;
  outline: none;
  resize: none;
  background: rgba(255, 255, 255, 0.95);
  line-height: 1.4;
  overflow: hidden;
  box-sizing: border-box;
}
</style>
