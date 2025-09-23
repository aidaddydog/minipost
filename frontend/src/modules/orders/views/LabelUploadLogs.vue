<script setup lang="ts">
import { ref, onMounted } from 'vue'
import http from '@/utils/http'
const page = ref(1); const pageSize = ref(50); const total = ref(0)
const rows = ref<any[]>([]); const loading = ref(false)
const modalOpen = ref(false); const modalTitle = ref(''); const listText = ref('')
async function load(){
  loading.value = true
  try{
    const { data } = await http.get('/orders/label-upload/logs', { params: { page: page.value, page_size: pageSize.value } })
    total.value = data.total||0; rows.value = data.items||[]
  } finally { loading.value = false }
}
function onPageChange(p: number){ page.value=p; load() }
function openLog(r: any, kind: 'success'|'fail'){
  modalTitle.value = `${r.type}｜${r.file}（${kind==='success'?'成功':'失败'}：${kind==='success'?r.success:r.fail}）`
  const arr = (kind==='success' ? (r.success_nos||[]) : (r.fail_nos||[]))
  listText.value = (arr||[]).join('\n'); modalOpen.value=true
}
function copyList(){ navigator.clipboard.writeText(listText.value||'').then(()=>alert('已复制')) }
onMounted(load)
</script>

<template>
  <div class="page">
    <div class="table-wrap">
      <div v-if="loading" style="padding:8px;color:#64748b">正在加载…</div>
      <table class="table" v-else>
        <thead>
          <tr><th>时间</th><th>文件名</th><th>上传类型</th><th>总数</th><th>成功</th><th>失败</th><th>操作人</th><th>日志</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>{{ new Date(r.time).toLocaleString() }}</td>
            <td>{{ r.file }}</td>
            <td>{{ r.type }}</td>
            <td>{{ r.total }}</td>
            <td>{{ r.success }}</td>
            <td>{{ r.fail }}</td>
            <td>{{ r.operator || '-' }}</td>
            <td>
              <button class="link" @click="openLog(r,'fail')" :disabled="!r.fail">失败明细</button>
              <button class="link" @click="openLog(r,'success')" :disabled="!r.success">成功明细</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="8" style="color:#9ca3af">暂无记录</td></tr>
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

    <div v-if="modalOpen" class="modal">
      <div class="box">
        <h3 style="margin:0 0 8px">{{ modalTitle }}</h3>
        <textarea style="width:100%;height:200px" readonly :value="listText"></textarea>
        <div style="text-align:right;margin-top:8px">
          <button class="btn" @click="modalOpen=false">关闭</button>
          <button class="btn btn--black" @click="copyList">复制</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page{ padding:12px }
.table{ width:100%; border-collapse:collapse }
th,td{ border-bottom:1px solid #e5e7eb; padding:10px; text-align:left; font-size:12px }
.link{ border:none; background:none; color:#111827; text-decoration:underline; cursor:pointer; margin-right:8px }
.btn{ height:28px; padding:0 14px; border-radius:999px; border:1px solid #111827; background:#fff; }
.btn--black{ background:#111827; color:#fff; }
.modal{ position:fixed; inset:0; background:rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; z-index:200 }
.box{ width:min(520px,90vw); background:#fff; border-radius:12px; padding:12px; }
.footer-bar{ position:sticky; bottom:0; background:#f6f6f6; padding:8px 12px; border-radius:12px; margin-top:12px }
.inner{ display:flex; align-items:center; gap:12px }
.flex-1{ flex:1 }
</style>
