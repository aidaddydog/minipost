<template>
  <!--
    面单列表页

    该页面实现了与用户提供的 huandan UI V1.0 静态界面一致的视觉样式。它包含搜索框、
    分页、预览换单与提交换单按钮，并以表格形式呈现订单列表。点击预览换单按钮会
    调用后端预览接口并显示预览结果。提交换单按钮会提交换单任务。所有接口路径
    均添加了 /api/v1 前缀以匹配后端的 FastAPI 路由。
  -->
  <div class="page">
    <!-- 搜索与操作工具栏 -->
    <div class="toolbar">
      <input
        v-model="kw"
        class="input"
        type="text"
        placeholder="搜索订单号/运单号/转单号"
        @keyup.enter="onSearch"
      />
      <button class="btn" @click="onSearch">搜索</button>
      <button class="btn btn--black" :disabled="loading" @click="onPreviewSwitch">
        预览换单
      </button>
      <button class="btn btn--black" :disabled="committing" @click="onCommitSwitch">
        提交换单
      </button>
    </div>
    <!-- 表格列表 -->
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>订单号</th>
            <th>运单号</th>
            <th>转单号</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.order_no || '-' }}</td>
            <td>{{ row.tracking_no || '-' }}</td>
            <td>{{ row.transfer_waybill_no || '-' }}</td>
            <td>{{ row.status_text || '-' }}</td>
            <td>
              <!-- 单行预览按钮：暂使用本地预览实现 -->
              <button class="btn" @click="openPreviewForRow(row)">预览</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length" class="empty">暂无数据</p>
      <!-- 分页条 -->
      <div v-if="rows.length" class="footer-bar">
        <div class="inner">
          <div class="flex-1">共 {{ total }} 条</div>
          <div>
            <button class="btn" :disabled="page<=1" @click="prevPage">上一页</button>
            <button
              class="btn"
              :disabled="page*pageSize>=total"
              @click="nextPage"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- 预览结果弹窗 -->
    <div v-if="previewOpen" class="modal">
      <div class="box">
        <h3 style="font-size:12px;margin-bottom:8px;">预览换单结果</h3>
        <p class="mono">候选总数：{{ previewData?.total_candidates }}</p>
        <p class="mono">已匹配：{{ previewData?.matched }}</p>
        <div style="margin-top:8px;max-height:150px;overflow:auto;">
          <ul>
            <li v-for="(s,i) in previewData?.samples || []" :key="i" class="mono">
              {{ s }}
            </li>
          </ul>
        </div>
        <div class="footer-bar">
          <div class="inner">
            <div class="flex-1"></div>
            <button class="btn btn--black" @click="previewOpen=false">关闭</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
// 使用项目提供的 http 工具以便自动携带租户信息和前缀
import http from '@/utils/http';

// 搜索关键字、分页参数
const kw = ref('');
const page = ref(1);
const pageSize = ref(50);
const total = ref(0);

// 列表数据与加载状态
const rows = ref<any[]>([]);
const loading = ref(false);
const committing = ref(false);

// 预览结果与弹窗状态
const previewOpen = ref(false);
const previewData = ref<any | null>(null);

// 加载列表数据
async function load() {
  loading.value = true;
  try {
    const { data } = await http.get('/orders/label-upload/list', {
      params: { kw: kw.value || undefined, page: page.value, page_size: pageSize.value }
    });
    total.value = data.total || 0;
    rows.value = data.items || [];
  } finally {
    loading.value = false;
  }
}

// 搜索触发
function onSearch() {
  page.value = 1;
  load();
}

// 下一页
function nextPage() {
  if (page.value * pageSize.value < total.value) {
    page.value++;
    load();
  }
}

// 上一页
function prevPage() {
  if (page.value > 1) {
    page.value--;
    load();
  }
}

// 全局预览：调用后端接口并展示结果
async function onPreviewSwitch() {
  const { data } = await http.post('/orders/label-upload/switch/preview', {
    kw: kw.value || null
  });
  previewData.value = data;
  previewOpen.value = true;
}

// 提交换单：调用后端接口
async function onCommitSwitch() {
  committing.value = true;
  try {
    const { data } = await http.post('/orders/label-upload/switch/commit', {
      kw: kw.value || null,
      operator_id: 'frontend-operator'
    });
    alert(`换单完成：创建 ${data.created}，执行成功 ${data.executed}，失败 ${data.failed}`);
    load();
  } finally {
    committing.value = false;
  }
}

// 单条预览：构造临时预览结果
function openPreviewForRow(row: any) {
  previewData.value = {
    total_candidates: 1,
    matched: 1,
    samples: [`订单号 ${row.order_no || ''} 的换单预览`] // 示例：简单提示
  };
  previewOpen.value = true;
}

onMounted(load);
</script>

<style scoped>
@import '../styles/huandan-ui.css';

/* 版心区域 */
.page {
  padding: var(--page-px);
  background: var(--page-bg);
  color: var(--text);
  font-family: var(--font-family);
  font-size: var(--font-size-base);
}

/* 工具栏 */
.toolbar {
  display: flex;
  gap: var(--btn-gap);
  margin-bottom: 12px;
}
.input {
  height: var(--input-h);
  min-width: var(--input-search-w);
  padding: 0 var(--ctl-px);
  border: var(--input-border-width) solid var(--ctl-border);
  border-radius: var(--input-radius);
  font-size: var(--ctl-font-size);
  outline: none;
  color: var(--ctl-ink);
}
.input::placeholder {
  color: var(--ctl-placeholder);
}
.btn {
  height: var(--btn-h);
  min-width: var(--btn-minw);
  padding: 0 var(--btn-px);
  border-radius: var(--btn-radius);
  border: var(--btn-border-width) solid var(--btn-black-bg);
  background: var(--btn-black-bg);
  color: var(--btn-black-ink);
  cursor: pointer;
  font-size: var(--btn-font-size);
}
.btn:not(.btn--black) {
  background: var(--page-bg);
  color: var(--btn-black-bg);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 表格区域 */
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
  background-color: var(--rail-bg);
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

/* 底部分页条 */
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

/* 弹窗样式 */
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
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>