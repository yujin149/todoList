<script setup>
/**
 * 메인: 월별 캘린더(그리드)
 * - 날짜 셀 클릭 시 /day/YYYY-MM-DD(ScheduleListPage)로 이동
 * - 일정은 Pinia useScheduleStore 와 ScheduleListPage 가 공유
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useScheduleStore } from '../stores/schedule'
import { useHolidays } from '../composables/useHolidays'
import Menu from '../components/ui/menu.vue'
import {
  clampPriority,
  dateRangeOverlap,
  formatDate,
  normalizeYmd,
  parseYmd,
  totalSpanDays,
} from '../utils/dateUtils'

const router = useRouter()
const store = useScheduleStore()
const monthGridRef = ref(null)
const monthInputRef = ref(null)
const visibleLaneCapacity = ref(3)
const isMenuOpen = ref(false)
const selectedCategoryId = ref('all')
let gridResizeObserver = null

const now = new Date()
const viewYear = ref(now.getFullYear())
const viewMonth = ref(now.getMonth() + 1)
const viewYearMonth = computed(() => ({ year: viewYear.value, month: viewMonth.value }))
const { holidayNames } = useHolidays(viewYearMonth)

const weekLabels = ['일', '월', '화', '수', '목', '금', '토']
const todayYmd = computed(() => formatDate(new Date()))
/** 오늘 날짜(일) — 헤더 캘린더 아이콘 위 숫자 */
const todayDayNum = computed(() => new Date().getDate())
const monthTitle = computed(() => `${viewYear.value}년 ${viewMonth.value}월`)
const monthInputValue = computed(() => `${viewYear.value}-${String(viewMonth.value).padStart(2, '0')}`)
const filteredItems = computed(() => {
  if (selectedCategoryId.value === 'all') return store.items
  return store.items.filter((item) => item.categoryId === selectedCategoryId.value)
})
function getCategoryStyle(categoryId) {
  const category = store.categories.find((item) => String(item.id) === String(categoryId))
  if (!category) {
    return {
      color: 'var(--category-color9)',
      backgroundColor: 'var(--category-bg9)',
    }
  }
  return {
    color: category.color || 'var(--category-color9)',
    backgroundColor: category.bgColor || 'var(--category-bg9)',
  }
}

/** 일정 우선순위(1~4)보다 낮음 — 레인 배치 시 맨 아래 */
const HOLIDAY_PRIORITY = 99

const HOLIDAY_BAR_STYLE = {
  color: '#d9363e',
  backgroundColor: 'rgba(217, 54, 62, 0.1)',
}

function getEventBarStyle(seg) {
  if (seg.isHoliday) return HOLIDAY_BAR_STYLE
  return getCategoryStyle(seg.categoryId)
}

/** 같은 name 이고 날짜가 하루씩 이어지면 하나의 구간으로 합침 (추석 24~26 등) */
function mergeConsecutiveHolidays(holidayMap) {
  const entries = [...holidayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const merged = []
  for (const [iso, name] of entries) {
    const prev = merged[merged.length - 1]
    if (prev && prev.name === name) {
      const nextOfPrev = parseYmd(prev.to)
      nextOfPrev.setDate(nextOfPrev.getDate() + 1)
      if (formatDate(nextOfPrev) === iso) {
        prev.to = iso
        continue
      }
    }
    merged.push({ from: iso, to: iso, name })
  }
  return merged
}

function assignGlobalLanes(events) {
  const ordered = [...events].sort(
    (a, b) =>
      Number(!!a.isHoliday) - Number(!!b.isHoliday) ||
      b.sortSpan - a.sortSpan ||
      a.sortStart.localeCompare(b.sortStart) ||
      a.priority - b.priority ||
      String(a.id).localeCompare(String(b.id)),
  )
  const lanes = []
  const laneById = new Map()
  for (const ev of ordered) {
    let placed = false
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i]
      if (!lane.some((x) => dateRangeOverlap(x.from, x.to, ev.from, ev.to))) {
        lane.push(ev)
        laneById.set(ev.id, i)
        placed = true
        break
      }
    }
    if (!placed) {
      lanes.push([ev])
      laneById.set(ev.id, lanes.length - 1)
    }
  }
  return { laneById, laneCount: lanes.length }
}

