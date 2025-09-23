<template>
  <div>
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr><th>时间</th><th>文件名</th><th>上传类型</th><th>总数</th><th>成功</th><th>失败</th><th>操作人</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in items" :key="r.id">
            <td>{{ fmt(r.time) }}</td>
            <td>{{ r.file }}</td>
            <td>{{ r.type }}</td>
            <td>{{ r.total }}</td>
            <td>{{ r.success }}</td>
            <td>{{ r.fail }}</td>
            <td>{{ r.operator }}</td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td colspan="7" style="color:#64748b">暂无记录</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="footer-bar">
      <div class="inner">
        <div class="flex-1">共 {{ total }} 条 {{ page }}/{{ pages }} 页</div>
        <div>
          <button class="btn" :disabled="page<=1" @click="changePage(1)">«</button>
          <button class="btn" :disabled="page<=1" @click="changePage(page-1)">‹</button>
          <button class="btn" :disabled="page>=pages" @click="changePage(page+1)">›</button>
          <button class="btn" :disabled="page>=pages" @click="changePage(pages)">»</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import http from '../utils/http'

type LogRow = { id: string; time: string; file: string; type: string; total: number; success: number; fail: number; operator: string }

const items = ref<LogRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const loading = ref(false)

const pages = computed(()=> Math.max(1, Math.ceil(total.value / pageSize.value)))

function fmt(v?: string | null){
  if(!v) return '-'
  try{ const d = new Date(v); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }catch(_){ return '-' }
}

async function fetchLogs(){
  loading.value = true
  try{
    const { data } = await http.get('/orders/label-upload/logs', { params: { page: page.value, page_size: pageSize.value }})
    items.value = (data.items || []) as LogRow[]
    total.value = data.total || items.value.length
  }finally{
    loading.value = false
  }
}

function changePage(p: number){
  page.value = Math.min(Math.max(1, p), pages.value)
  fetchLogs()
}

onMounted(fetchLogs)
</script>

<style scoped>
@import '../styles/huandan-ui.css';
</style>
