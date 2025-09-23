export const L2 = {
  '/orders': [
    { title: '面单上传', href: '/orders/label-upload',
      tabs: [
        { key: 'list',  title: '面单列表',  href: '/orders/label-upload/list' },
        { key: 'logs',  title: '上传记录',  href: '/orders/label-upload/logs' },
        { key: 'tasks', title: '换单任务',  href: '/orders/label-upload/tasks' },
        { key: 'audit', title: '换单审计',  href: '/orders/label-upload/audit' }
      ] }
  ]
} as const
