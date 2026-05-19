<script setup>
/**
 * 일정 등록·수정·삭제 모달
 * - v-model:open 과 item(null=등록 / 객체=수정)으로 App과 연동
 * - 일정 기간은 DateRangePicker와 dateRange 로컬 상태로 동기화
 * - 반복 설정 UI: submit payload.repeat 포함 (저장·캘린더 연동은 백엔드 occurrence 설계 후)
 */
import { computed, nextTick, ref, watch } from 'vue'
import DateRangePicker from '../components/DateRangePicker.vue'
import CategoryFormModal from '../components/ui/CategoryFormModal.vue'
import ModalLayout from '../components/ui/ModalLayout.vue'
import { useScheduleStore } from '../stores/schedule'
import { formatDate, formatDateLabel } from '../utils/dateUtils'

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

/** ---------- 반복 설정 (로컬 상태) ---------- */

/** 반복 사용 여부. false면 repeat-panel 숨김 */
const repeatEnabled = ref(false)

/** 주기: none | day | week | month | year */
const repeatFrequency = ref('day')

/** 주기별 간격 숫자 (예: day=2 → 2일마다). 선택된 주기만 활성 입력 */
const repeatInterval = ref({
  day: 1,
  week: 1,
  month: 1,
  year: 1,
})

/** 종료 조건: forever | count | date */
const repeatEndType = ref('forever')

/** repeatEndType === 'count' 일 때 반복 횟수 */
const repeatCount = ref(10)

/** repeatEndType === 'date' 일 때 종료일 (YYYY-MM-DD) */
const repeatEndDate = ref('')

/** 숨긴 type=date input DOM (showPicker용). v-for 밖에 두어 단일 ref 유지 */
const repeatEndDateInputRef = ref(null)

/** 종료일 버튼에 표시할 한글 라벨 (예: 2026년 5월 19일) */
const repeatEndDateLabel = computed(() => {
  if (!repeatEndDate.value) return '날짜 선택'
  return formatDateLabel(repeatEndDate.value)
})

/** 반복 주기 라디오 목록 */
const repeatFrequencyOptions = [
  { value: 'none', label: '반복 안 함' },
  { value: 'day', label: '일마다', unit: '일' },
  { value: 'week', label: '주마다', unit: '주' },
  { value: 'month', label: '개월마다', unit: '개월' },
  { value: 'year', label: '년마다', unit: '년' },
]

/** 반복 기간(종료 조건) 라디오 목록 */
const repeatEndOptions = [
  { value: 'forever', label: '계속 반복' },
  { value: 'count', label: '일정 반복 횟수' },
  { value: 'date', label: '종료 날짜' },
]

/** 주기 숫자 입력: 1 미만이면 1로 보정 */
function clampRepeatInterval(freq, raw) {
  const n = Math.floor(Number(raw))
  repeatInterval.value[freq] = Number.isFinite(n) && n >= 1 ? n : 1
}

/** 「반복 안 함」 선택 시 토글도 OFF */
function onRepeatFrequencyChange(value) {
  repeatFrequency.value = value
  if (value === 'none') {
    repeatEnabled.value = false
  }
}

/** 토글 ON 시 기본 주기 day, 종료일 비어 있으면 일정 기간으로 초기값 */
function onRepeatToggleChange() {
  if (repeatEnabled.value && repeatFrequency.value === 'none') {
    repeatFrequency.value = 'day'
  }
  if (repeatEnabled.value && !repeatEndDate.value) {
    repeatEndDate.value = dateRange.value.end || dateRange.value.start || formatDate(new Date())
  }
}

/** v-for 안 ref였을 때 배열로 잡히는 경우 대비 (현재는 v-for 밖 단일 input) */
function getRepeatEndDateInputEl() {
  const raw = repeatEndDateInputRef.value
  if (!raw) return null
  return Array.isArray(raw) ? raw[0] : raw
}

/**
 * 종료일 버튼 클릭 → 브라우저 네이티브 달력
 * - showPicker()는 클릭 핸들러 안에서 동기 호출해야 함 (await nextTick 시 달력 안 뜸)
 * - Schedule.vue openMonthPicker 와 동일 패턴
 */
