<script setup lang="ts">
// 面单列表页（订单号/运单号tracking/转单号transfer；含“预览换单/提交换单”）
import { ref, onMounted } from 'vue'
import http from '@/utils/http'
const kw = ref(''); const page = ref(1); const pageSize = ref(50)
const total = ref(0); const rows = ref<any[]>([]); const loading = ref(false)
const previewOpen = ref(false)
const previewData = ref<{ total_candidates: number; matched: number; samples: any[] }|null>(null)
const committing = ref(false)
async function load(){
  loading.value = true
  try{
    const { data } = await http.get('/orders/label-upload/list', { params: { kw: kw.value||undefined, page: page.value, page_size: pageSize.value } })
    total.value = data.total||0; rows.value = data.items||[]
  } finally { loading.value = false }
}
function onSearch(){ page.value = 1; load() }
function onPageChange(p:number){ page.value = p; load() }
async function onPreviewSwitch(){
  const { data } = await http.post('/orders/label-upload/switch/preview', { kw: kw.value||null })
  previewData.value = data; previewOpen.value = true
}
async function onCommitSwitch(){
  committing.value = true
  try{
    const { data } = await http.post('/orders/label-upload/switch/commit', { kw: kw.value||null, operator_id: 'frontend-operator' })
    alert(`换单完成：创建 ${data.created}，执行成功 ${data.executed}，失败 ${data.failed}`)
    load()
  } finally { committing.value = false }
}
onMounted(load)
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <input class="input" v-model="kw" placeholder="订单号/运单号/转单号" @keydown.enter="onSearch" />
      <button class="btn btn--black" @click="onSearch">搜索</button>
      <span style="flex:1"></span>
      <button class="btn" @click="onPreviewSwitch">预览换单</button>
      <button class="btn btn--black" :disabled="committing" @click="onCommitSwitch">
        {{ committing ? '提交中…' : '提交换单' }}
      </button>
    </div>

    <div class="table-wrap">
      <div v-if="loading" style="padding:8px;color:#64748b">正在加载…</div>
      <table class="table" v-else>
        <thead>
          <tr>
            <th>订单号</th><th>运单号</th><th>转单号</th><th>面单</th><th>状态</th><th style="min-width:220px">时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>{{ r.order_no || '-' }}</td>
            <td>{{ r.tracking_no || '-' }}</td>
            <td>{{ r.transfer_waybill_no || '-' }}</td>
            <td>{{ r.label_file ? '有文件' : '-' }}</td>
            <td>{{ r.status_text }}</td>
            <td>
              <div>创建：{{ r.created_at ? new Date(r.created_at).toLocaleString() : '-' }}</div>
              <div>打印：{{ r.printed_at ? new Date(r.printed_at).toLocaleString() : '-' }}</div>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="6" style="color:#9ca3af">暂无数据</td></tr>
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

    <div v-if="previewOpen" class="modal">
      <div class="box">
        <h3 style="margin:0 0 8px">换单预览</h3>
        <div v-if="!previewData">无结果</div>
        <div v-else>
          <p>候选 {{ previewData.total_candidates }} 条，命中 {{ previewData.matched }} 条（下方仅展示样本最多 20 条）。</p>
          <table class="table">
            <thead><tr><th>tracking_no</th><th>规则</th><th>建议转单号</th><th>动作</th></tr></thead>
            <tbody>
              <tr v-for="s in previewData.samples" :key="s.label_id">
                <td>{{ s.tracking_no }}</td>
                <td>{{ s.matched_rule_id }}</td>
                <td>{{ s.suggested_transfer_no }}</td>
                <td><pre class="mono">{{ JSON.stringify(s.action, null, 2) }}</pre></td>
              </tr>
              <tr v-if="!previewData.samples.length"><td colspan="4" style="color:#9ca3af">暂无样本</td></tr>
            </tbody>
          </table>
        </div>
        <div style="text-align:right;margin-top:8px">
          <button class="btn" @click="previewOpen=false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page{ padding:12px }
.toolbar{ display:flex; gap:8px; margin-bottom:12px }
.input{ height:28px; padding:0 10px; border:1px solid #d1d5db; border-radius:999px }
.btn{ height:28px; padding:0 14px; border-radius:999px; border:1px solid #111827; background:#fff }
.btn--black{ background:#111827; color:#fff }
.table{ width:100%; border-collapse:collapse }
th,td{ border-bottom:1px solid #e5e7eb; padding:10px; text-align:left; font-size:12px }
.footer-bar{ position:sticky; bottom:0; background:#f6f6f6; padding:8px 12px; border-radius:12px; margin-top:12px }
.inner{ display:flex; align-items:center; gap:12px }
.flex-1{ flex:1 }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size:11px; white-space:pre-wrap; word-break:break-all }
</style>
