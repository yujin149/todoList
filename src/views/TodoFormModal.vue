<script setup>
/**
 * 일정 등록·수정·삭제 모달
 * - v-model:open 과 item(null=등록 / 객체=수정)으로 App과 연동
 * - 일정 기간은 DateRangePicker와 dateRange 로컬 상태로 동기화
 */
import { computed, nextTick, ref, watch } from 'vue'
import DateRangePicker from '../components/DateRangePicker.vue'
import CategoryFormModal from '../components/ui/CategoryFormModal.vue'
import ModalLayout from '../components/ui/ModalLayout.vue'
import { useScheduleStore } from '../stores/schedule'
import { formatDate } from '../utils/dateUtils'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  /** 수정 시 대상 항목. null이면 등록 모드 */
  item: {
    type: Object,
    default: null,
  },
  /** 등록 모드에서 사용할 초기 기준일(App의 selectedDate) */
  selectedDate: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['add', 'update', 'delete'])
const store = useScheduleStore()

const isEdit = computed(() => props.item != null)

// 폼 필드
const title = ref('')
const memo = ref('')
const dateRange = ref({ start: '', end: '' })
const priorityOptions = [
  { value: '1', label: '긴급' },
  { value: '2', label: '중요' },
  { value: '3', label: '보통' },
  { value: '4', label: '낮음' },
]
const priority = ref(priorityOptions[2].value)
const categoryId = ref('')
const showCategoryModal = ref(false)
const titleInputRef = ref(null)

function openAddCategoryModal() {
  if (store.categories.length >= store.MAX_CATEGORIES) {
    alert(`카테고리는 최대 ${store.MAX_CATEGORIES}개까지 추가할 수 있어요.`)
    return
  }
  showCategoryModal.value = true
}

function onCategorySaved({ category }) {
  if (category?.id != null) {
    categoryId.value = String(category.id)
  }
}

/** 「오늘」 버튼: 시작·종료 모두 오늘 */
function setTodayDateRange() {
  const today = formatDate(new Date())
  dateRange.value = { start: today, end: today }
}

/** 모달 재오픈 시 스크롤 맨 위로 */
function resetModalScrollTop() {
  const modalInner = titleInputRef.value?.closest?.('.modalInner')
  if (!modalInner) return
  modalInner.scrollTop = 0
}

/** 등록 모드 초기값: 제목 비움, 기간은 selectedDate 또는 오늘 하루 */
function resetForAdd() {
  title.value = ''
  memo.value = ''
  const d = props.selectedDate || formatDate(new Date())
  dateRange.value = { start: d, end: d }
  priority.value = priorityOptions[2].value
  categoryId.value = ''
}

/** 수정 모드: 서버 없이 넘어온 item으로 폼 채움 */
function syncFromItem() {
  if (!props.item) return
  title.value = props.item.title ?? ''
  memo.value = props.item.memo ?? ''
  const s = props.item.startDate ?? ''
  const e = props.item.endDate ?? s
  dateRange.value = { start: s, end: e }
  priority.value = String(props.item.priority ?? priorityOptions[2].value)
  categoryId.value = props.item.categoryId == null ? '' : String(props.item.categoryId)
}

/** 열릴 때만 등록/수정 분기 후 포커스·스크롤 */
watch(
  () => open.value,
  async (isOpen) => {
    if (!isOpen) return
    if (props.item) syncFromItem()
    else resetForAdd()
    await nextTick()
    resetModalScrollTop()
    titleInputRef.value?.focus?.({ preventScroll: true })
  },
)

/** 검증 후 add 또는 update 이벤트, 시작>종료면 교환 */
function submit() {
  const t = title.value.trim()
  if (!t) {
    alert('제목을 입력해 주세요.')
    return
  }
  let { start, end } = dateRange.value
  if (!start || !end) {
    alert('시작일과 종료일을 선택해 주세요.')
    return
  }
  if (start > end) {
    const tmp = start
    start = end
    end = tmp
  }
  const opt = priorityOptions.find((o) => o.value === priority.value)
  const payload = {
    title: t,
    memo: memo.value.trim(),
    startDate: start,
    endDate: end,
    priority: Number(priority.value),
    priorityText: opt?.label ?? '',
    categoryId: categoryId.value ? Number(categoryId.value) : null,
  }
  if (props.item) {
    emit('update', { id: props.item.id, ...payload })
  } else {
    emit('add', payload)
  }
  open.value = false
}

