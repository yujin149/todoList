<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CategoryFormModal from './CategoryFormModal.vue'
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
const editingCategory = ref(null)
const openDropdownId = ref(null)
const showDeleteConfirm = ref(false)
const categoryToDelete = ref(null)
const isCategoryLimitReached = computed(() => store.categories.length >= store.MAX_CATEGORIES)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      closeCategoryModal()
      closeDeleteConfirm()
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
  editingCategory.value = mode === 'edit' && category ? category : null
  showCategoryModal.value = true
}

function closeCategoryModal() {
  showCategoryModal.value = false
  categoryModalMode.value = 'add'
  editingCategory.value = null
}

function onCategorySaved() {
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

function hasSchedulesInCategory(categoryId) {
  return store.items.some((item) => String(item.categoryId) === String(categoryId))
}

function removeCategory(category) {
  openDropdownId.value = null
  if (hasSchedulesInCategory(category.id)) {
    categoryToDelete.value = category
    showDeleteConfirm.value = true
    return
  }
  const ok = confirm(`"${category.name}" 카테고리를 삭제할까요?`)
  if (!ok) return
  executeDeleteCategory(category)
}

function closeDeleteConfirm() {
  showDeleteConfirm.value = false
  categoryToDelete.value = null
}

async function confirmDeleteCategory() {
  const category = categoryToDelete.value
  if (!category) return
  closeDeleteConfirm()
  await executeDeleteCategory(category)
}

async function executeDeleteCategory(category) {
  const result = await store.deleteCategory(category.id)
  if (!result.ok) {
    alert('카테고리 삭제에 실패했어요.')
    return
  }
  if (String(props.selectedCategoryId) === String(category.id)) {
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

    <CategoryFormModal
      v-model:open="showCategoryModal"
      :mode="categoryModalMode"
      :category="editingCategory"
      @saved="onCategorySaved"
    />

    <div
      v-if="showDeleteConfirm && categoryToDelete"
      class="deleteConfirmLayer"
      @click.self="closeDeleteConfirm"
    >
      <div class="deleteConfirmModal" role="alertdialog" aria-modal="true">
        <p class="deleteConfirmMessage">
          "{{ categoryToDelete.name }}"에 등록된 일정이 있습니다.
          <span class="info">카테고리를 삭제하면 포함된 일정도 함께 삭제됩니다.</span>
        </p>
        <div class="deleteConfirmBtns">
          <button type="button" class="deleteConfirmBtn is-cancel" @click="closeDeleteConfirm">
            취소
          </button>
          <button type="button" class="deleteConfirmBtn is-danger" @click="confirmDeleteCategory">
            삭제
          </button>
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
  background: var(--color-gray-100);
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
  color: var(--color-gray-900);
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

.deleteConfirmLayer {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.6rem;
  background: var(--bg-opacity70);
}

.deleteConfirmModal {
  width: 100%;
  max-width: 36rem;
  padding: 3rem 2rem 2rem;
  background: var(--color-white);
  border-radius: 0.8rem;
  box-shadow: 0 0.4rem 2rem var(--bg-opacity40);
}

.deleteConfirmMessage {
  margin: 0 0 3rem;
  font-size: 1.7rem;
  font-weight:700;
  line-height: 1.5;
  color: var(--color-gray-900);
  word-break: keep-all;
}
.deleteConfirmMessage span{
  display: block;
  font-size:1.4rem;
  font-weight:500;
  color: var(--color-gray-500);
  margin-top:0.2rem;
}

.deleteConfirmBtns {
  display: flex;
  gap: 0.8rem;
}

.deleteConfirmBtn {
  flex: 1;
  min-height: 4rem;
  border-radius: 0.4rem;
  font-size: 1.4rem;
  font-weight: 600;
}

.deleteConfirmBtn.is-cancel {
  border: 0.1rem solid var(--color-border);
  background: var(--color-white);
  color: var(--color-gray-700);
}

.deleteConfirmBtn.is-cancel:hover {
  background: var(--color-gray-100);
}

.deleteConfirmBtn.is-danger {
  border: none;
  background: var(--priority-urgent);
  color: var(--color-white);
}

.deleteConfirmBtn.is-danger:hover {
  filter: contrast(1.1);
}
</style>
