// 工具函数
/**
 * 生成唯一ID
 *  格式: el_时间戳_随机数
 */
export const generateId = (): string => {
  return `el_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * 生成历史记录ID
 */
export const generateHistoryId = (): string => {
  return `hist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 防抖函数
 */
export const debounce = <T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let timeout: number
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * 节流函数
 * @param func 要节流的函数
 * @param limit  时间限制
 * @returns 节流后的函数
 */
export const throttle = <T extends (...args: unknown[]) => void>(
  func: T,
  limit: number,
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 深拷贝
 * 递归复制对象的所有属性，包括嵌套对象和数组
 * @param obj  要拷贝的对象
 * @returns 深拷贝后的新对象
 */
export const deepClone = <T>(obj: T): T => {
  // 基本类型和null直接返回
  if (obj === null || typeof obj !== 'object') return obj
  // 处理Date对象
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  // 处理数组
  if (obj instanceof Array) return obj.map((item) => deepClone(item)) as unknown as T
  // 处理普通对象
  const cloned = {} as T
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  return cloned
}

/**
 * 生成随机颜色
 * @returns 随机颜色的十六进制字符串
 */
export const generateRandomColor = (): string => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// export const generateRandomColor = (): string => {
//   return `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`;
// }

