<script setup>
import { ref, watch } from 'vue'
import { useScheduleStore } from '../../stores/schedule'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  mode: {
    type: String,
    default: 'add',
    validator: (v) => v === 'add' || v === 'edit',
  },
  /** 수정 모드일 때 대상 카테고리 */
  category: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['saved'])
const store = useScheduleStore()

const categoryName = ref('')
const categoryColor = ref(store.DEFAULT_CATEGORY_COLOR)
const categoryBgColorHex = ref(store.DEFAULT_CATEGORY_COLOR)

function colorHexToSoftRgba(hex) {
  const normalized = String(hex || '').trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return store.DEFAULT_CATEGORY_BG
  const r = parseInt(normalized.slice(1, 3), 16)
  const g = parseInt(normalized.slice(3, 5), 16)
  const b = parseInt(normalized.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, 0.08)`
}

function extractHexFromColor(colorValue, fallbackHex) {
  if (typeof colorValue !== 'string') return fallbackHex
  const raw = colorValue.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw
  const matched = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!matched) return fallbackHex
  const r = Math.max(0, Math.min(255, Number(matched[1]) || 0))
  const g = Math.max(0, Math.min(255, Number(matched[2]) || 0))
  const b = Math.max(0, Math.min(255, Number(matched[3]) || 0))
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function resetForm() {
  categoryName.value = ''
  categoryColor.value = store.DEFAULT_CATEGORY_COLOR
  categoryBgColorHex.value = store.DEFAULT_CATEGORY_COLOR
}

function syncFormFromProps() {
  if (props.mode === 'edit' && props.category) {
    categoryName.value = props.category.name
    categoryColor.value = props.category.color || store.DEFAULT_CATEGORY_COLOR
    categoryBgColorHex.value = extractHexFromColor(
      props.category.bgColor,
      categoryColor.value,
    )
  } else {
    resetForm()
  }
}

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) syncFormFromProps()
    else resetForm()
  },
)

function close() {
  open.value = false
}

function onTextColorChange() {
  categoryBgColorHex.value = categoryColor.value
}

function applyPreset(preset) {
  categoryColor.value = preset.color
  categoryBgColorHex.value = preset.color
}

async function submitCategory() {
  const name = categoryName.value.trim()
  if (!name) {
    alert('카테고리명을 입력해 주세요.')
    return
  }
  const bgColor = colorHexToSoftRgba(categoryBgColorHex.value)
  const result =
    props.mode === 'edit' && props.category
      ? await store.updateCategory({
        id: props.category.id,
        name,
        color: categoryColor.value,
        bgColor,
      })
      : await store.addCategory(name, categoryColor.value, bgColor)
  if (!result.ok) {
    if (result.reason === 'duplicate') {
      alert('같은 이름의 카테고리가 이미 있어요.')
      return
    }
    if (result.reason === 'max') {
      alert(`카테고리는 최대 ${store.MAX_CATEGORIES}개까지 추가할 수 있어요.`)
      return
    }
    alert('카테고리 저장에 실패했어요.')
    return
  }
  emit('saved', { mode: props.mode, category: result.category })
  close()
}
</script>

<template>
  <div v-if="open" class="categoryModalLayer" @click.self="close">
    <div class="categoryModal">
      <h3 class="categoryModalTitle">{{ mode === 'edit' ? '카테고리 수정' : '카테고리 추가' }}</h3>
      <input
        v-model="categoryName"
        type="text"
        maxlength="20"
        placeholder="카테고리명을 입력해 주세요."
        @keydown.enter.prevent="submitCategory"
      >
      <div class="colorField">
        <p class="colorTitle">카테고리 색상</p>
        <div class="colorInputs">
          <label class="colorInput">
            <span>텍스트 색상</span>
            <input v-model="categoryColor" type="color" @input="onTextColorChange">
          </label>
          <label class="colorInput">
            <span>배경 색상</span>
            <input v-model="categoryBgColorHex" type="color">
          </label>
        </div>
        <div class="presetList">
          <button
            v-for="(preset, idx) in store.CATEGORY_COLOR_PRESETS"
            :key="idx"
            type="button"
            class="presetBtn"
            :style="{ color: preset.color, backgroundColor: preset.bgColor }"
            @click="applyPreset(preset)"
          >
            샘플색상
          </button>
        </div>
        <p class="previewText">
          미리보기:
          <span
            class="previewTag"
            :style="{
              borderColor: categoryColor,
              color: categoryColor,
              backgroundColor: colorHexToSoftRgba(categoryBgColorHex),
            }"
          >
            {{ categoryName || '카테고리명' }}
          </span>
        </p>
      </div>
      <div class="categoryModalBtns">
        <button type="button" class="commBtn addBtn" @click="submitCategory">
          {{ mode === 'edit' ? '수정' : '추가' }}
        </button>
        <button type="button" class="commBtn" @click="close">취소</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.categoryModalLayer {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--bg-opacity60);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.categoryModal {
  width: 100%;
  max-width: 30rem;
  background: var(--color-white);
  border-radius: 0.8rem;
  padding: 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.categoryModalTitle {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
}

.colorField {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.colorTitle {
  margin: 1rem 0 0;
  font-size: 1.4rem;
  font-weight: 700;
}

.colorInputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--color-border);
}

.colorInput {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 1.3rem;
  padding: 0.2rem 1rem;
  color: var(--color-gray-700);
}

.colorInput:last-child {
  border-left: 1px solid var(--color-border);
}

.colorInput input[type='color'] {
  width: 3rem;
  height: 3rem;
  border: none;
  background: transparent;
  padding: 0;
}

.presetList {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
}

.presetBtn {
  min-height: 3rem;
  font-size: 1.2rem;
  font-weight: 700;
  border-radius: 0.2rem;
}

.previewText {
  margin: 0;
  font-size: 1.2rem;
  color: var(--color-gray-500);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: 1rem 0.5rem;
}

.previewTag {
  display: inline-flex;
  margin-left: 0.4rem;
  padding: 0.3rem 0.8rem;
  border-radius: 0.3rem;
  font-weight: 600;
}

.categoryModalBtns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.categoryModalBtns .commBtn {
  border: 0.1rem solid var(--color-border);
  height: 4rem;
  background: var(--color-white);
}

.categoryModalBtns .commBtn.addBtn {
  background: var(--color-point);
  color: var(--color-white);
  border-color: var(--color-point);
}
</style>
