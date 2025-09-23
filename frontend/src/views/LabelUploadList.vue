<template>
  <div>
    <div class="toolbar">
      <input v-model.trim="kw" class="input input--search" placeholder="单号搜索 / 双击批量搜索" @keyup.enter="fetchList" />
      <select v-model.number="pageSize" class="select" @change="changePage(1)">
        <option :value="20">20 条</option>
        <option :value="50">50 条</option>
        <option :value="100">100 条</option>
      </select>
      <button class="btn" @click="fetchList">搜索</button>
      <div class="flex-1"></div>
      <span style="font-size:10px;color:#64748b">运输方式枚举：{{ transportModes.join(', ') }}</span>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>订单号</th>
            <th>运单号</th>
            <th>转单号</th>
            <th>运输方式</th>
            <th>面单</th>
            <th>状态</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id">
            <td>{{ row.order_no || '-' }}</td>
            <td>{{ row.tracking_no }}</td>
            <td>{{ row.transfer_waybill_no || '-' }}</td>
            <td>{{ row.transport_mode || '-' }}</td>
            <td>
              <a v-if="row.label_file" class="btn" :href="labelUrl(row)" target="_blank">预览</a>
              <span v-else>-</span>
            </td>
            <td>{{ row.status_text }}</td>
            <td>
              <div class="time2">
                <div>创建时间：{{ fmt(row.created_at) }}</div>
                <div>打印时间：{{ fmt(row.printed_at) }}</div>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td colspan="7" style="color:#64748b">暂无数据</td>
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
import { TRANSPORT_MODES } from '../utils/fields'

type LabelRow = {
  id: string
  order_no?: string | null
  tracking_no: string
  transfer_waybill_no?: string | null
  label_file?: string | null
  status_text: string
  created_at?: string | null
  printed_at?: string | null
  transport_mode?: string | null
}

const items = ref<LabelRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const loading = ref(false)
const kw = ref('')
const transportModes = TRANSPORT_MODES as unknown as string[]

const pages = computed(()=> Math.max(1, Math.ceil(total.value / pageSize.value)))

function fmt(v?: string | null){
  if(!v) return '-'
  try{ const d = new Date(v); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }catch(_){ return '-' }
}

function labelUrl(row: LabelRow){
  // 兼容 /api/v1/huandan/label/{tracking_no}.pdf （与客户端一致）
  return `/api/v1/huandan/label/${encodeURIComponent(row.tracking_no)}.pdf`
}

async function fetchList(){
  loading.value = True = true
  try{
    const { data } = await http.get('/orders/label-upload/list', { params: { kw: kw.value || undefined, page: page.value, page_size: pageSize.value }})
    items.value = (data.items || []) as LabelRow[]
    total.value = data.total || items.value.length
  }finally{
    loading.value = false
  }
}

function changePage(p: number){
  page.value = Math.min(Math.max(1, p), pages.value)
  fetchList()
}

onMounted(fetchList)
</script>

<style scoped>
@import '../styles/huandan-ui.css';
.time2{ line-height:1.3; } .time2 div{ white-space:nowrap; }
</style>
