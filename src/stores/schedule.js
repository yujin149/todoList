import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export const useScheduleStore = defineStore('schedule', () => {
  const items = ref([])
  const categories = ref([])

  const MAX_CATEGORIES = 8
  const DEFAULT_CATEGORY_COLOR = '#333333'
  const DEFAULT_CATEGORY_BG = 'rgba(51, 51, 51, 0.08)'
  const CATEGORY_COLOR_PRESETS = [
    { color: '#d9363e', bgColor: 'rgba(255, 77, 79, 0.08)' },
    { color: '#fa8c16', bgColor: 'rgba(250, 140, 22, 0.08)' },
    { color: '#faad14', bgColor: 'rgba(250, 173, 20, 0.08)' },
    { color: '#52c41a', bgColor: 'rgba(82, 196, 26, 0.08)' },
    { color: '#13c2c2', bgColor: 'rgba(19, 194, 194, 0.08)' },
    { color: '#36a2eb', bgColor: 'rgba(54, 162, 235, 0.08)' },
    { color: '#722ed1', bgColor: 'rgba(114, 46, 209, 0.08)' },
    { color: '#eb2f96', bgColor: 'rgba(235, 47, 150, 0.08)' },
  ]

  async function fetchItems() {
    const res = await axios.get('/api/items')
    items.value = res.data.map(toClientItem)
  }

  async function fetchCategories() {
    const res = await axios.get('/api/categories')
    categories.value = res.data
  }

  async function addItem(payload) {
    const res = await axios.post('/api/items', {
      title: payload.title,
      memo: payload.memo,
      startDate: payload.startDate,
      endDate: payload.endDate || payload.startDate,
      priority: payload.priority,
      priorityLabel: payload.priorityText ?? '',
      categoryId: payload.categoryId ?? null,
    })
    items.value.push(toClientItem(res.data))
  }

  async function updateItem(payload) {
    const res = await axios.put(`/api/items/${payload.id}`, {
      title: payload.title,
      memo: payload.memo,
      startDate: payload.startDate,
      endDate: payload.endDate || payload.startDate,
      priority: payload.priority,
      priorityLabel: payload.priorityText ?? '',
      categoryId: payload.categoryId ?? null,
    })
    const idx = items.value.findIndex((i) => i.id === payload.id)
    if (idx !== -1) items.value[idx] = toClientItem(res.data)
  }

  async function deleteItem(id) {
    await axios.delete(`/api/items/${id}`)
    items.value = items.value.filter((i) => i.id !== id)
  }

  async function toggleComplete(payload) {
    const res = await axios.patch(`/api/items/${payload.id}/complete`, {
      completed: payload.completed,
    })
    const idx = items.value.findIndex((i) => i.id === payload.id)
    if (idx !== -1) items.value[idx] = toClientItem(res.data)
  }

  async function addCategory(name, color, bgColor) {
    if (categories.value.length >= MAX_CATEGORIES) return { ok: false, reason: 'max' }
    const exists = categories.value.some((c) => c.name === name.trim())
    if (exists) return { ok: false, reason: 'duplicate' }
    try {
      const res = await axios.post('/api/categories', {
        name: name.trim(),
        color: color || DEFAULT_CATEGORY_COLOR,
        bgColor: bgColor || DEFAULT_CATEGORY_BG,
      })
      categories.value.push(res.data)
      return { ok: true }
    } catch {
      return { ok: false, reason: 'error' }
    }
  }

  async function updateCategory(payload) {
    try {
      const res = await axios.put(`/api/categories/${payload.id}`, {
        name: payload.name,
        color: payload.color || DEFAULT_CATEGORY_COLOR,
        bgColor: payload.bgColor || DEFAULT_CATEGORY_BG,
      })
      const idx = categories.value.findIndex((c) => c.id === payload.id)
      if (idx !== -1) categories.value[idx] = res.data
      return { ok: true }
    } catch {
      return { ok: false, reason: 'error' }
    }
  }

  async function deleteCategory(categoryId) {
    try {
      await axios.delete(`/api/categories/${categoryId}`)
      categories.value = categories.value.filter((c) => c.id !== categoryId)
      items.value = items.value.map((item) =>
        item.categoryId === categoryId ? { ...item, categoryId: null } : item,
      )
      return { ok: true }
    } catch {
      return { ok: false, reason: 'error' }
    }
  }

  function toClientItem(data) {
    return {
      id: data.id,
      title: data.title,
      memo: data.memo ?? '',
      startDate: data.startDate,
      endDate: data.endDate,
      priority: data.priority,
      priorityLabel: data.priorityLabel ?? '',
      order: data.sortOrder,
      completed: data.completed,
      completedOrder: data.completedOrder ?? null,
      categoryId: data.categoryId ?? null,
    }
  }

  return {
    items,
    categories,
    MAX_CATEGORIES,
    CATEGORY_COLOR_PRESETS,
    DEFAULT_CATEGORY_COLOR,
    DEFAULT_CATEGORY_BG,
    fetchItems,
    fetchCategories,
    addItem,
    updateItem,
    deleteItem,
    toggleComplete,
    addCategory,
    updateCategory,
    deleteCategory,
  }
})
