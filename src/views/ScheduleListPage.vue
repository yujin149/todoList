<script setup>
/**
 * 일정 목록 페이지(하루)
 * - 라우트 `/day/YYYY-MM-DD`의 :date 를 기준으로 필터(visibleItems)
 * - 캘린더와 일정을 공유하려고 Pinia(store/schedule) 사용
 */
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useScheduleStore } from '../stores/schedule'
import { useHolidays } from '../composables/useHolidays'
import { formatDate, formatDateLabel, itemYmdSpan, parseYmd } from '../utils/dateUtils'
import { isRecurringScheduleItem } from '../utils/repeatMapper'
import TodoFormModal from './TodoFormModal.vue'
import RepeatScopePicker from '../components/ui/RepeatScopePicker.vue'
import CardList from './CardList.vue'

const props = defineProps({
  date: { type: String, required: true },
})

const route = useRoute()
const router = useRouter()
const store = useScheduleStore()

// ---- UI / 모달 ----
const isFormModalOpen = ref(false)
const formItem = ref(null)
// ---- 날짜 네비: YYYY-MM-DD, CardList 필터 기준(라우트와 양방향 동기화) ----
const selectedDate = ref(props.date)
const dateInputRef = ref(null)

watch(
  () => props.date,
  (d) => {
    if (d && d !== selectedDate.value) selectedDate.value = d
  },
)

watch(selectedDate, (v) => {
  if (v === route.params.date) return
  router.replace({ name: 'schedule-day', params: { date: v } })
})

/** 미완료 우선 -> 완료는 완료순서 -> 우선순위 -> 사용자 정렬 순 */
const sortedItems = computed(() =>
  [...store.items].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed)
    if (a.completed) return (a.completedOrder ?? 0) - (b.completedOrder ?? 0)
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.order - b.order
  }),
)

/** 선택한 날짜가 구간 안에 있는 일만 노출 */
const visibleItems = computed(() =>
  sortedItems.value.filter((item) => {
    const { start, end } = itemYmdSpan(item)
    if (!start) return false
    return selectedDate.value >= start && selectedDate.value <= end
  }),
)

const selectedYearMonth = computed(() => {
  const d = parseYmd(selectedDate.value)
  if (Number.isNaN(d.getTime())) return { year: 0, month: 0 }
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
})

const { holidaysOn } = useHolidays(selectedYearMonth)


const dayHolidays = computed(() => holidaysOn(selectedDate.value))

const dayHolidayLabel = computed(() =>
  dayHolidays.value.map((h) => h.name).join(', '),
)

/** 상단 ◀ ▶ 또는 직접 선택으로 하루 이동 */
function moveDate(days) {
  const baseDate = parseYmd(selectedDate.value)
  baseDate.setDate(baseDate.getDate() + days)
  selectedDate.value = formatDate(baseDate)
}

/** 네이티브 date 패널 열기(modal 열린 중이면 무시, 캘린더 충돌 방지) */
function openDatePicker() {
  if (isFormModalOpen.value) return
  if (!dateInputRef.value) return
  if (typeof dateInputRef.value.showPicker === 'function') {
    dateInputRef.value.showPicker()
    return
  }
  dateInputRef.value.focus()
}

/** 추가: 수정 대상 없이 모달 열기 */
function openAddModal() {
  formItem.value = null
  isFormModalOpen.value = true
}

/** 모달에서 등록 확정 시 목록에 추가, 선택 날짜를 시작일로 맞춤 */
function onAddItem(payload) {
  const start = payload.startDate
  selectedDate.value = start
  store.addItem(payload)
}

/** 카드 클릭 시 해당 항목 수정 모달 */
function openDetailModal(item) {
  formItem.value = item
  isFormModalOpen.value = true
}

/** 수정 저장: 기간 바뀌어 선택일이 범위 밖이면 시작일로 네비 이동 */
function onUpdateItem(payload) {
  const start = payload.startDate
  const end = payload.endDate
  store.updateItem(payload)
  if (start > selectedDate.value || end < selectedDate.value) {
    selectedDate.value = start
  }
}

/** 모달에서 삭제 확정 시 */
function onDeleteItem(payload) {
  const id = typeof payload === 'object' ? payload.id : payload
  const updateType = typeof payload === 'object' ? payload.updateType : 'THIS_ONLY'
  store.deleteItem(id, updateType ?? 'THIS_ONLY')
}

function onDeleteFromList(item) {
  if (isRecurringScheduleItem(item)) {
    pendingDeleteItem.value = item
    showDeleteScopePicker.value = true
    return
  }
  if (!confirm('이 일정을 삭제할까요?')) return
  onDeleteItem({ id: item.id, updateType: 'THIS_ONLY' })
}

const showDeleteScopePicker = ref(false)
const pendingDeleteItem = ref(null)

function onDeleteScopeConfirm(updateType) {
  const item = pendingDeleteItem.value
  pendingDeleteItem.value = null
  if (!item) return
  store.deleteItem(item.id, updateType)
}

function onDeleteScopeCancel() {
  pendingDeleteItem.value = null
}