function openRepeatEndDatePicker() {
  const input = getRepeatEndDateInputEl()
  if (!input) return
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker()
      return
    } catch {
      /* showPicker 미지원·차단 시 focus 로 대체 */
    }
  }
  input.focus()
}

/** 숨긴 date input @change → repeatEndDate 동기화 */
function onRepeatEndDateChange(e) {
  const value = e.target.value
  if (value) repeatEndDate.value = value
}

/** 등록 모드·반복 없는 수정 시 반복 필드 초기화 */
function resetRepeatSettings() {
  repeatEnabled.value = false
  repeatFrequency.value = 'day'
  repeatInterval.value = { day: 1, week: 1, month: 1, year: 1 }
  repeatEndType.value = 'forever'
  repeatCount.value = 10
  repeatEndDate.value = ''
}

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
  resetRepeatSettings()
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
  // item.repeat 있으면 폼에 복원 (백엔드·store 연동 후 동작)
  const repeat = props.item.repeat
  if (repeat?.enabled) {
    repeatEnabled.value = true
    repeatFrequency.value = repeat.frequency ?? 'day'
    repeatInterval.value = {
      day: repeat.interval?.day ?? 1,
      week: repeat.interval?.week ?? 1,
      month: repeat.interval?.month ?? 1,
      year: repeat.interval?.year ?? 1,
    }
    repeatEndType.value = repeat.endType ?? 'forever'
    repeatCount.value = repeat.count ?? 10
    repeatEndDate.value = repeat.endDate ?? ''
  } else {
    resetRepeatSettings()
  }
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
  if (repeatEnabled.value && repeatEndType.value === 'date' && !repeatEndDate.value) {
    alert('반복 종료 날짜를 선택해 주세요.')
    return
  }
  const opt = priorityOptions.find((o) => o.value === priority.value)
  // repeat: API 저장용 규칙 객체 (enabled false면 비활성 한 건으로 통일)
  const payload = {
    title: t,
    memo: memo.value.trim(),
    startDate: start,
    endDate: end,
    priority: Number(priority.value),
    priorityText: opt?.label ?? '',
    categoryId: categoryId.value ? Number(categoryId.value) : null,
    repeat: repeatEnabled.value && repeatFrequency.value !== 'none'
      ? {
        enabled: true,
        frequency: repeatFrequency.value,
        interval: { ...repeatInterval.value },
        endType: repeatEndType.value,
        count: repeatEndType.value === 'count' ? Math.max(1, Number(repeatCount.value) || 1) : null,
        endDate: repeatEndType.value === 'date' ? repeatEndDate.value || null : null,
      }
      : { enabled: false },
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
      <!-- [반복] 토글 + 주기·기간 패널 (repeatEnabled 시 펼침) -->
      <li class="repeat-field">
        <!-- 제목 행: 반복 라벨 + ON/OFF 스위치 (체크박스는 시각적으로 숨김) -->
        <div class="repeat-header">
          <p class="fieldTitle">반복 설정</p>
          <label class="repeat-toggle" :class="{ 'is-on': repeatEnabled }">
            <input
              v-model="repeatEnabled"
              type="checkbox"
              class="repeat-toggle-input"
              @change="onRepeatToggleChange"
            >
            <span class="repeat-toggle-track" aria-hidden="true">
              <span class="repeat-toggle-thumb" />
            </span>
          </label>
        </div>

        <div v-if="repeatEnabled" class="repeat-panel">
          <!-- 반복 주기: 안 함 / N일·주·개월·년마다 -->
          <ul class="repeat-card" role="radiogroup" aria-label="반복 주기">
            <li
              v-for="opt in repeatFrequencyOptions"
              :key="opt.value"
              class="repeat-card-item"
            >
              <label class="repeat-radio">
                <input
                  type="radio"
                  name="repeat-frequency"
                  :value="opt.value"
                  :checked="repeatFrequency === opt.value"
                  @change="onRepeatFrequencyChange(opt.value)"
                >
                <span class="repeat-radio-mark" aria-hidden="true" />
                <span v-if="opt.value === 'none'" class="repeat-radio-label">{{ opt.label }}</span>
                <span v-else class="repeat-radio-label repeat-radio-label--interval">
                  <input
                    type="number"
                    min="1"
                    class="repeat-interval-input"
                    :value="repeatInterval[opt.value]"
                    :disabled="repeatFrequency !== opt.value"
                    @input="clampRepeatInterval(opt.value, $event.target.value)"
                    @click.stop
                  >
                  <span>{{ opt.label }}</span>
                </span>
              </label>
            </li>
          </ul>

          <p class="repeat-section-title">기간</p>
          <!-- 반복 종료: 계속 / N회 / 종료일 (종료일·횟수는 선택 시 하위 입력 표시) -->
          <ul class="repeat-card" role="radiogroup" aria-label="반복 기간">
            <li
              v-for="opt in repeatEndOptions"
              :key="opt.value"
              class="repeat-card-item"
            >
              <label class="repeat-radio">
                <input
                  v-model="repeatEndType"
                  type="radio"
                  name="repeat-end"
                  :value="opt.value"
                >
                <span class="repeat-radio-mark" aria-hidden="true" />
                <span class="repeat-radio-label">{{ opt.label }}</span>
              </label>
              <!-- 「일정 반복 횟수」선택 시 횟수 입력 -->
              <div
                v-if="opt.value === 'count' && repeatEndType === 'count'"
                class="repeat-extra"
              >
                <input
                  v-model.number="repeatCount"
                  type="number"
                  min="1"
                  class="repeat-extra-input"
                  aria-label="반복 횟수"
                >
                <span class="repeat-extra-unit">회</span>
              </div>
            </li>
            <!-- 종료 날짜: v-for 밖 별도 li (ref 단일 유지). 버튼 + 숨긴 input[type=date] -->
            <li
              v-if="repeatEndType === 'date'"
              class="repeat-card-item repeat-card-item--end-date"
            >
              <div class="repeat-extra repeat-extra-date">
                <button
                  type="button"
                  class="repeat-end-date-btn"
                  @click="openRepeatEndDatePicker"
                  @keydown.enter.prevent="openRepeatEndDatePicker"
                  @keydown.space.prevent="openRepeatEndDatePicker"
                >
                  <svg
                    class="repeat-end-date-icon"
                    viewBox="0 0 18 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M0.75 6.75H16.75M0.75 6.75V15.5502C0.75 16.6703 0.75 17.2301 0.967987 17.6579C1.15973 18.0342 1.46547 18.3405 1.8418 18.5322C2.2692 18.75 2.82899 18.75 3.94691 18.75H13.5531C14.671 18.75 15.23 18.75 15.6574 18.5322C16.0337 18.3405 16.3405 18.0342 16.5322 17.6579C16.75 17.2305 16.75 16.6715 16.75 15.5536V6.75M0.75 6.75V5.9502C0.75 4.83009 0.75 4.26962 0.967987 3.8418C1.15973 3.46547 1.46547 3.15973 1.8418 2.96799C2.26962 2.75 2.83009 2.75 3.9502 2.75H4.75M16.75 6.75V5.94691C16.75 4.82899 16.75 4.2692 16.5322 3.8418C16.3405 3.46547 16.0337 3.15973 15.6574 2.96799C15.2296 2.75 14.6703 2.75 13.5502 2.75H12.75M12.75 0.75V2.75M12.75 2.75H4.75M4.75 0.75V2.75"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>

                  {{ repeatEndDateLabel }}
                </button>
                <input
                  ref="repeatEndDateInputRef"
                  class="repeat-end-date-input"
                  type="date"
                  :value="repeatEndDate"
                  aria-label="반복 종료 날짜"
                  @change="onRepeatEndDateChange"
                >
              </div>
            </li>
          </ul>
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

/* ---------- 반복 설정 UI (토글·카드·종료일 picker) ---------- */
.repeat-field {
  gap: 1rem;
}

.repeat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.repeat-toggle {
  position: relative;
  display: inline-flex;
  cursor: pointer;
  flex-shrink: 0;
}

.repeat-toggle-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.repeat-toggle-track {
  position: relative;
  display: block;
  width: 4.4rem;
  height: 2.4rem;
  border-radius: 999px;
  background: var(--color-gray-300);
  transition: background 0.2s ease;
}

.repeat-toggle-thumb {
  position: absolute;
  top: 0.2rem;
  left: 0.2rem;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-white);
  box-shadow: 0 0.1rem 0.3rem rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}

