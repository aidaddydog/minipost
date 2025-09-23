<script setup lang="ts">
import { ref, onMounted } from 'vue'
import http from '@/utils/http'
import { useRouter } from 'vue-router'
const router = useRouter()
const kw = ref(''); const page = ref(1); const pageSize = ref(50)
const total = ref(0); const rows = ref<any[]>([]); const loading = ref(false)
async function load(){
  loading.value = true
  try{
    const { data } = await http.get('/orders/label-upload/tasks', { params: { kw: kw.value||undefined, page: page.value, page_size: pageSize.value } })
    total.value = data.total||0; rows.value = data.items||[]
  } finally { loading.value = false }
}
function onSearch(){ page.value=1; load() }
function onPageChange(p:number){ page.value=p; load() }
function goAudit(taskId: string){ router.push({ path: '/orders/label-upload/audit', query: { task_id: taskId }}) }
onMounted(load)
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <input class="input" v-model="kw" placeholder="订单号/运单号/转单号" @keydown.enter="onSearch" />
      <button class="btn btn--black" @click="onSearch">搜索</button>
    </div>
    <div class="table-wrap">
      <div v-if="loading" style="padding:8px;color:#64748b">正在加载…</div>
      <table class="table" v-else>
        <thead>
          <tr><th>订单号</th><th>运单号</th><th>转单号</th><th>规则</th><th>状态</th><th>执行时间</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>{{ r.order_no || '-' }}</td>
            <td>{{ r.tracking_no || '-' }}</td>
            <td>{{ r.transfer_waybill_no || '-' }}</td>
            <td>{{ r.rule_name || r.rule_id || '-' }}</td>
            <td>{{ r.status }}</td>
            <td>{{ r.executed_at ? new Date(r.executed_at).toLocaleString() : '-' }}</td>
            <td><button class="link" @click="goAudit(r.id)">审计</button></td>
          </tr>
          <tr v-if="!rows.length"><td colspan="7" style="color:#9ca3af">暂无任务</td></tr>
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
th,td{ border-bottom:1px solid #e5e7eb; padding:10px; text-align:left; font-size:12px }
.link{ border:none;background:none;color:#111827;text-decoration:underline;cursor:pointer }
.footer-bar{ position:sticky; bottom:0; background:#f6f6f6; padding:8px 12px; border-radius:12px; margin-top:12px }
.inner{ display:flex; align-items:center; gap:12px }
.flex-1{ flex:1 }
</style>
