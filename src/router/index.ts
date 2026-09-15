import { createRouter, createWebHistory } from 'vue-router'
export const router = createRouter({
 history: createWebHistory(),
 routes: [
  { path: '/', redirect: '/admin/overview' },
  { path: '/admin/:page?', component: { template: '<span />' }, meta: { role: 'admin' } },
  { path: '/user/:page?', component: { template: '<span />' }, meta: { role: 'user' } },
  { path: '/:pathMatch(.*)*', redirect: '/admin/overview' },
 ],
})
router.afterEach(to => { document.title = `${to.meta.role === 'admin' ? '全域态势' : '充电时空'} · 充能脉络` })