function recalcVisibleLaneCapacity() {
  const root = monthGridRef.value
  if (!root) return
  const stackEl = root.querySelector('.eventStack')
  const laneEl = root.querySelector('.eventLane')
  if (!stackEl || !laneEl) return

  const stackRect = stackEl.getBoundingClientRect()
  const laneRect = laneEl.getBoundingClientRect()
  const stackStyles = getComputedStyle(stackEl)
  const gap = Number.parseFloat(stackStyles.rowGap || stackStyles.gap || '0') || 0
  const padTop = Number.parseFloat(stackStyles.paddingTop || '0') || 0
  const padBottom = Number.parseFloat(stackStyles.paddingBottom || '0') || 0
  const laneH = Math.max(1, laneRect.height)

  const available = Math.max(0, stackRect.height - padTop - padBottom)
  const capacity = Math.floor((available + gap) / (laneH + gap))
  visibleLaneCapacity.value = Math.max(1, capacity)
}

onMounted(() => {
  nextTick(() => {
    recalcVisibleLaneCapacity()
    if (typeof ResizeObserver !== 'undefined' && monthGridRef.value) {
      gridResizeObserver = new ResizeObserver(() => recalcVisibleLaneCapacity())
      gridResizeObserver.observe(monthGridRef.value)
    }
  })
})

onBeforeUnmount(() => {
  if (gridResizeObserver) {
    gridResizeObserver.disconnect()
    gridResizeObserver = null
  }
})

const gridDates = computed(() => {
  const y = viewYear.value
  const m0 = viewMonth.value - 1
  const first = new Date(y, m0, 1)
  const pad = first.getDay()
  const start = new Date(y, m0, 1 - pad)
  const out = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    out.push(d)
  }
  return out
})

/** 6주 × (날짜 7칸 + 이어짐 이벤트 막대) — 막대는 주 단위 7열 그리드에 column span */
const weeks = computed(() => {
  const maxVisibleRows = Math.max(1, visibleLaneCapacity.value)
  const dates = gridDates.value
  const gridIsos = dates.map((d) => formatDate(d))
  const gMin = gridIsos[0]
  const gMax = gridIsos[gridIsos.length - 1]
  const monthEvents = []
  for (const it of filteredItems.value) {
    const s = normalizeYmd(it.startDate ?? '')
    const eRaw = normalizeYmd(it.endDate ?? it.startDate ?? '')
    const e = eRaw || s
    if (!s) continue
    const from = s <= e ? s : e
    const to = s <= e ? e : s
    if (to < gMin || from > gMax) continue
    monthEvents.push({
      id: it.id,
      from,
      to,
      sortSpan: totalSpanDays(from, to),
      sortStart: from,
      priority: clampPriority(it.priority),
      completed: !!it.completed,
      text: (it.title && String(it.title).trim()) || '일정',
      categoryId: it.categoryId ?? null,
      isHoliday: false,
    })
  }
  for (const range of mergeConsecutiveHolidays(holidayNames.value)) {
    if (range.to < gMin || range.from > gMax) continue
    monthEvents.push({
      id: `h:${range.from}:${range.to}:${range.name}`,
      from: range.from,
      to: range.to,
      sortSpan: totalSpanDays(range.from, range.to),
      sortStart: range.from,
      priority: HOLIDAY_PRIORITY,
      completed: false,
      text: range.name,
      categoryId: null,
      isHoliday: true,
    })
  }
  const { laneById } = assignGlobalLanes(monthEvents)
  const out = []
  for (let w = 0; w < 6; w++) {
    const chunk = dates.slice(w * 7, w * 7 + 7)
    const weekIsos = chunk.map((d) => formatDate(d))
    const wMin = weekIsos[0]
    const wMax = weekIsos[6]
    const segs = []
    for (const ev of monthEvents) {
      const from = ev.from
      const to = ev.to
      if (to < wMin || from > wMax) continue
      let startCol = -1
      let endCol = -1
      for (let i = 0; i < 7; i++) {
        const d = weekIsos[i]
        if (d >= from && d <= to) {
          if (startCol < 0) startCol = i
          endCol = i
        }
      }
      if (startCol < 0) continue
      segs.push({
        id: ev.id,
        startCol,
        endCol,
        span: endCol - startCol + 1,
        laneIndex: laneById.get(ev.id) ?? 0,
        sortSpan: ev.sortSpan,
        sortStart: ev.sortStart,
        text: ev.text,
        priority: ev.priority,
        completed: ev.completed,
        categoryId: ev.categoryId,
        isHoliday: !!ev.isHoliday,
      })
    }
    segs.sort((a, b) => a.laneIndex - b.laneIndex || a.startCol - b.startCol || a.id - b.id)
    const laneMap = new Map()
    for (const seg of segs) {
      if (!laneMap.has(seg.laneIndex)) laneMap.set(seg.laneIndex, [])
      laneMap.get(seg.laneIndex).push(seg)
    }
    const allLanes = [...laneMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, laneSegs]) => laneSegs)
    const days = chunk.map((d) => ({ d, iso: formatDate(d) }))
    const hasOverflow = allLanes.length > maxVisibleRows
    const laneLimit = hasOverflow ? Math.max(0, maxVisibleRows - 1) : maxVisibleRows
    const visibleLanes = allLanes.slice(0, laneLimit)
    const hiddenByCol = Array.from({ length: 7 }, () => 0)
    const hiddenLanes = allLanes.slice(laneLimit)
    for (const lane of hiddenLanes) {
      for (const seg of lane) {
        for (let col = seg.startCol; col <= seg.endCol; col++) {
          hiddenByCol[col] += 1
        }
      }
    }
    out.push({
      days,
      lanes: visibleLanes,
      hiddenByCol,
      hasOverflow,
    })
  }
  return out
})

