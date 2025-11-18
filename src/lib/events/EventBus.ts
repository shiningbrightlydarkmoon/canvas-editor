export const EventBus = {
  events: {} as Record<string, ((data?: any) => void)[]>,

  on(event: string, callback: (data?: any) => void) {
    if (!this.events[event]) this.events[event] = []
    this.events[event].push(callback)
  },

  emit(event: string, data?: any) {
    this.events[event]?.forEach((cb) => cb(data))
  },
}

export const CANVAS_EVENTS = {
  ELEMENT_SELECTED: 'element:selected',
  ELEMENTS_MOVED: 'elements:moved',
  VIEWPORT_CHANGED: 'viewport:changed',
  TOOL_CHANGED: 'tool:changed',
}