/** 수정 모드만: 확인 후 delete 이벤트 */
function remove() {
  if (!props.item) return
  if (!confirm('이 일정을 삭제할까요?')) return
  emit('delete', props.item.id)
  open.value = false
}

/** 단순 닫기(저장 안 함) */
function close() {
  open.value = false
}
</script>

<template>
  <ModalLayout v-model:open="open">
    <template #title>{{ isEdit ? '수정' : '등록' }}</template>

    <!-- 제목·메모·중요도·일정 기간 -->
    <ul class="formList">
      <li>
        <p class="fieldTitle">제목<span class="is-required">*</span></p>
        <input ref="titleInputRef" v-model="title" type="text">
      </li>
      <li>
        <p class="fieldTitle">메모</p>
        <textarea v-model="memo" />
      </li>
      <li>
        <p class="fieldTitle">중요도</p>
        <ul class="priority-list" role="radiogroup" aria-label="중요도">
          <li v-for="opt in priorityOptions" :key="opt.value">
            <label class="priority-option">
              <input
                v-model="priority"
                type="radio"
                name="todo-priority"
                :value="opt.value"
              >
              <span>{{ opt.label }}</span>
            </label>
          </li>
        </ul>
      </li>
      <li>
        <p class="fieldTitle">카테고리</p>
        <div class="categoryList">
          <select v-model="categoryId" name="category" id="category">
            <option value="">미분류 (기본)</option>
            <option v-for="category in store.categories" :key="category.id" :value="String(category.id)">
              {{ category.name }}
            </option>
          </select>
          <button type="button" @click="openAddCategoryModal">추가</button>
        </div>
      </li>
      <li>
        <div class="fieldTitle-date">
          <p class="fieldTitle">일정 기간<span class="is-required">*</span></p>
          <button type="button" class="today" @click="setTodayDateRange">오늘</button>
        </div>
        <DateRangePicker v-model="dateRange" />
      </li>
    </ul>

    <!-- 등록·수정·삭제·닫기 -->
    <template #footer>
      <button type="button" class="addBtn commBtn" @click="submit">
        {{ isEdit ? '수정' : '등록' }}
      </button>
      <button v-if="isEdit" type="button" class="removeBtn commBtn" @click="remove">
        삭제
      </button>
      <button type="button" class="closeBtn commBtn" @click="close">닫기</button>
    </template>
  </ModalLayout>

  <CategoryFormModal v-model:open="showCategoryModal" mode="add" @saved="onCategorySaved" />
</template>

<style scoped>
.formList {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.formList li {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.formList li .fieldTitle {
  font-size: 1.5rem;
  font-weight: 700;
}

.formList li .categoryList {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap:1rem;
}
.formList li .categoryList button{
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  width:4rem;
  height:4rem;
  border:1px solid var(--color-border);
  border-radius: 0.4rem;
  color: var(--color-gray-500);
}
.formList li .categoryList button:hover{
  background: var(--color-point);
  color:var(--color-white);
  border-color:var(--color-point);
}

.formList li .fieldTitle-date {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.formList li .today {
  font-size: 1.3rem;
  font-weight:600;
  padding: 0.7rem 0.8rem;
  color: var(--color-gray-500);
  border: 1px solid var(--color-border);
  border-radius: 0.4rem;
}

.formList li .today:hover {
  background: var(--color-point);
  color: var(--color-white);
  border-color: var(--color-point);
}

.priority-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 3rem;
  padding-top:0.5rem;
}

.formList .priority-list li {
  flex-direction: row;
  align-items: center;
  gap: 0;
  width: auto;
}

.priority-option {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 1.4rem;
  font-weight: 500;
}

.priority-option input[type="radio"] {
  width: 1.6rem;
  height: 1.6rem;
  margin: 0;
  flex-shrink: 0;
  cursor: pointer;
  border: none;
  accent-color: var(--color-point);
}

:deep(.removeBtn) {
  border: 0.1rem solid var(--color-border);
  color: var(--priority-urgent);
  background: var(--color-white);
}


</style>
