import { ref, watch } from 'vue'
import axios from 'axios'

/** 월별 공휴일 API (/api/holidays) */
export function useHolidays(yearMonthSource) {
  const holidayNames = ref(new Map())

  async function loadHolidays(year, month) {
    try {
      const { data } = await axios.get('/api/holidays', {
        params: { year, month },
      })
      const names = new Map()
      for (const row of Array.isArray(data) ? data : []) {
        if (row?.date && row.name) names.set(row.date, row.name)
      }
      holidayNames.value = names
    } catch (e) {
      console.error('공휴일 조회 실패', e)
      holidayNames.value = new Map()
    }
  }

  watch(
    yearMonthSource,
    (ym) => {
      if (!ym?.year || !ym?.month) return
      loadHolidays(ym.year, ym.month)
    },
    { immediate: true },
  )

  function holidaysOn(iso) {
    const name = holidayNames.value.get(iso)
    return name ? [{ date: iso, name }] : []
  }

  return { holidayNames, holidaysOn, loadHolidays }
}
