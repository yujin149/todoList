import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import { buildScheduleItemRequest, fromApiRepeatRule } from '../utils/repeatMapper'

export const useScheduleStore = defineStore('schedule', () => {
  const items = ref([])
  const categories = ref([])
  // 백엔드가 repeatRule 상세를 내려주기 전까지(혹은 일부 환경에서 누락될 때)
  // repeatRuleId -> 프론트 repeat 설정을 캐시해 수정 모달에 그대로 복원한다.
  const repeatRuleCache = ref({})

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

  // 서버에서 전체 일정 목록을 가져와 items 갱신
  async function fetchItems() {
    const res = await axios.get('/api/items')
    items.value = res.data.map(toClientItem)
  }

  // 서버에서 카테고리 목록을 가져와 categories 갱신
  async function fetchCategories() {
    const res = await axios.get('/api/categories')
    categories.value = res.data
  }

  // 새 일정을 서버에 등록하고 로컬 목록에 추가
  async function addItem(payload) {
    const res = await axios.post('/api/items', buildScheduleItemRequest(payload))
    const created = Array.isArray(res.data) ? res.data : [res.data]
    created.forEach((item) => {
      const client = toClientItem(item)
      items.value.push(client)
    })

    // repeat enabled로 생성했고, 서버가 repeatRuleId를 주면 캐시에 저장
    if (payload?.repeat?.enabled) {
      const first = created[0]
      const ruleId = first?.repeatRuleId
      if (ruleId != null) repeatRuleCache.value[String(ruleId)] = payload.repeat
    }
  }

  // 서버 일정을 수정하고 로컬 목록에서 해당 항목 교체
  async function updateItem(payload) {
    const updateType = payload.updateType ?? 'THIS_ONLY'
    const existing = items.value.find((i) => i.id === payload.id)
    // 단건 → 반복 전환 시 서버가 여러 건을 만들지만 응답은 1건뿐이므로 전체 재조회
    const singleToRepeat = !existing?.repeatRuleId && payload?.repeat?.enabled
    const res = await axios.put(`/api/items/${payload.id}`, buildScheduleItemRequest(payload))
    if (updateType !== 'THIS_ONLY' || singleToRepeat) {
      await fetchItems()
      if (singleToRepeat && payload?.repeat?.enabled) {
        const ruleId = res.data?.repeatRuleId
        if (ruleId != null) repeatRuleCache.value[String(ruleId)] = payload.repeat
      }
      return
    }
    const idx = items.value.findIndex((i) => i.id === payload.id)
    if (idx !== -1) items.value[idx] = toClientItem(res.data)
  }

  // 서버에서 일정을 삭제하고 로컬 목록에서 제거
  async function deleteItem(id, updateType = 'THIS_ONLY') {
    await axios.delete(`/api/items/${id}`, { params: { updateType } })
    if (updateType === 'THIS_ONLY') {
      items.value = items.value.filter((i) => i.id !== id)
    } else {
      await fetchItems()
    }
  }

  // 완료 상태를 서버에 반영하고 로컬 항목 갱신
  async function toggleComplete(payload) {
    const res = await axios.patch(`/api/items/${payload.id}/complete`, {
      completed: payload.completed,
    })
    const idx = items.value.findIndex((i) => i.id === payload.id)
    if (idx !== -1) items.value[idx] = toClientItem(res.data)
  }

  // 최대 개수와 중복 검사 후 카테고리를 서버에 등록
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
      return { ok: true, category: res.data }
    } catch {
      return { ok: false, reason: 'error' }
    }
  }

  // 카테고리 정보를 서버에 수정하고 로컬 목록 교체
  async function updateCategory(payload) {
    try {
      const res = await axios.put(`/api/categories/${payload.id}`, {
        name: payload.name,
        color: payload.color || DEFAULT_CATEGORY_COLOR,
        bgColor: payload.bgColor || DEFAULT_CATEGORY_BG,
      })
      const idx = categories.value.findIndex((c) => c.id === payload.id)
      if (idx !== -1) categories.value[idx] = res.data
      return { ok: true, category: res.data }
    } catch {
      return { ok: false, reason: 'error' }
    }
  }

  // 카테고리 삭제 후 연결된 일정을 로컬에서 제거
  async function deleteCategory(categoryId) {
    try {
      await axios.delete(`/api/categories/${categoryId}`)
      categories.value = categories.value.filter((c) => c.id !== categoryId)
      items.value = items.value.filter((item) => item.categoryId !== categoryId)
      return { ok: true }
    } catch {
      return { ok: false, reason: 'error' }
    }
  }

  // API 응답 데이터를 클라이언트 모델 형태로 변환
  function toClientItem(data) {
    const repeatFromApi = fromApiRepeatRule(data)
    const cacheKey = data?.repeatRuleId != null ? String(data.repeatRuleId) : null
    const repeat =
      repeatFromApi.enabled && !data?.repeatType && cacheKey && repeatRuleCache.value[cacheKey]
        ? repeatRuleCache.value[cacheKey]
        : repeatFromApi

    return {
      id: data.id,
      title: data.title,
      emoji: data.emoji ?? '',
      memo: data.memo ?? '',
      startDate: data.startDate,
      endDate: data.endDate,
      priority: data.priority,
      priorityLabel: data.priorityLabel ?? '',
      order: data.sortOrder,
      completed: data.completed,
      completedOrder: data.completedOrder ?? null,
      categoryId: data.categoryId ?? null,
      repeatOrigin: data.repeatOrigin ?? false,
      repeatSeq: data.repeatSeq ?? null,
      repeatRuleId: data.repeatRuleId ?? null,
      repeat,
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