watch(
  () => [store.items.length, viewYear.value, viewMonth.value, holidayNames.value.size],
  () => nextTick(() => recalcVisibleLaneCapacity()),
)

function isInViewMonth(d) {
  return d.getFullYear() === viewYear.value && d.getMonth() + 1 === viewMonth.value
}

function dowClass(d) {
  const dow = d.getDay()
  if (dow === 0) return 'dow-sun'
  if (dow === 6) return 'dow-sat'
  return 'dow-mid'
}

function isHoliday(iso) {
  return holidayNames.value.has(iso)
}

function onPrevMonth() {
  if (viewMonth.value <= 1) {
    viewYear.value -= 1
    viewMonth.value = 12
  } else {
    viewMonth.value -= 1
  }
}

function onNextMonth() {
  if (viewMonth.value >= 12) {
    viewYear.value += 1
    viewMonth.value = 1
  } else {
    viewMonth.value += 1
  }
}

function openMonthPicker() {
  if (!monthInputRef.value) return
  if (typeof monthInputRef.value.showPicker === 'function') {
    monthInputRef.value.showPicker()
    return
  }
  monthInputRef.value.focus()
}

function onMonthInputChange(e) {
  const value = e.target.value
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return
  const [yy, mm] = value.split('-').map((n) => Number(n))
  if (!yy || !mm) return
  viewYear.value = yy
  viewMonth.value = mm
}

function goToday() {
  const t = new Date()
  viewYear.value = t.getFullYear()
  viewMonth.value = t.getMonth() + 1
}

function onDayCell(d) {
  const iso = formatDate(d)
  if (d.getFullYear() !== viewYear.value || d.getMonth() + 1 !== viewMonth.value) {
    viewYear.value = d.getFullYear()
    viewMonth.value = d.getMonth() + 1
  }
  router.push({ name: 'schedule-day', params: { date: iso } })
}

function openMenu() {
  isMenuOpen.value = true
}

function closeMenu() {
  isMenuOpen.value = false
}

function onSelectCategory(categoryId) {
  selectedCategoryId.value = categoryId
}

</script>

