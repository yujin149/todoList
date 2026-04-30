/**
 * YYYY-MM-DD / UI 라벨 유틸
 */
export function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isValidYmd(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00`)
  if (Number.isNaN(d.getTime())) return false
  return formatDate(d) === s
}

export function parseYmd(iso) {
  const [y, m, d] = String(iso).split('-').map((n) => Number(n))
  return new Date(y, m - 1, d)
}

/** YYYY-MM-DD -> 'YYYY년 MM월 DD일' */
export function formatDateLabel(isoDate) {
  const [year, month, day] = String(isoDate).split('-')
  if (!year || !month || !day) return isoDate
  return `${year}년 ${Number(month)}월 ${Number(day)}일`
}

/** 자유 형식 날짜 문자열을 YYYY-MM-DD 로 정규화 (실패 시 빈 문자열) */
export function normalizeYmd(value) {
  if (typeof value !== 'string') return ''
  const raw = value.trim().slice(0, 10)
  const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return ''
  const yy = m[1]
  const mm = String(Number(m[2])).padStart(2, '0')
  const dd = String(Number(m[3])).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** 포괄 기간 길이(일). 잘못된 값이면 최소 1일 */
export function totalSpanDays(startYmd, endYmd) {
  const sYmd = normalizeYmd(startYmd)
  const eYmd = normalizeYmd(endYmd)
  if (!sYmd || !eYmd) return 1
  const s = new Date(`${sYmd}T00:00:00`)
  const e = new Date(`${eYmd}T00:00:00`)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 1
  const from = s <= e ? s : e
  const to = s <= e ? e : s
  const diff = Math.floor((to - from) / 86400000) + 1
  return Math.max(1, diff)
}

export function dateRangeOverlap(aFrom, aTo, bFrom, bTo) {
  return !(aTo < bFrom || bTo < aFrom)
}

/** 일정 우선순위 1~4, 기본값 3 */
export function clampPriority(value, fallback = 3) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(4, Math.max(1, Math.round(n)))
}

/** 일정 객체의 포함 구간 [start, end] (end 없으면 start 만) */
export function itemYmdSpan(item) {
  const start = item?.startDate ?? ''
  const end = item?.endDate ?? start
  return { start, end }
}
