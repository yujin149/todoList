<script setup>
/**
 * 일정 시작일·종료일 범위 선택 UI
 *
 * - v-model: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } (defineModel)
 * - 상단 pill로 시작/종료 중 어떤 날을 고칠지 선택 → 달력 클릭으로 반영(더블클릭은 하루짜리)
 * - 월 제목 클릭 시 연·월·일 드럼 피커(스크롤·키보드·숫자 입력)
 *
 * 세부 동작은 아래 개별 JSDoc 주석을 참고.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

/** 드럼·숫자 입력에서 허용하는 연도 (목록 길이·검증용; 필요하면 조정) */
const DRUM_YEAR_MIN = 1900
const DRUM_YEAR_MAX = 2999
const DRUM_SYNC_MS = 100

/** 더블클릭과 구분하기 위한 단일 클릭 지연 (ms) */
const PICK_CLICK_DELAY_MS = 260
let pickClickTimer = null

function clearPickClickTimer() {
  if (pickClickTimer != null) {
    clearTimeout(pickClickTimer)
    pickClickTimer = null
  }
}

const range = defineModel({ type: Object, default: () => ({ start: '', end: '' }) })

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const activeField = ref('start')
const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth() + 1)

const showDrumPicker = ref(false)
const drumYear = ref(viewYear.value)
const drumMonth = ref(viewMonth.value)
const drumDay = ref(1)

const drumYearRef = ref(null)
const drumMonthRef = ref(null)
const drumDayRef = ref(null)
const focusedDrumCol = ref('')

let drumSyncTimer = null

/** 휠 한 칸씩: 컬럼별 누적 delta (픽셀) */
const drumWheelAccByCol = new WeakMap()

const drumYears = computed(() => {
  const list = []
  for (let y = DRUM_YEAR_MIN; y <= DRUM_YEAR_MAX; y++) list.push(y)
  return list
})

const drumMonths = computed(() => Array.from({ length: 12 }, (_, i) => i + 1))

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate()
}

const drumDaysList = computed(() => {
  const dim = daysInMonth(drumYear.value, drumMonth.value)
  return Array.from({ length: dim }, (_, i) => i + 1)
})

