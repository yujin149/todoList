import { parseYmd } from './dateUtils'

const FREQUENCY_TO_TYPE = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  year: 'yearly',
}

const END_TYPE_TO_API = {
  forever: 'none',
  count: 'count',
  date: 'date',
}

const TYPE_TO_FREQUENCY = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
}

const API_TO_END_TYPE = {
  none: 'forever',
  count: 'count',
  date: 'date',
}

/** JS getDay() 0=일 → Java DayOfWeek 1=월 … 7=일 */
function jsDayToIsoDayOfWeek(startDate) {
  const jsDay = parseYmd(startDate).getDay()
  return jsDay === 0 ? 7 : jsDay
}

/** 프론트 repeat → 백엔드 RepeatRuleDto. 비활성 시 null */
export function toRepeatRuleDto(repeat, startDate) {
  if (!repeat?.enabled || !repeat.frequency || repeat.frequency === 'none') {
    return null
  }

  const freq = repeat.frequency
  const repeatType = FREQUENCY_TO_TYPE[freq]
  if (!repeatType) return null

  const repeatInterval = Math.max(1, Number(repeat.interval?.[freq]) || 1)
  const repeatEndType = END_TYPE_TO_API[repeat.endType] ?? 'none'

  let repeatDays = null
  if (freq === 'week') {
    repeatDays = JSON.stringify([jsDayToIsoDayOfWeek(startDate)])
  }

  return {
    repeatType,
    repeatInterval,
    repeatDays,
    repeatEndType,
    repeatEndDate: repeatEndType === 'date' ? repeat.endDate : null,
    repeatCount: repeatEndType === 'count' ? Math.max(1, Number(repeat.count) || 1) : null,
  }
}

/** 일정 API 요청 body (백엔드 ScheduleItemRequest 형식) */
export function buildScheduleItemRequest(payload) {
  const repeatRule = toRepeatRuleDto(payload.repeat, payload.startDate)
  const body = {
    title: payload.title,
    emoji: payload.emoji ?? null,
    memo: payload.memo ?? '',
    startDate: payload.startDate,
    endDate: payload.endDate || payload.startDate,
    priority: payload.priority,
    priorityLabel: payload.priorityText ?? '',
    categoryId: payload.categoryId ?? null,
  }
  if (repeatRule) body.repeatRule = repeatRule
  if (payload.updateType) body.updateType = payload.updateType
  return body
}

/** 백엔드 repeatRule 필드 → 프론트 repeat 복원 */
export function fromApiRepeatRule(data) {
  if (!data?.repeatRuleId) return { enabled: false }

  if (!data.repeatType) {
    return { enabled: false }
  }

  const frequency = TYPE_TO_FREQUENCY[String(data.repeatType)] ?? 'day'
  const interval = { day: 1, week: 1, month: 1, year: 1 }
  const n = Math.max(1, Number(data.repeatInterval) || 1)
  interval[frequency] = n

  const endType = API_TO_END_TYPE[String(data.repeatEndType)] ?? 'forever'

  return {
    enabled: true,
    frequency,
    interval,
    monthPattern: null, // 백엔드 미지원(현재는 UI 표시만 가능)
    endType,
    count: endType === 'count' ? Number(data.repeatCount ?? 1) : null,
    endDate: endType === 'date' ? data.repeatEndDate ?? null : null,
  }
}

export const REPEAT_SCOPE_UPDATE = [
  { value: 'THIS_ONLY', label: '이번 일정만' },
  { value: 'FROM_THIS', label: '이 일정과 이후 반복 일정' },
  { value: 'ALL', label: '연관된 모든 일정' },
]

export const REPEAT_SCOPE_DELETE = [
  { value: 'THIS_ONLY', label: '이 일정을 휴지통으로 이동' },
  { value: 'FROM_THIS', label: '이 일정과 이후 반복 일정 모두 삭제', danger: true },
  { value: 'ALL', label: '연관된 모든 일정을 휴지통으로 이동' },
]
