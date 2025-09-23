import http from '@/utils/http'

export async function getLabelList(params: { kw?: string; page?: number; page_size?: number }) {
  const { data } = await http.get('/orders/label-upload/list', { params })
  return data
}
export async function getUploadLogs(params: { page?: number; page_size?: number }) {
  const { data } = await http.get('/orders/label-upload/logs', { params })
  return data
}
export async function getSwitchTasks(params: { kw?: string; page?: number; page_size?: number }) {
  const { data } = await http.get('/orders/label-upload/tasks', { params })
  return data
}
export async function getSwitchAudits(params: { task_id?: string; kw?: string; page?: number; page_size?: number }) {
  const { data } = await http.get('/orders/label-upload/audit', { params })
  return data
}
export async function switchPreview(body: { kw?: string|null }) {
  const { data } = await http.post('/orders/label-upload/switch/preview', body)
  return data
}
export async function switchCommit(body: { kw?: string|null; operator_id?: string|null }) {
  const { data } = await http.post('/orders/label-upload/switch/commit', body)
  return data
}
