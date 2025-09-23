import type { RouteRecordRaw } from 'vue-router';

// 主订单管理视图及其子视图
import OrderManagement from '../views/OrderManagement.vue';
import LabelUploadList from '../views/LabelUploadList.vue';
import LabelUploadLogs from '../views/LabelUploadLogs.vue';
import LabelUploadTasks from '../views/LabelUploadTasks.vue';
import LabelUploadAudit from '../views/LabelUploadAudit.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/orders/label-upload',
    name: 'LabelUpload',
    component: OrderManagement,
    children: [
      {
        path: 'list',
        name: 'LabelUploadList',
        component: LabelUploadList
      },
      {
        path: 'logs',
        name: 'LabelUploadLogs',
        component: LabelUploadLogs
      },
      {
        path: 'tasks',
        name: 'LabelUploadTasks',
        component: LabelUploadTasks
      },
      {
        path: 'audit',
        name: 'LabelUploadAudit',
        component: LabelUploadAudit
      },
      {
        path: '',
        redirect: 'list'
      }
    ]
  }
];

export default routes;