.repeat-toggle.is-on .repeat-toggle-track {
  background: var(--color-point);
}

.repeat-toggle.is-on .repeat-toggle-thumb {
  transform: translateX(2rem);
}

.repeat-panel {
  display: flex;
  flex-direction: column;
  margin-top: 0.5rem;
}

.repeat-section-title {
  margin: 1.6rem 0 0.5rem;
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-gray-500);
}

.repeat-card {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 0.1rem solid var(--color-border);
  border-radius: 0.4rem;
  overflow: hidden;
  background: var(--color-white);
}

.repeat-card-item {
  border-top: 0.1rem solid var(--color-border);
}

.repeat-card-item:first-child {
  border-top: none;
}

.formList .repeat-card-item {
  flex-direction: column;
  align-items: stretch;
  gap: 0;
}

.repeat-radio {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 1rem 1.2rem;
  cursor: pointer;
  font-size: 1.4rem;
  font-weight: 500;
}

.repeat-radio input[type="radio"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  margin: 0;
}

.repeat-radio-mark {
  flex-shrink: 0;
  width: 1.8rem;
  height: 1.8rem;
  border: 0.15rem solid var(--color-gray-400);
  border-radius: 50%;
  background: var(--color-white);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.repeat-radio input[type="radio"]:checked + .repeat-radio-mark {
  border: 0.5rem solid var(--color-point);
}

.repeat-radio-label {
  flex: 1;
}

.repeat-radio-label--interval {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.repeat-interval-input {
  width: 3.6rem;
  height: auto;
  padding: 0 0 0.2rem;
  border: none;
  border-bottom: 0.15rem solid var(--color-point);
  border-radius: 0;
  text-align: center;
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--color-point);
  background: transparent;
}

.repeat-interval-input:disabled {
  border-bottom-color: var(--color-gray-300);
  color: var(--color-gray-400);
}

.repeat-interval-input::-webkit-outer-spin-button,
.repeat-interval-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.repeat-extra {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1.6rem;
}

.repeat-extra-input {
  width: 6rem;
  height: 3.2rem;
  padding: 0 0.8rem;
  font-size: 1.4rem;
}

.repeat-extra-date {
  position: relative;
  flex: 1;
  min-width: 0;
}

.repeat-end-date-btn {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 3.6rem;
  padding: 0 1rem 0 3.6rem;
  border: 0.1rem solid var(--color-border);
  border-radius: 0.4rem;
  background: var(--color-white);
  font-size: 1.4rem;
  font-weight: 500;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}

.repeat-end-date-icon {
  position: absolute;
  left: 1rem;
  width: 1.6rem;
  height: 1.6rem;
  flex-shrink: 0;
  color: var(--color-gray-500);
  pointer-events: none;
}

.repeat-end-date-btn:hover {
  border-color: var(--color-point);
  color: var(--color-point);
}

.repeat-end-date-btn:hover .repeat-end-date-icon {
  color: var(--color-point);
}

.repeat-card-item--end-date {
  border-top: none;
}

.repeat-card-item--end-date .repeat-extra-date {
  padding-top: 0;
}

.repeat-extra-date .repeat-end-date-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  min-width: 0;
  min-height: 0;
  padding: 0;
  margin: 0;
  border: 0;
  opacity: 0;
  pointer-events: none;
}

.repeat-end-date-btn:focus {
  outline: none;
}

.repeat-end-date-btn:focus-visible {
  outline: 0.2rem solid var(--color-point);
  outline-offset: 0.1rem;
}

.repeat-extra-unit {
  font-size: 1.3rem;
  color: var(--color-gray-500);
}

</style>
