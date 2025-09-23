<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import http from '@/utils/http'
import { useRoute, useRouter } from 'vue-router'
const route = useRoute(); const router = useRouter()
const taskId = ref<string | undefined>(route.query.task_id as string | undefined)
const kw = ref(''); const page = ref(1); const pageSize = ref(50)
const total = ref(0); const rows = ref<any[]>([]); const loading = ref(false)
async function load(){
  loading.value=true
  try{
    const { data } = await http.get('/orders/label-upload/audit', { params: { task_id: taskId.value, kw: kw.value||undefined, page: page.value, page_size: pageSize.value } })
    total.value = data.total||0; rows.value = data.items||[]
  } finally { loading.value=false }
}
function onSearch(){ page.value=1; load() }
function onPageChange(p:number){ page.value=p; load() }
watch(() => route.query.task_id, (v)=>{ taskId.value = v as string | undefined; page.value=1; load() })
onMounted(load)
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <input class="input" v-model="kw" placeholder="订单号/运单号/转单号" @keydown.enter="onSearch" />
      <button class="btn btn--black" @click="onSearch">搜索</button>
      <span class="flex-1"></span>
      <button class="btn" @click="router.push('/orders/label-upload/tasks')">返回任务列表</button>
    </div>
    <div class="table-wrap">
      <div v-if="loading" style="padding:8px;color:#64748b">正在加载…</div>
      <table class="table" v-else>
        <thead>
          <tr><th>时间</th><th>事件</th><th>订单号</th><th>运单号</th><th>转单号</th><th>详情</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>{{ new Date(r.occurred_at).toLocaleString() }}</td>
            <td>{{ r.event }}</td>
            <td>{{ r.order_no || '-' }}</td>
            <td>{{ r.tracking_no || '-' }}</td>
            <td>{{ r.transfer_waybill_no || '-' }}</td>
            <td><pre class="mono">{{ JSON.stringify(r.detail || {}, null, 2) }}</pre></td>
          </tr>
          <tr v-if="!rows.length"><td colspan="6" style="color:#9ca3af">暂无审计记录</td></tr>
        </tbody>
      </table>
    </div>

    <div class="footer-bar">
      <div class="inner">
        <span>共 {{ total }} 条</span>
        <span class="pager">
          <a href="#" @click.prevent="onPageChange(1)">&laquo;</a>
          <a href="#" @click.prevent="onPageChange(Math.max(1, page - 1))">&lsaquo;</a>
          <b style="margin:0 8px">{{ page }}</b>
          <a href="#" @click.prevent="onPageChange(page + 1)">&rsaquo;</a>
        </span>
        <span class="flex-1"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page{ padding:12px }
.toolbar{ display:flex; gap:8px; margin-bottom:12px }
.input{ height:28px; padding:0 10px; border:1px solid #d1d5db; border-radius:999px }
.btn{ height:28px; padding:0 14px; border-radius:999px; border:1px solid #111827; background:#111827; color:#fff }
.table{ width:100%; border-collapse:collapse }
th,td{ border-bottom:1px solid #e5e7eb; padding:10px; text-align:left; font-size:12px; vertical-align:top }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size:11px; white-space:pre-wrap; word-break:break-all }
.footer-bar{ position:sticky; bottom:0; background:#f6f6f6; padding:8px 12px; border-radius:12px; margin-top:12px }
.inner{ display:flex; align-items:center; gap:12px }
.flex-1{ flex:1 }
</style>
