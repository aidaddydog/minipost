import { createRouter, createWebHistory } from 'vue-router'
const routes = [
  { path: '/', redirect: '/orders/label-upload/list' },
  { path: '/orders/label-upload/list',  component: () => import('@/modules/orders/views/LabelUploadList.vue') },
  { path: '/orders/label-upload/logs',  component: () => import('@/modules/orders/views/LabelUploadLogs.vue') },
  { path: '/orders/label-upload/tasks', component: () => import('@/modules/orders/views/LabelUploadTasks.vue') },
  { path: '/orders/label-upload/audit', component: () => import('@/modules/orders/views/LabelUploadAudit.vue') }
]
export default createRouter({ history: createWebHistory(), routes })
// extra placeholder routes to support top-nav
routes.push({ path: '/products/list', component: () => import('@/views/ProductsList.vue') })
routes.push({ path: '/logistics/rules', component: () => import('@/views/LogisticsRules.vue') })
routes.push({ path: '/settings/system', component: () => import('@/views/SystemSettings.vue') })