const drumHeadTitle = computed(() => formatKoreanLine(toISO(drumYear.value, drumMonth.value, drumDay.value)))

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toISO(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

function parseISO(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function formatKoreanLine(iso) {
  const dt = parseISO(iso)
  if (!dt) return '날짜 선택'
  return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일`
}

const monthTitle = computed(() => `${viewYear.value}년 ${viewMonth.value}월`)

const calendarCells = computed(() => {
  const year = viewYear.value
  const month = viewMonth.value
  const firstDay = new Date(year, month - 1, 1).getDay()
  const dim = new Date(year, month, 0).getDate()
  const prevDim = new Date(year, month - 1, 0).getDate()
  const cells = []

  for (let i = 0; i < firstDay; i++) {
    const d = prevDim - firstDay + 1 + i
    const prevM = month === 1 ? 12 : month - 1
    const prevY = month === 1 ? year - 1 : year
    cells.push({ y: prevY, m: prevM, d, outside: true })
  }
  for (let d = 1; d <= dim; d++) {
    cells.push({ y: year, m: month, d, outside: false })
  }
  let nextD = 1
  const nM = month === 12 ? 1 : month + 1
  const nY = month === 12 ? year + 1 : year
  while (cells.length % 7 !== 0) {
    cells.push({ y: nY, m: nM, d: nextD++, outside: true })
  }
  while (cells.length < 42) {
    cells.push({ y: nY, m: nM, d: nextD++, outside: true })
  }
  return cells
})

/** 활성 pill(start/end) 날짜의 연·월로 달력 그리드 이동 (한쪽만 있으면 start→end 순 fallback) */
function syncViewToActiveAnchor() {
  let iso = activeField.value === 'start' ? range.value.start : range.value.end
  if (!iso) iso = range.value.start || range.value.end
  const dt = parseISO(iso)
  if (!dt) return
  viewYear.value = dt.getFullYear()
  viewMonth.value = dt.getMonth() + 1
}

watch(
  () => [range.value.start, range.value.end],
  () => {
    if (showDrumPicker.value) {
      setDrumFromActiveAnchor()
      scrollDrumColumnsToDrumValues()
    }
    syncViewToActiveAnchor()
  },
  { immediate: true },
)

function prevMonth() {
  if (viewMonth.value === 1) {
    viewMonth.value = 12
    viewYear.value -= 1
  } else {
    viewMonth.value -= 1
  }
}

function nextMonth() {
  if (viewMonth.value === 12) {
    viewMonth.value = 1
    viewYear.value += 1
  } else {
    viewMonth.value += 1
  }
}

function rangeVisualClasses(idx) {
  const cells = calendarCells.value
  const cell = cells[idx]
  const iso = toISO(cell.y, cell.m, cell.d)
  const { start, end } = range.value
  if (!start || !end || iso < start || iso > end) return {}

  if (start === end) {
    return { 'is-range': true, 'is-range-single': true }
  }

  const inSpan = (i) => {
    if (i < 0 || i >= cells.length) return false
    const s = toISO(cells[i].y, cells[i].m, cells[i].d)
    return s >= start && s <= end
  }

  const col = idx % 7
  const westIn = col > 0 && inSpan(idx - 1)
  const eastIn = col < 6 && inSpan(idx + 1)

  return {
    'is-range': true,
    'rng-bar-left': !westIn,
    'rng-bar-right': !eastIn,
  }
}

function weekdayClass(colIndex) {
  if (colIndex === 0) return 'is-sun'
  if (colIndex === 6) return 'is-sat'
  return ''
}

function performPickCell(cell) {
  const iso = toISO(cell.y, cell.m, cell.d)
  const next = { ...range.value }
  if (activeField.value === 'start') {
    next.start = iso
    if (!next.end || next.end < iso) next.end = iso
  } else {
    next.end = iso
    if (!next.start || next.start > iso) next.start = iso
  }
  range.value = next
}

function onPickCell(cell) {
  clearPickClickTimer()
  pickClickTimer = setTimeout(() => {
    pickClickTimer = null
    performPickCell(cell)
  }, PICK_CLICK_DELAY_MS)
}

/** 더블클릭: 시작·종료를 같은 날(하루)로 고정 */
function onPickCellDbl(cell) {
  clearPickClickTimer()
  const iso = toISO(cell.y, cell.m, cell.d)
  range.value = { start: iso, end: iso }
  activeField.value = 'start'
}

function clearDrumSyncTimer() {
  if (drumSyncTimer != null) {
    clearTimeout(drumSyncTimer)
    drumSyncTimer = null
  }
}

function readDrumColumnValue(el) {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const hit = document.elementFromPoint(cx, cy)
  const item = hit?.closest?.('[data-val]')
  if (!item) return null
  const v = Number(item.dataset.val)
  return Number.isFinite(v) ? v : null
}

function syncDrumSelectionFromScroll() {
  const y = readDrumColumnValue(drumYearRef.value)
  const m = readDrumColumnValue(drumMonthRef.value)
  const d = readDrumColumnValue(drumDayRef.value)
  if (y != null) drumYear.value = y
  if (m != null) drumMonth.value = m
  if (d != null) {
    const dim = daysInMonth(drumYear.value, drumMonth.value)
    drumDay.value = Math.min(Math.max(1, d), dim)
  }
}

/** 드럼 값을 활성 pill(start/end)과 달력 뷰에 즉시 반영 */
function commitDrumToRange() {
  if (!showDrumPicker.value) return
  const dim = daysInMonth(drumYear.value, drumMonth.value)
  drumDay.value = Math.min(Math.max(1, Math.round(Number(drumDay.value)) || 1), dim)
  viewYear.value = drumYear.value
  viewMonth.value = drumMonth.value
  const iso = toISO(drumYear.value, drumMonth.value, drumDay.value)
  const next = { ...range.value }
  if (activeField.value === 'start') {
    next.start = iso
    if (!next.end || next.end < iso) next.end = iso
  } else {
    next.end = iso
    if (!next.start || next.start > iso) next.start = iso
  }
  range.value = next
}

function getDrumColumnRef(colName) {
  if (colName === 'year') return drumYearRef.value
  if (colName === 'month') return drumMonthRef.value
  return drumDayRef.value
}

function getDrumColumnValue(colName) {
  if (colName === 'year') return drumYear.value
  if (colName === 'month') return drumMonth.value
  return drumDay.value
}

function setDrumColumnValue(colName, value) {
  if (colName === 'year') drumYear.value = value
  else if (colName === 'month') drumMonth.value = value
  else drumDay.value = value
}

function clampDrumColumnValue(colName, value) {
  if (colName === 'year') return Math.min(DRUM_YEAR_MAX, Math.max(DRUM_YEAR_MIN, value))
  if (colName === 'month') return Math.min(12, Math.max(1, value))
  const dim = daysInMonth(drumYear.value, drumMonth.value)
  return Math.min(dim, Math.max(1, value))
}

function drumColumnIndexByValue(colName, value) {
  if (colName === 'year') return drumYears.value.indexOf(value)
  return value - 1
}

function scrollDrumColumnToValue(colName, value) {
  const col = getDrumColumnRef(colName)
  const idx = drumColumnIndexByValue(colName, value)
  if (idx >= 0) scrollColumnElToIndex(col, idx)
}

function applyDrumRowChange(colName, e) {
  let v = Math.round(Number(e.target.value))
  if (!Number.isFinite(v)) return
  v = clampDrumColumnValue(colName, v)
  setDrumColumnValue(colName, v)
  nextTick(() => {
    scrollDrumColumnToValue(colName, v)
    commitDrumToRange()
  })
}

function onDrumRowBlur(e, rowValue) {
  e.target.value = String(rowValue)
}

/** 드럼 줄 입력 핸들러(템플릿 바인딩 유지용) */
function onDrumYearRowChange(e) { applyDrumRowChange('year', e) }
function onDrumMonthRowChange(e) { applyDrumRowChange('month', e) }
function onDrumDayRowChange(e) { applyDrumRowChange('day', e) }

function onDrumYearRowBlur(e, rowYear) { onDrumRowBlur(e, rowYear) }
function onDrumMonthRowBlur(e, rowMonth) { onDrumRowBlur(e, rowMonth) }
function onDrumDayRowBlur(e, rowDay) { onDrumRowBlur(e, rowDay) }

const drpMonthToggleRef = ref(null)

function focusCenteredDrumInput(colEl) {
  const input = colEl?.querySelector?.('.drp-drum-item.is-center .drp-drum-item-input')
  if (!input) return false
  input.focus({ preventScroll: true })
  input.select?.()
  return true
}

function dispatchDrumColumnArrow(col, key) {
  if (!col || (key !== 'ArrowUp' && key !== 'ArrowDown')) return
  const fakeEvent = { key, preventDefault() {} }
  if (col === drumYearRef.value) onDrumYearColumnKeydown(fakeEvent)
  else if (col === drumMonthRef.value) onDrumMonthColumnKeydown(fakeEvent)
  else if (col === drumDayRef.value) onDrumDayColumnKeydown(fakeEvent)
}

/** 입력칸에서 Enter/Tab/화살표를 누르면 입력모드를 종료하고 컬럼 조작으로 넘김 */
function onDrumRowInputKeydown(e) {
  const key = e.key
  if (key !== 'Enter' && key !== 'Tab' && !key.startsWith('Arrow')) return
  e.preventDefault()
  const col = e.currentTarget?.closest?.('.drp-drum-col')
  e.currentTarget.blur()
  nextTick(() => {
    col?.focus?.({ preventScroll: true })
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      dispatchDrumColumnArrow(col, key)
    }
  })
}

function nudgeDrumColumn(colName, step) {
  const current = getDrumColumnValue(colName)
  const nextValue = clampDrumColumnValue(colName, current + step)
  if (nextValue === current) return
  setDrumColumnValue(colName, nextValue)
  nextTick(() => {
    scrollDrumColumnToValue(colName, nextValue)
    commitDrumToRange()
  })
}

function onDrumColumnKeydown(e, colName) {
  if (e.key === 'Enter') {
    e.preventDefault()
    focusCenteredDrumInput(getDrumColumnRef(colName))
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    nudgeDrumColumn(colName, 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    nudgeDrumColumn(colName, -1)
  }
}

/** 드럼 컬럼 키다운 핸들러(템플릿 바인딩 유지용) */
function onDrumYearColumnKeydown(e) { onDrumColumnKeydown(e, 'year') }
function onDrumMonthColumnKeydown(e) { onDrumColumnKeydown(e, 'month') }
function onDrumDayColumnKeydown(e) { onDrumColumnKeydown(e, 'day') }

function onDrumPanelKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault()
    closeDrumPicker()
  }
}

function scheduleDrumSync() {
  clearDrumSyncTimer()
  drumSyncTimer = setTimeout(() => {
    drumSyncTimer = null
    syncDrumSelectionFromScroll()
    commitDrumToRange()
  }, DRUM_SYNC_MS)
}

function drumColumnRowHeightPx(col) {
  const row = col?.querySelector?.('.drp-drum-item')
  const h = row?.getBoundingClientRect?.().height
  return h && h > 0 ? h : 44
}

/** 휠: 물리 노치/이벤트당 최대 1칸 (큰 delta로 while 여러 번 도는 문제 방지). 트랙패드는 누적 후 1칸씩. */
function onDrumColumnWheel(e) {
  e.preventDefault()
  const col = e.currentTarget
  const rowH = drumColumnRowHeightPx(col)

  if (e.deltaMode === 1) {
    const sign = Math.sign(e.deltaY)
    if (sign !== 0) col.scrollBy({ top: sign * rowH, behavior: 'auto' })
    drumWheelAccByCol.delete(col)
    scheduleDrumSync()
    return
  }

  if (e.deltaMode === 2) {
    const sign = Math.sign(e.deltaY)
    if (sign !== 0) col.scrollBy({ top: sign * rowH, behavior: 'auto' })
    drumWheelAccByCol.delete(col)
    scheduleDrumSync()
    return
  }

  const dy = e.deltaY
  const maxScroll = Math.max(0, col.scrollHeight - col.clientHeight)
  if (maxScroll < 1) {
    drumWheelAccByCol.delete(col)
    scheduleDrumSync()
    return
  }

  let acc = drumWheelAccByCol.get(col) || 0
  /* 끝에서 더 밀 때 쌓인 누적 때문에, 반대로 돌릴 때 여분 스크롤이 필요해지는 현상 방지 */
  if (col.scrollTop <= 1) acc = Math.max(0, acc)
  if (col.scrollTop >= maxScroll - 1) acc = Math.min(0, acc)

  acc += dy
  const thresh = rowH * 0.35
  if (acc >= thresh) {
    const before = col.scrollTop
    col.scrollBy({ top: rowH, behavior: 'auto' })
    if (col.scrollTop > before + 0.5) acc -= rowH
    else acc = 0
  } else if (acc <= -thresh) {
    const before = col.scrollTop
    col.scrollBy({ top: -rowH, behavior: 'auto' })
    if (col.scrollTop < before - 0.5) acc += rowH
    else acc = 0
  }
  drumWheelAccByCol.set(col, acc)
  scheduleDrumSync()
}

/** 드래그 종료 시 가운데에 가장 가까운 행으로 스냅 */
function snapDrumColumnToNearest(col) {
  if (!col) return
  const items = col.querySelectorAll('.drp-drum-item')
  if (!items.length) return
  const colRect = col.getBoundingClientRect()
  const centerY = colRect.top + colRect.height / 2
  let bestIdx = 0
  let bestDist = Infinity
  items.forEach((row, i) => {
    const r = row.getBoundingClientRect()
    const rowCenter = r.top + r.height / 2
    const dist = Math.abs(rowCenter - centerY)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  })
  scrollColumnElToIndex(col, bestIdx)
}

function onDrumColPointerDown(e) {
  if (e.button !== 0) return
  if (e.target.closest?.('.drp-drum-item-input')) return
  const col = e.currentTarget
  col.__drumDrag = { startY: e.clientY, startScroll: col.scrollTop }
  col.classList.add('is-dragging')
  try {
    col.setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
}

function onDrumColPointerMove(e) {
  const col = e.currentTarget
  const d = col.__drumDrag
  if (!d) return
  col.scrollTop = d.startScroll - (e.clientY - d.startY)
}

function onDrumColPointerUp(e) {
  const col = e.currentTarget
  if (!col.__drumDrag) return
  col.__drumDrag = null
  col.classList.remove('is-dragging')
  try {
    col.releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  snapDrumColumnToNearest(col)
  scheduleDrumSync()
}

function onDrumColumnFocus(colName) {
  focusedDrumCol.value = colName
}

function onDrumColumnBlur(colName) {
  if (focusedDrumCol.value === colName) focusedDrumCol.value = ''
}

function scrollColumnElToIndex(el, index) {
  const items = el?.querySelectorAll?.('.drp-drum-item')
  const row = items?.[index]
  if (row) {
    row.scrollIntoView({ block: 'center', behavior: 'auto' })
  }
}

/** 활성 pill(start/end)에 해당하는 날짜로 드럼 연·월·일만 맞춤 (range는 그대로) */
function setDrumFromActiveAnchor() {
  const anchorIso = activeField.value === 'start' ? range.value.start : range.value.end
  const dt = parseISO(anchorIso)
  if (dt) {
    drumYear.value = dt.getFullYear()
    drumMonth.value = dt.getMonth() + 1
    const dim = daysInMonth(drumYear.value, drumMonth.value)
    drumDay.value = Math.min(Math.max(1, dt.getDate()), dim)
  } else {
    drumYear.value = viewYear.value
    drumMonth.value = viewMonth.value
    drumDay.value = 1
  }
}

function alignDrumScrollToValues() {
  if (!showDrumPicker.value) return
  const yi = drumYears.value.indexOf(drumYear.value)
  const mi = drumMonth.value - 1
  const di = drumDay.value - 1
  if (yi >= 0) scrollColumnElToIndex(drumYearRef.value, yi)
  scrollColumnElToIndex(drumMonthRef.value, mi)
  scrollColumnElToIndex(drumDayRef.value, di)
}

function scrollDrumColumnsToDrumValues() {
  nextTick(() => alignDrumScrollToValues())
}

function openDrumPicker() {
  setDrumFromActiveAnchor()
  showDrumPicker.value = true
  nextTick(() => {
    alignDrumScrollToValues()
    drumYearRef.value?.focus?.({ preventScroll: true })
  })
}

function closeDrumPicker() {
  showDrumPicker.value = false
  clearDrumSyncTimer()
  nextTick(() => {
    drpMonthToggleRef.value?.focus?.()
  })
}

function toggleDrumPicker() {
  if (showDrumPicker.value) closeDrumPicker()
  else openDrumPicker()
}

watch([drumYear, drumMonth], () => {
  if (!showDrumPicker.value) return
  const dim = daysInMonth(drumYear.value, drumMonth.value)
  if (drumDay.value > dim) {
    drumDay.value = dim
  }
  nextTick(() => {
    scrollColumnElToIndex(drumDayRef.value, drumDay.value - 1)
    commitDrumToRange()
  })
})

watch(activeField, () => {
  syncViewToActiveAnchor()
  if (!showDrumPicker.value) return
  clearDrumSyncTimer()
  setDrumFromActiveAnchor()
  scrollDrumColumnsToDrumValues()
})

onBeforeUnmount(() => {
  clearPickClickTimer()
  clearDrumSyncTimer()
})
</script>

<template>
  <div class="drp">
    <!-- 시작/종료 pill → 활성 필드(activeField)에 달력·드럼이 반영됨 -->
    <div class="drp-header">
      <button
        type="button"
        class="drp-pill"
        :class="{ 'is-active': activeField === 'start' }"
        @click="activeField = 'start'"
      >
        {{ formatKoreanLine(range.start) }}
      </button>
      <span class="drp-arrow" aria-hidden="true">
        <svg 
          class="arrowRight"
          viewBox="0 0 12 10" 
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M1 5H11M11 5L7 1M11 5L7 9" 
            stroke="currentColor" 
            stroke-width="1" 
            stroke-linecap="round" 
            stroke-linejoin="round"
          />
        </svg>

      </span>
      <button
        type="button"
        class="drp-pill"
        :class="{ 'is-active': activeField === 'end' }"
        @click="activeField = 'end'"
      >
        {{ formatKoreanLine(range.end) }}
      </button>
    </div>

    <!-- 월 이동 / 제목 클릭으로 드럼 피커 토글 -->
    <div class="drp-toolbar">
      <button
        v-show="!showDrumPicker"
        type="button"
        class="drp-nav"
        aria-label="이전 달"
        @click="prevMonth"
      >
        <svg
          class="arrowIcon"
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
        ref="drpMonthToggleRef"
        type="button"
        class="drp-month"
        :aria-expanded="showDrumPicker"
        aria-haspopup="dialog"
        :aria-controls="showDrumPicker ? 'drp-drum-panel' : undefined"
        @click="toggleDrumPicker"
      >
        {{ showDrumPicker ? drumHeadTitle : monthTitle }}
        <span class="drp-caret" :class="{ 'is-open': showDrumPicker }" aria-hidden="true">
          <svg
            class="dropDownIcon"
            viewBox="0 0 10 6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 1L5 5L1 1"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </button>
      <button
        v-show="!showDrumPicker"
        type="button"
        class="drp-nav"
        aria-label="다음 달"
        @click="nextMonth"
      >
        <svg
          class="arrowIcon"
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
    </div>

    <!-- 연·월·일 세로 스크롤 선택 -->
    <div
      v-if="showDrumPicker"
      id="drp-drum-panel"
      class="drp-drum"
      role="dialog"
      aria-label="연·월·일 빠른 선택"
      @keydown="onDrumPanelKeydown"
    >
      <div class="drp-drum-cols">
        <div class="drp-drum-col-mask">
          <div
            ref="drumYearRef"
            class="drp-drum-col"
            tabindex="0"
            role="listbox"
            :aria-label="`연도 선택, 현재 ${drumYear}년. 위아래 화살표로 변경`"
            @keydown="onDrumYearColumnKeydown"
            @scroll.passive="scheduleDrumSync"
            @wheel.prevent="onDrumColumnWheel"
            @pointerdown="onDrumColPointerDown"
            @pointermove="onDrumColPointerMove"
            @pointerup="onDrumColPointerUp"
            @pointercancel="onDrumColPointerUp"
            @focus="onDrumColumnFocus('year')"
            @blur="onDrumColumnBlur('year')"
          >
            <div class="drp-drum-spacer" aria-hidden="true" />
            <div
              v-for="y in drumYears"
              :key="y"
              class="drp-drum-item"
              :class="{ 'is-center': y === drumYear, 'is-focused': focusedDrumCol === 'year' && y === drumYear }"
              :data-val="y"
            >
              <input
                class="drp-drum-item-input"
                type="number"
                tabindex="-1"
                :min="DRUM_YEAR_MIN"
                :max="DRUM_YEAR_MAX"
                inputmode="numeric"
                :value="y"
                :aria-label="`${y}년`"
                @change="onDrumYearRowChange($event)"
                @blur="onDrumYearRowBlur($event, y)"
                @keydown="onDrumRowInputKeydown"
              >
              <span class="drp-drum-item-suffix">년</span>
            </div>
            <div class="drp-drum-spacer" aria-hidden="true" />
          </div>
        </div>
        <div class="drp-drum-col-mask">
          <div
            ref="drumMonthRef"
            class="drp-drum-col"
            tabindex="0"
            role="listbox"
            :aria-label="`월 선택, 현재 ${drumMonth}월. 위아래 화살표로 변경`"
            @keydown="onDrumMonthColumnKeydown"
            @scroll.passive="scheduleDrumSync"
            @wheel.prevent="onDrumColumnWheel"
            @pointerdown="onDrumColPointerDown"
            @pointermove="onDrumColPointerMove"
            @pointerup="onDrumColPointerUp"
            @pointercancel="onDrumColPointerUp"
            @focus="onDrumColumnFocus('month')"
            @blur="onDrumColumnBlur('month')"
          >
            <div class="drp-drum-spacer" aria-hidden="true" />
            <div
              v-for="m in drumMonths"
              :key="m"
              class="drp-drum-item"
              :class="{ 'is-center': m === drumMonth, 'is-focused': focusedDrumCol === 'month' && m === drumMonth }"
              :data-val="m"
            >
              <input
                class="drp-drum-item-input drp-drum-item-input--month"
                type="number"
                tabindex="-1"
                min="1"
                max="12"
                inputmode="numeric"
                :value="m"
                :aria-label="`${m}월`"
                @change="onDrumMonthRowChange($event)"
                @blur="onDrumMonthRowBlur($event, m)"
                @keydown="onDrumRowInputKeydown"
              >
              <span class="drp-drum-item-suffix">월</span>
            </div>
            <div class="drp-drum-spacer" aria-hidden="true" />
          </div>
        </div>
        <div class="drp-drum-col-mask">
          <div
            ref="drumDayRef"
            class="drp-drum-col"
            tabindex="0"
            role="listbox"
            :aria-label="`일 선택, 현재 ${drumDay}일. 위아래 화살표로 변경`"
            @keydown="onDrumDayColumnKeydown"
            @scroll.passive="scheduleDrumSync"
            @wheel.prevent="onDrumColumnWheel"
            @pointerdown="onDrumColPointerDown"
            @pointermove="onDrumColPointerMove"
            @pointerup="onDrumColPointerUp"
            @pointercancel="onDrumColPointerUp"
            @focus="onDrumColumnFocus('day')"
            @blur="onDrumColumnBlur('day')"
          >
            <div class="drp-drum-spacer" aria-hidden="true" />
            <div
              v-for="d in drumDaysList"
              :key="d"
              class="drp-drum-item"
              :class="{ 'is-center': d === drumDay, 'is-focused': focusedDrumCol === 'day' && d === drumDay }"
              :data-val="d"
            >
              <input
                class="drp-drum-item-input drp-drum-item-input--day"
                type="number"
                tabindex="-1"
                min="1"
                :max="daysInMonth(drumYear, drumMonth)"
                inputmode="numeric"
                :value="d"
                :aria-label="`${d}일`"
                @change="onDrumDayRowChange($event)"
                @blur="onDrumDayRowBlur($event, d)"
                @keydown="onDrumRowInputKeydown"
              >
              <span class="drp-drum-item-suffix">일</span>
            </div>
            <div class="drp-drum-spacer" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>

    <!-- 요일 헤더 + 월 그리드(단일 클릭 범위 / 더블클릭 하루) -->
    <template v-else>
      <div class="drp-weekdays">
        <span v-for="(w, i) in WEEKDAY_LABELS" :key="w" :class="weekdayClass(i)">{{ w }}</span>
      </div>

      <div class="drp-grid">
        <button
          v-for="(cell, idx) in calendarCells"
          :key="`${cell.y}-${cell.m}-${cell.d}-${idx}`"
          type="button"
          class="drp-cell"
          :class="{
            'is-outside': cell.outside,
            'is-sun': idx % 7 === 0,
            'is-sat': idx % 7 === 6,
            ...rangeVisualClasses(idx),
          }"
          @click="onPickCell(cell)"
          @dblclick.prevent="onPickCellDbl(cell)"
        >
          <span class="drp-dayNum">{{ cell.d }}</span>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.drp {
  --drp-bg: #fff;
  --drp-text: #202124;
  --drp-muted: #5f6368;
  --drp-pill-hover: #f1f3f4;
  --drp-pill-active: #e8eaed;
  --drp-border: #d7d7d7;
  --drp-accent: #4285f4;
  --drp-sun: #ea4335;
  --drp-sat: #4285f4;
  --drp-outside: #a9adb4;
  --drp-range-h: 3.6rem;
  --drp-drum-item-h: 4.4rem;

  background: var(--drp-bg);
  color: var(--drp-text);
  border-radius: 1rem;
  padding: 1.4rem 2rem 1.4rem;
  font-size: 1.4rem;
  border: 1px solid var(--drp-border);
  box-shadow: 0 0.1rem 0.3rem rgba(60, 64, 67, 0.08);
}

.drp-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding-bottom: 1rem;
  margin-bottom: 0.8rem;
  border-bottom: 1px solid var(--drp-border);
}

.drp-pill {
  flex: 1;
  min-width: 0;
  border: none;
  border-radius: 999px;
  padding: 0.6rem 0.8rem;
  background: transparent;
  color: var(--drp-text);
  font: inherit;
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drp-pill:hover {
  background: var(--drp-pill-hover);
}

.drp-pill.is-active {
  background: var(--drp-pill-active);
}

.drp-arrow {
  color: var(--drp-muted);
  flex-shrink: 0;
}

.drp-arrow .arrowRight{
  color:var(--color-gray-500);
  width:1.6rem;
  height:1.2rem;
}

.drp-toolbar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.6rem;
  margin: 2rem 0 3rem;
}

.drp-nav {
  border: none;
  background: transparent;
  line-height: 1;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  width:3.6rem;
  height:3.6rem;
}

.drp-nav:hover {
  background: var(--drp-pill-hover);
}
.drp-nav .arrowIcon{
  color:var(--color-gray-900);
  width:0.6rem;
  height:1.2rem;
}

.drp-month {
  margin: 0;
  border: none;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: center;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  border-radius: 0.4rem;
}

.drp-month:hover {
  background: var(--drp-pill-hover);
}

.drp-caret {
  display: inline-flex;
  transition: transform 0.2s ease;
  margin-bottom: 0.1rem;
}

.drp-caret.is-open {
  transform: rotate(180deg);
}

.drp-caret .dropDownIcon {
  width: 0.9rem;
  height: 0.5rem;
}

.drp-drum {
  margin: 0 0 1rem;
}

.drp-drum-cols {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
  margin-bottom: 1.2rem;
}

.drp-drum-col-mask {
  height: calc(3 * var(--drp-drum-item-h));
  overflow: hidden;
  transition: box-shadow 0.12s ease, background-color 0.12s ease;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    #000 22%,
    #000 78%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    #000 22%,
    #000 78%,
    transparent 100%
  );
}

.drp-drum-col {
  height: 100%;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
  touch-action: none;
  overscroll-behavior: contain;
  cursor: grab;
}

.drp-drum-col.is-dragging {
  cursor: grabbing;
  user-select: none;
}

.drp-drum-col:focus {
  outline: none;
}

.drp-drum-col:focus-visible {
  outline: none;
}

/* 첫·끝 항목도 가운데 선택 줄에 스냅되도록 위·아래 여백 (패딩 대신 스크롤 콘텐츠로 넣음) */
.drp-drum-spacer {
  height: var(--drp-drum-item-h);
  flex-shrink: 0;
  scroll-snap-align: none;
  pointer-events: none;
}

.drp-drum-col::-webkit-scrollbar {
  display: none;
}

.drp-drum-item {
  box-sizing: border-box;
  height: var(--drp-drum-item-h);
  scroll-snap-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  font-size: 1.5rem;
  color: #aeb0b7;
  flex-shrink: 0;
}

.drp-drum-item.is-center {
  color: var(--drp-text);
  font-weight: 700;
}

.drp-drum-item.is-focused {
  background-color: rgba(66, 133, 244, 0.08);
  border:3px dashed var(--color-point);
  border-radius: 0.4rem;
}

.drp-drum-item-input {
  width: 5.6rem;
  min-width: 0;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 1.5rem;
  font-weight: inherit;
  text-align: right;
  color: inherit;
  padding: 0 0.1rem;
  appearance: textfield;
  -moz-appearance: textfield;
}

.drp-drum-item-input--month {
  width: 3.2rem;
  text-align: center;
}

.drp-drum-item-input--day {
  width: 3.2rem;
  text-align: center;
}

.drp-drum-item-input::-webkit-outer-spin-button,
.drp-drum-item-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.drp-drum-item-input:focus {
  outline: none;
  border-radius: 0.2rem;
  border:1px solid var(--color-border);
}

.drp-drum-item-suffix {
  flex-shrink: 0;
  font: inherit;
  color: inherit;
}

.drp-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  text-align: center;
  font-size: 1.2rem;
  color: var(--drp-muted);
  margin-bottom: 0.4rem;
}

.drp-weekdays .is-sun {
  color: var(--drp-sun);
}

.drp-weekdays .is-sat {
  color: var(--drp-sat);
}

.drp-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0;
}

.drp-cell {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  margin: 0;
  aspect-ratio: 1;
  border: none;
  background: transparent;
  color: var(--drp-text);
  font: inherit;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  display: block;
  position: relative;
  z-index: 0;
  appearance: none;
  -webkit-appearance: none;
}

.drp-dayNum {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  pointer-events: none;
}

.drp-cell.is-outside {
  color: var(--drp-outside);
}

.drp-cell.is-sun:not(.is-outside):not(.is-range) {
  color: var(--drp-sun);
}

.drp-cell.is-sat:not(.is-outside):not(.is-range) {
  color: var(--drp-sat);
}

.drp-cell.is-outside.is-sun:not(.is-range) {
  color: color-mix(in srgb, var(--drp-sun) 45%, var(--drp-outside));
}

.drp-cell.is-outside.is-sat:not(.is-range) {
  color: color-mix(in srgb, var(--drp-sat) 45%, var(--drp-outside));
}

/* 기간: 높이 3rem 고정, 가로는 셀 너비만큼만 막대 */
.drp-cell.is-range:not(.is-range-single) {
  background: transparent;
  color: #fff;
  z-index: 1;
}

.drp-cell.is-range:not(.is-range-single)::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: var(--drp-range-h);
  background: var(--drp-accent);
  border-radius: 0;
  z-index: 0;
  pointer-events: none;
}

.drp-cell.is-range:not(.is-range-single).rng-bar-left::after {
  border-top-left-radius: 999px;
  border-bottom-left-radius: 999px;
}

.drp-cell.is-range:not(.is-range-single).rng-bar-right::after {
  border-top-right-radius: 999px;
  border-bottom-right-radius: 999px;
}

.drp-cell.is-range:not(.is-range-single).rng-bar-left.rng-bar-right::after {
  border-radius: 999px;
}

/* 하루만: 가운데 3rem 원 (기간 막대와 높이 동일) */
.drp-cell.is-range.is-range-single {
  background: transparent;
  color: #fff;
  border-radius: 50%;
  z-index: 1;
}

.drp-cell.is-range.is-range-single::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: var(--drp-range-h);
  height: var(--drp-range-h);
  border-radius: 50%;
  background: var(--drp-accent);
  z-index: 0;
  pointer-events: none;
}

/* 선택 없는 칸 호버: 단일 선택과 같은 크기의 원 (::after) */
.drp-cell:hover:not(.is-range)::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: var(--drp-range-h);
  height: var(--drp-range-h);
  border-radius: 50%;
  background: var(--drp-pill-hover);
  z-index: 0;
  pointer-events: none;
}
</style>