<template>
  <div class="calApp">
    <Menu
      :open="isMenuOpen"
      :selected-category-id="selectedCategoryId"
      @close="closeMenu"
      @select-category="onSelectCategory"
    />
    <header class="calHead">
      <button type="button" class="iconBtn" aria-label="메뉴" @click="openMenu">
        <span class="hamburger" />
      </button>
      <h1 class="calTitle">
        <button type="button" class="navBtn" @click="onPrevMonth">
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
        </button>
        <button
          type="button"
          class="month monthBtn"
          @click="openMonthPicker"
          @keydown.enter.prevent="openMonthPicker"
          @keydown.space.prevent="openMonthPicker"
        >
          {{ monthTitle }}
        </button>
        <input
          ref="monthInputRef"
          class="monthInput"
          type="month"
          :value="monthInputValue"
          @change="onMonthInputChange"
        >
        <button type="button" class="navBtn" @click="onNextMonth">
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
        </button>
      </h1>
      <div class="headRight">
        <button type="button" class="iconBtn todayBtn" title="이번 달" @click="goToday">
          <span class="today">{{ todayDayNum }}</span>
        </button>
      </div>
    </header>
    <div class="calendarWrap">
      <div class="dowRow">
        <div
          v-for="w in weekLabels"
          :key="w"
          class="dow"
          :class="{ sun: w === '일', sat: w === '토' }"
        >
          {{ w }}
        </div>
      </div>

      <div ref="monthGridRef" class="monthGrid">
        <div
          v-for="(week, wi) in weeks"
          :key="wi"
          class="weekBlock"
        >
          <button
            v-for="(day, di) in week.days"
            :key="`hit-${day.iso}`"
            type="button"
            class="weekHitCell"
            :class="{ 'is-today': day.iso === todayYmd }"
            :style="{ '--hit-col': di + 1 }"
            :aria-label="`${day.iso} 일정 보기`"
            @click="onDayCell(day.d)"
          />
          <div class="dayRow">
            <button
              v-for="day in week.days"
              :key="day.iso"
              type="button"
              class="cell"
              :class="[
                dowClass(day.d),
                {
                  'is-out': !isInViewMonth(day.d),
                  'is-today': day.iso === todayYmd,
                  'is-holiday': isHoliday(day.iso),
                },
              ]"
              @click="onDayCell(day.d)"
            >
              <span class="dNum">{{ day.d.getDate() }}</span>
            </button>
          </div>
          <div class="eventStack">
            <div
              v-for="(lane, li) in week.lanes"
              :key="li"
              class="eventLane"
            >
              <div
                v-for="seg in lane"
                :key="seg.id"
                class="evBar"
                :class="{
                  'evBar--done': seg.completed && !seg.isHoliday,
                  'evBar--holiday': seg.isHoliday,
                }"
                :style="{
                  gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
                  ...getEventBarStyle(seg),
                }"
              >
                <span class="evBarText">{{ seg.text }}</span>
              </div>
            </div>
            <div v-if="week.hasOverflow" class="eventMoreRow">
              <span
                v-for="(count, ci) in week.hiddenByCol"
                :key="`more-${ci}`"
                class="eventMoreText"
                :class="{ 'is-hidden': count <= 0 }"
              >
                <template v-if="count > 0">+{{ count }}</template>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calApp {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 48rem;
  min-height: 66rem;
  height: 100dvh;
  margin: 0 auto;
  background: var(--color-white);
  border-left: 0.1rem solid var(--color-border);
  border-right: 0.1rem solid var(--color-border);
  box-sizing: border-box;
}

.calHead {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  height: 5.2rem;
  padding: 0 1.2rem 0 1.6rem;
  border-bottom: 0.1rem solid var(--color-border);
  box-sizing: border-box;
}

.calTitle {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  gap:1rem;
  margin: 0;
}

.calTitle .month {
  font-size:1.6rem;
  font-weight:800;
  line-height: 1;
}
.calTitle .month.monthBtn {
  border: none;
  background: transparent;
  padding: 1.2rem 2rem;
  margin: 0;
  cursor: pointer;
}
.calTitle .month.monthBtn:hover {
  color: var(--color-point);
}
.monthInput {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.calTitle .navBtn{
  display: flex;
  justify-content: center;
  align-items: center;
  width: 3rem;
  height:3rem;
}

.calTitle .navBtn .icon {
  border-radius: 0.4rem;
  height: 1.6rem;
  width: 0.8rem;
  cursor: pointer;
  color: var(--color-gray-900);
}

.iconBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  border: none;
  background: transparent;
  border-radius: 0.4rem;
  color: var(--color-gray-900);
  font-size: 1.3rem;
  font-weight: 800;
  cursor: pointer;
}

.hamburger {
  display: block;
  width: 2.2rem;
  height: 0.2rem;
  background: var(--color-gray-900);
  position: relative;
  box-shadow: 0 0.7rem 0 var(--color-gray-900), 0 -0.7rem 0 var(--color-gray-900);
}

