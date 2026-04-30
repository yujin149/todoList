/**
 * 메인(월 캘린더) / 일정 목록(하루) 라우팅
 */
import { createRouter, createWebHistory } from 'vue-router'
import { formatDate, isValidYmd } from '../utils/dateUtils'
import Schedule from '../views/Schedule.vue'
import ScheduleListPage from '../views/ScheduleListPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'schedule',
      component: Schedule,
    },
    {
      path: '/day/:date',
      name: 'schedule-day',
      component: ScheduleListPage,
      props: true,
      beforeEnter: (to) => {
        if (isValidYmd(to.params.date)) return true
        return { name: 'schedule-day', params: { date: formatDate(new Date()) } }
      },
    },
  ],
})

export default router
