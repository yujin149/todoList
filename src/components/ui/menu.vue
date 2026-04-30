<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useScheduleStore } from '../../stores/schedule'

defineOptions({
  name: 'SideMenuPanel',
})

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  selectedCategoryId: {
    type: [String, Number],
    default: 'all',
  },
})

const emit = defineEmits(['close', 'select-category'])
const store = useScheduleStore()
const showCategoryModal = ref(false)
const categoryModalMode = ref('add')
const editingCategoryId = ref(null)
const openDropdownId = ref(null)
const categoryName = ref('')
const categoryColor = ref(store.DEFAULT_CATEGORY_COLOR)
const categoryBgColorHex = ref(store.DEFAULT_CATEGORY_COLOR)
const isCategoryLimitReached = computed(() => store.categories.length >= store.MAX_CATEGORIES)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      closeCategoryModal()
      openDropdownId.value = null
    }
  },
)

function closeMenu() {
  emit('close')
}

function selectCategory(categoryId) {
  emit('select-category', categoryId)
  emit('close')
}

function openCategoryModal(mode, category = null) {
  if (mode === 'add' && isCategoryLimitReached.value) {
    alert(`카테고리는 최대 ${store.MAX_CATEGORIES}개까지 추가할 수 있어요.`)
    return
  }
  categoryModalMode.value = mode
  if (mode === 'edit' && category) {
    editingCategoryId.value = category.id
    categoryName.value = category.name
    categoryColor.value = category.color || store.DEFAULT_CATEGORY_COLOR
    categoryBgColorHex.value = extractHexFromColor(category.bgColor, categoryColor.value)
  } else {
    editingCategoryId.value = null
    categoryName.value = ''
    categoryColor.value = store.DEFAULT_CATEGORY_COLOR
    categoryBgColorHex.value = store.DEFAULT_CATEGORY_COLOR
  }
  showCategoryModal.value = true
}

function closeCategoryModal() {
  showCategoryModal.value = false
  categoryModalMode.value = 'add'
  editingCategoryId.value = null
  categoryName.value = ''
  categoryColor.value = store.DEFAULT_CATEGORY_COLOR
  categoryBgColorHex.value = store.DEFAULT_CATEGORY_COLOR
}

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

function onTextColorChange() {
  categoryBgColorHex.value = categoryColor.value
}

function applyPreset(preset) {
  categoryColor.value = preset.color
  categoryBgColorHex.value = preset.color
}

function submitCategory() {
  const bgColor = colorHexToSoftRgba(categoryBgColorHex.value)
  const result =
    categoryModalMode.value === 'edit'
      ? store.updateCategory({
          id: editingCategoryId.value,
          name: categoryName.value,
          color: categoryColor.value,
          bgColor,
        })
      : store.addCategory(categoryName.value, categoryColor.value, bgColor)
  if (!result.ok) {
    if (result.reason === 'empty') {
      alert('카테고리명을 입력해 주세요.')
      return
    }
    if (result.reason === 'duplicate') {
      alert('같은 이름의 카테고리가 이미 있어요.')
      return
    }
    if (result.reason === 'max') {
      alert(`카테고리는 최대 ${store.MAX_CATEGORIES}개까지 추가할 수 있어요.`)
      return
    }
  }
  closeCategoryModal()
  openDropdownId.value = null
}

function toggleCategoryMenu(categoryId) {
  openDropdownId.value = openDropdownId.value === categoryId ? null : categoryId
}

/** 더보기 버튼·드롭다운 외부 클릭 시 메뉴만 닫기 */
function onDocumentClickCloseDropdown(e) {
  if (openDropdownId.value == null) return
  const target = e.target
  if (!(target instanceof Element)) return
  if (target.closest('.menuMoreWrap')) return
  openDropdownId.value = null
}

onMounted(() => {
  document.addEventListener('click', onDocumentClickCloseDropdown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClickCloseDropdown)
})

function startEditCategory(category) {
  openDropdownId.value = null
  openCategoryModal('edit', category)
}

