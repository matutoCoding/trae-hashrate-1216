import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layout/MainLayout.vue'),
    redirect: '/schedule',
    children: [
      {
        path: 'schedule',
        name: 'Schedule',
        component: () => import('@/views/schedule/ScheduleView.vue'),
        meta: { title: '房态排期', icon: 'Calendar' }
      },
      {
        path: 'cycle',
        name: 'Cycle',
        component: () => import('@/views/cycle/CycleView.vue'),
        meta: { title: '周期生成', icon: 'Refresh' }
      },
      {
        path: 'quota',
        name: 'Quota',
        component: () => import('@/views/quota/QuotaView.vue'),
        meta: { title: '额度管控', icon: 'Coin' }
      },
      {
        path: 'consumption',
        name: 'Consumption',
        component: () => import('@/views/consumption/ConsumptionView.vue'),
        meta: { title: '消费明细', icon: 'Tickets' }
      },
      {
        path: 'cleaning',
        name: 'Cleaning',
        component: () => import('@/views/cleaning/CleaningView.vue'),
        meta: { title: '保洁排程', icon: 'Brush' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