/** 체크박스: 완료 시 목록 하단 정렬용 completedOrder 부여 */
function onToggleComplete(payload) {
  store.toggleComplete(payload)
}

/** 모달 닫히면 수정 대상 참조 해제 */
watch(isFormModalOpen, (open) => {
  if (!open) formItem.value = null
})
</script>

<template>
  <div class="app">
    <!-- 헤더: 캘린더 + 제목 + 일정 추가 -->
    <div class="titleWrap">
      <div class="titleLine">
        <RouterLink to="/" class="backToCal" title="캘린더로 이동">
          <svg
            class="iconBack"
            viewBox="0 0 16 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 7H1M1 7L7 13M1 7L7 1"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </RouterLink>
        <h1 class="title">{{ formatDateLabel(selectedDate) }} 일정</h1>
      </div>
      <div class="btnWrap">
        <button type="button" class="addBtn" @click="openAddModal">일정 추가</button>
      </div>
    </div>

    <div class="contWrap">
      <!-- 기준 날짜(이전/다음/직접 선택) -> visibleItems 필터 -->
      <div class="dateNav">
        <div class="dateRow">
          <button type="button" class="arrowBtn arrow-prev" @click="moveDate(-1)">
            <svg
              class="icon"
              viewBox="0 0 9 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 15L1 8L8 1"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            이전 날짜
          </button>
          <input
            id="date"
            ref="dateInputRef"
            v-model="selectedDate"
            type="date"
            name="date"
            class="dateInput"
            @click="openDatePicker"
            @focus="openDatePicker"
          >
          <button type="button" class="arrowBtn arrow-next" @click="moveDate(1)">
            <svg
              class="icon"
              viewBox="0 0 9 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 1L8 8L1 15"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            다음 날짜
          </button>
        </div>
        <p v-if="dayHolidayLabel" class="holidayCaption">{{ dayHolidayLabel }}</p>
      </div>

      <div class="listBlock">
        <!-- 해당 날짜에 걸리는 일정만 -->
        <CardList
          v-if="visibleItems.length"
          :items="visibleItems"
          @select="openDetailModal"
          @edit="openDetailModal"
          @delete="onDeleteFromList"
          @toggle-complete="onToggleComplete"
        />
        <p v-else class="listEmpty">등록된 일정이 없습니다.</p>
      </div>
    </div>
  </div>
  <!-- 등록(null) / 수정(item) 공용 -->
  <TodoFormModal
    v-model:open="isFormModalOpen"
    :item="formItem"
    :selected-date="selectedDate"
    @add="onAddItem"
    @update="onUpdateItem"
    @delete="onDeleteItem"
  />
  <RepeatScopePicker
    v-model:open="showDeleteScopePicker"
    mode="delete"
    @confirm="onDeleteScopeConfirm"
    @cancel="onDeleteScopeCancel"
  />
</template>

<style scoped>
.app {
  width: 100%;
  max-width: 48rem;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--color-white);
  border-left: 0.1rem solid var(--color-border);
  border-right: 0.1rem solid var(--color-border);
}

.titleWrap {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 5rem;
  padding: 0.8rem 2rem 0.8rem 1.2rem;
  border-bottom: 0.1rem solid var(--color-border);
  gap: 0.8rem;
}

.titleLine {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
  flex: 1;
}

.backToCal {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 3rem;
  height: 4rem;
}
.backToCal .iconBack {
  width: 1.6rem;
  height: 1.4rem;
  color: var(--color-gray-900);
}

.titleWrap .title {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btnWrap .addBtn {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-gray-700);
  border: 0.1rem solid var(--color-border);
  width: 8rem;
  height: 3.2rem;
  border-radius: 0.4rem;
}

.btnWrap .addBtn:hover {
  color: var(--color-white);
  background: var(--color-point);
  border-color: var(--color-point);
}

.contWrap {
  padding: 0 2rem 2rem;
}

.dateNav {
  padding: 2rem 0 1.2rem;
  position:relative;
}

.dateRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.dateInput {
  position: relative;
  flex: 1;
  min-width: 0;
  border: none;
  font-size: 1.7rem;
  text-align: center;
  cursor: pointer;
  font-weight: 700;
  color: var(--color-gray-900);
  background: transparent;
}

.dateInput::-webkit-calendar-picker-indicator {
  display: none;
}

.dateRow .arrowBtn {
  font-size: 0;
  letter-spacing: -9999px;
  flex: none;
  width: 3rem;
  height: 3rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.dateRow .icon {
  color: var(--color-gray-900);
  width: 0.9rem;
  height: 1.3rem;
}

.holidayCaption {
  margin: 0.5rem 0 0;
  padding: 0 0.5rem;
  text-align: center;
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.3;
  color: #d9363e;
  position:absolute;
  bottom:0.5rem;
  left:50%;
  transform: translateX(-50%);
}

.listBlock {
  margin-top: 0.4rem;
}

.listEmpty {
  margin: 0;
  padding: 2rem 1rem;
  text-align: center;
  font-size: 1.4rem;
  color: var(--color-gray-500);
  border: 0.1rem solid var(--color-border);
}
</style>
