<template>
  <!--
    上传记录页面
    显示最近上传的换单/订单映射文件记录。点击成功/失败数量按钮可展开弹窗
    查看相应的订单号列表，并支持复制到剪贴板。界面样式与用户的 huandan UI 保持一致。
  -->
  <div class="page">
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>文件名</th>
            <th>类型</th>
            <th>总数</th>
            <th>成功</th>
            <th>失败</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td>{{ log.time }}</td>
            <td>{{ log.file }}</td>
            <td>{{ log.type }}</td>
            <td>{{ log.total }}</td>
            <td>
              <button class="link" @click="openLog(log, 'success')" v-if="log.success">
                {{ log.success }}
              </button>
              <span v-else>0</span>
            </td>
            <td>
              <button class="link" @click="openLog(log, 'fail')" v-if="log.fail">
                {{ log.fail }}
              </button>
              <span v-else>0</span>
            </td>
            <td>
              <button class="btn" @click="openLog(log, 'success')" v-if="log.success_nos?.length">
                查看成功
              </button>
              <button class="btn" @click="openLog(log, 'fail')" v-if="log.fail_nos?.length">
                查看失败
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!logs.length" class="empty">暂无上传记录</p>
      <!-- 分页条 -->
      <div v-if="logs.length" class="footer-bar">
        <div class="inner">
          <div class="flex-1">共 {{ total }} 条</div>
          <div>
            <button class="btn" :disabled="page<=1" @click="prevPage">上一页</button>
            <button class="btn" :disabled="page*pageSize>=total" @click="nextPage">下一页</button>
          </div>
        </div>
      </div>
    </div>
    <!-- 列表弹窗 -->
    <div v-if="modalOpen" class="modal">
      <div class="box">
        <h3 style="font-size:12px;margin-bottom:8px;">{{ modalTitle }}</h3>
        <textarea
          readonly
          v-model="listText"
          style="width:100%;height:180px;font-family:ui-monospace;font-size:11px;line-height:1.4;border:1px solid #e5e7eb;padding:8px;border-radius:6px;box-sizing:border-box;"
        ></textarea>
        <div class="footer-bar" style="margin-top:8px;">
          <div class="inner">
            <div class="flex-1"></div>
            <button class="btn" @click="copyList">复制</button>
            <button class="btn btn--black" @click="modalOpen=false">关闭</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import http from '@/utils/http';

// 列表数据与分页
const logs = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(50);
const loading = ref(false);

// 弹窗数据
const modalOpen = ref(false);
const modalTitle = ref('');
const listText = ref('');

async function load() {
  loading.value = true;
  try {
    const { data } = await http.get('/orders/label-upload/logs', {
      params: { page: page.value, page_size: pageSize.value }
    });
    total.value = data.total || 0;
    logs.value = data.items || [];
  } finally {
    loading.value = false;
  }
}

function nextPage() {
  if (page.value * pageSize.value < total.value) {
    page.value++;
    load();
  }
}
function prevPage() {
  if (page.value > 1) {
    page.value--;
    load();
  }
}

// 打开成功或失败列表
function openLog(record: any, kind: 'success' | 'fail') {
  modalTitle.value = `${record.type}｜${record.file}（${kind === 'success' ? '成功' : '失败'}：${kind === 'success' ? record.success : record.fail}）`;
  const arr = kind === 'success' ? record.success_nos || [] : record.fail_nos || [];
  listText.value = (arr || []).join('\n');
  modalOpen.value = true;
}

function copyList() {
  navigator.clipboard.writeText(listText.value || '').then(() => {
    alert('已复制');
  });
}

onMounted(load);
</script>

<style scoped>
@import '../styles/huandan-ui.css';

.page {
  padding: var(--page-px);
  background: var(--page-bg);
  color: var(--text);
  font-family: var(--font-family);
  font-size: var(--font-size-base);
}
.table-wrap {
  overflow-x: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-base);
}
.table th,
.table td {
  padding: 8px 10px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
}
.table th {
  background: var(--rail-bg);
  color: var(--l1-color);
}
.table tr:nth-child(even) td {
  background-color: #fafafa;
}
.empty {
  text-align: center;
  padding: 16px;
  color: #999;
}
.link {
  border: none;
  background: none;
  color: var(--l1-active);
  text-decoration: underline;
  cursor: pointer;
  font-size: var(--font-size-base);
}
.btn {
  height: var(--btn-h);
  min-width: var(--btn-minw);
  padding: 0 var(--btn-px);
  border-radius: var(--btn-radius);
  border: var(--btn-border-width) solid var(--btn-black-bg);
  background: var(--page-bg);
  color: var(--btn-black-bg);
  font-size: var(--btn-font-size);
  cursor: pointer;
  margin-right: 6px;
}
.btn--black {
  background: var(--btn-black-bg);
  color: var(--btn-black-ink);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.footer-bar {
  position: sticky;
  bottom: 0;
  background: var(--filter-card-bg);
  padding: 8px 12px;
  border-radius: 12px;
  margin-top: 12px;
}
.inner {
  display: flex;
  align-items: center;
  gap: 12px;
}
.flex-1 {
  flex: 1;
}
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.box {
  width: min(520px, 90vw);
  background: var(--page-bg);
  border-radius: 12px;
  padding: 12px;
}
</style>