.headRight {
  min-width: 4rem;
  display: flex;
  justify-content: flex-end;
}

/** 캘린더 SVG(회색) + 그 위 날짜 숫자 */
.todayBtn {
  position: relative;
}

.todayBtn::before {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  width: 2.6rem;
  height: 2.6rem;
  background-color: var(--color-gray-900);
  -webkit-mask: url(../assets/images/icon-calendar.svg) no-repeat center / contain;
  mask: url(../assets/images/icon-calendar.svg) no-repeat center / contain;
  pointer-events: none;
}
.todayBtn .today {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 900;
  line-height: 1;
  margin-top: 0.8rem;
  letter-spacing: -0.05rem;
  color: #1e6fd9;
}

.calendarWrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 2rem 0;
  box-sizing: border-box;
}

.dowRow {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.2rem;
  padding: 0 1.2rem 1.2rem;
  font-size: 1.1rem;
  font-weight: 700;
  text-align: center;
  box-sizing: border-box;
}

.dow.sun {
  color: #d9363e;
}
.dow.sat {
  color: #1e6fd9;
}
.dow {
  color: var(--color-gray-900);
}

.monthGrid {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0 1.2rem 0.5rem;
  box-sizing: border-box;
}

.weekBlock {
  --col-gap: 0.2rem;
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 0;
}

.dayRow {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--col-gap);
  pointer-events: none;
}

.weekHitCell {
  position: absolute;
  z-index: 4;
  top: 0;
  bottom: 0;
  left: calc((var(--hit-col) - 1) * (((100% - (6 * var(--col-gap))) / 7) + var(--col-gap)));
  width: calc((100% - (6 * var(--col-gap))) / 7);
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  cursor: pointer;
}
.weekHitCell.is-today {
  background: rgba(0, 123, 237, 0.02);
  border:1px dashed var(--color-point);
}
.weekHitCell:focus-visible {
  outline: 0.2rem solid var(--color-point);
  outline-offset: -0.1rem;
}

.eventStack {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 0.2rem;
  padding-top: 0.2rem;
  pointer-events: none;
  overflow: hidden;
}

.eventLane {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--col-gap);
  min-height: 1.2em;
  align-items: center;
  box-sizing: border-box;
}

.cell {
  position: relative;
  display: block;
  border: 0.1rem solid transparent;
  border-radius: 0.2rem;
  background: var(--color-white);
  padding: 0.35rem 0.25rem 0.25rem;
  cursor: pointer;
  text-align: center;
  font: inherit;
  color: var(--color-gray-900);
  box-sizing: border-box;
  min-width: 0;
}

.cell.is-out {
  color: var(--color-gray-400);
}


.dow-sun {
  color: #d9363e;
}
.dow-sat {
  color: #1e6fd9;
}

/* 공휴일: 일요일과 동일하게 날짜 숫자 빨간색 (토요일 공휴일 포함) */
.cell.is-holiday:not(.is-out) {
  color: #d9363e;
}
.cell.is-holiday.dow-sat:not(.is-out) {
  color: #d9363e;
}

.evBar--holiday {
  pointer-events: none;
}

.dNum {
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.2;
}

.cell.is-today .dNum{
  font-weight:700;
}

.evBar {
  min-width: 0;
  min-height: 1.1em;
  padding: 0.2em;
  border-radius: 0.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.evBar--done {
  /* opacity: 0.55; */
  
}

.evBar--p1 {
  background: var(--priority-urgent-bg);
  color: var(--priority-urgent);
}
.evBar--p2 {
  background: var(--priority-high-bg);
  color: var(--priority-high);
}
.evBar--p3 {
  background: var(--priority-normal-bg);
  color: var(--priority-normal);
}
.evBar--p4 {
  background: var(--priority-low-bg);
  color: var(--priority-low);
}

.evBarText {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.1;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.eventMoreRow {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--col-gap);
  min-height: 1.2em;
  align-items: center;
}

.eventMoreText {
  display: block;
  width: 100%;
  justify-self: start;
  padding-left: 0.2rem;
  font-size: 1rem;
  line-height: 1.1;
  color: var(--color-gray-500);
  font-weight: 700;
  text-align: left;
}

.eventMoreText.is-hidden {
  visibility: hidden;
}

</style>