function removeCategory(category) {
  openDropdownId.value = null
  const ok = confirm(`"${category.name}" 카테고리를 삭제할까요?`)
  if (!ok) return
  const result = store.deleteCategory(category.id)
  if (!result.ok) {
    alert('카테고리 삭제에 실패했어요.')
    return
  }
  if (props.selectedCategoryId === category.id) {
    emit('select-category', 'all')
  }
}
</script>

<template>
  <div v-if="open" class="menuLayer is-open" @click.self="closeMenu">
    <aside class="menuPanel" aria-label="카테고리 메뉴">
      <button type="button" class="menuCloseBtn" @click="closeMenu">
          <svg
            class="closeIcon"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13 13L7.00002 7.00002M7.00002 7.00002L1 1M7.00002 7.00002L13 1M7.00002 7.00002L1 13"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          닫기
        </button>
      <ul class="menuList">
        <li
          class="menuItemRow"
          :class="{ 'is-active': selectedCategoryId === 'all' }"
          :style="{ '--item-active-bg': 'var(--color-gray-100)', '--item-active-color': 'var(--color-gray-900)' }"
        >
          <button
            type="button"
            class="menuItemBtn"
            @click="selectCategory('all')"
          >
            전체
          </button>
        </li>
        <li
          v-for="category in store.categories"
          :key="category.id"
          class="menuItemRow"
          :class="{ 'is-active': String(selectedCategoryId) === String(category.id) }"
          :style="{
            '--item-active-bg': category.bgColor || 'var(--color-gray-100)',
            '--item-active-color': category.color || 'var(--color-gray-900)',
          }"
        >
          <button
            type="button"
            class="menuItemBtn"
            @click="selectCategory(category.id)"
          >
            <span class="categoryColor" :style="{ background: category.color }"></span>
            {{ category.name }}
          </button>
          <div class="menuMoreWrap">
            <button
              type="button"
              class="menuMoreBtn"
              aria-label="카테고리 더보기"
              @click.stop="toggleCategoryMenu(category.id)"
            >
              <svg viewBox="0 0 2 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 9C0 9.55228 0.447715 10 1 10C1.55228 10 2 9.55228 2 9C2 8.44772 1.55228 8 1 8C0.447715 8 0 8.44772 0 9Z" fill="currentColor"/>
                <path d="M0 5C0 5.55228 0.447715 6 1 6C1.55228 6 2 5.55228 2 5C2 4.44772 1.55228 4 1 4C0.447715 4 0 4.44772 0 5Z" fill="currentColor"/>
                <path d="M0 1C0 1.55228 0.447715 2 1 2C1.55228 2 2 1.55228 2 1C2 0.447715 1.55228 0 1 0C0.447715 0 0 0.447715 0 1Z" fill="currentColor"/>
              </svg>
            </button>
            <div v-if="openDropdownId === category.id" class="menuDropdown">
              <button type="button" class="dropdownItem" @click.stop="startEditCategory(category)">수정</button>
              <button type="button" class="dropdownItem is-danger" @click.stop="removeCategory(category)">
                삭제
              </button>
            </div>
          </div>
        </li>
      </ul>
      <div class="menuFoot">
        <button type="button" class="menuAddBtn" @click="openCategoryModal('add')">카테고리 추가</button>
      </div>
    </aside>

    <div v-if="showCategoryModal" class="categoryModalLayer" @click.self="closeCategoryModal">
      <div class="categoryModal">
        <h3 class="categoryModalTitle">{{ categoryModalMode === 'edit' ? '카테고리 수정' : '카테고리 추가' }}</h3>
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
              :style="{borderColor:categoryColor, color: categoryColor, backgroundColor: colorHexToSoftRgba(categoryBgColorHex) }"
            >
              {{ categoryName || '카테고리명' }}
            </span>
          </p>
        </div>
        <div class="categoryModalBtns">
          <button type="button" class="commBtn addBtn" @click="submitCategory">
            {{ categoryModalMode === 'edit' ? '수정' : '추가' }}
          </button>
          <button type="button" class="commBtn" @click="closeCategoryModal">취소</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menuLayer {
  position: absolute;
  inset: 0;
  z-index: 30;
  background: transparent;
  pointer-events: none;
}

