import axios from 'axios'
const http = axios.create({
  baseURL: '/api/v1', // 被 caddy 反代到 backend:8000（接口前缀 /api/v1）
  timeout: 15000
})
http.interceptors.request.use(cfg => {
  cfg.headers = cfg.headers || {}
  ;(cfg.headers as any)['X-Tenant-ID'] = 'demo-tenant' // 多租户头
  return cfg
})
export default http