.menuLayer.is-open {
  background: var(--bg-opacity70);
  pointer-events: auto;
}

.menuPanel {
  position: absolute;
  top: 0;
  left: 0;
  width: calc(100% - 10rem);
  height: 100%;
  background: var(--color-white);
  border-right: 0.1rem solid var(--color-border);
  transform: translateX(-100%);
  transition: transform 0.22s ease;
  display: flex;
  flex-direction: column;
}

.menuLayer.is-open .menuPanel {
  transform: translateX(0);
  position:relative;
}

.menuCloseBtn {
  position:fixed;
  top:0.6rem;
  left:calc(100% + 1rem);
  font-size: 0;
  letter-spacing: -9999px;
  display: flex;
  justify-content: center;
  align-items: center;
  padding:0;
  width:4rem;
  height:4rem;
  outline-offset: -3px;
}
.menuCloseBtn .closeIcon{
  color: var(--color-white);
  width: 2rem;
  height: 2rem;
}

.menuList {
  margin: 0;
  padding: 1.2rem;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap:1rem;
}

.menuList li.is-active{
  background: var(--item-active-bg, var(--color-gray-100));
  border-radius: 0.6rem;;
}


.menuItemRow {
  display: flex;
  position: relative;
}

.menuItemBtn {
  width: 100%;
  min-height: 4.6rem;
  text-align: left;
  padding: 0 1.2rem;
  font-size: 1.4rem;
  color:var(--color-gray-700);
  font-weight:600;
}

.menuList li.is-active .menuItemBtn{
  color: var(--item-active-color, var(--color-gray-900));
  font-weight:700;
}

.menuItemRow .categoryColor{
  display:inline-block;
  width:0.6rem;
  height:0.6rem;
  border-radius: 50%;
  vertical-align: middle;
  margin-top:-0.2rem;
  margin-right:0.2rem;
}



.menuMoreWrap {
  position:relative;
}

.menuMoreBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width:4rem;
  height:100%;
  
}

.menuMoreBtn svg {
  width: 0.5rem;
  height: 1.6rem;
  color:var(--color-gray-700);
}

.menuDropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 0.4rem);
  width: 10rem;
  background: var(--color-white);
  border: 0.1rem solid var(--color-border);
  border-radius: 0.4rem;
  overflow: hidden;
  z-index: 32;
}

.dropdownItem {
  width: 100%;
  min-height: 3.4rem;
  border: none;
  border-bottom: 0.1rem solid var(--color-border);
  background: var(--color-white);
  font-size:1.2rem;
  font-weight:600;
  color:var(--color-gray-700);
}

.dropdownItem:last-child {
  border-bottom: none;
}

.dropdownItem.is-danger {
  color: var(--priority-urgent);
}

.dropdownItem:hover{
  background:var(--color-gray-100);
}

.menuFoot {
  margin-top: auto;
  padding: 1.2rem;
  border-top: 0.1rem solid var(--color-border);
}

.menuAddBtn {
  width: 100%;
  height: 4.6rem;
  border: 0.1rem solid var(--color-border);
  border-radius: 0.4rem;
  background: var(--color-white);
}
.menuAddBtn:hover{
  background:var(--color-gray-100);
}

.categoryModalLayer {
  position: absolute;
  inset: 0;
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
  font-weight:700;
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
  border:1px solid var(--color-border);
}

.colorInput {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 1.3rem;
  padding:0.2rem 1rem;
  color:var(--color-gray-700);
}
.colorInput:last-child{
  border-left:1px solid var(--color-border);
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
  border-top:1px solid var(--color-border);
  border-bottom:1px solid var(--color-border);
  padding:1rem 0.5rem;

}

.previewTag {
  display: inline-flex;
  margin-left: 0.4rem;
  padding: 0.3rem 0.8rem;
  border-radius: 0.3rem;
  font-weight:600;
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
  border-color:var(--color-point);
}
</style>
