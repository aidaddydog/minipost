<template>
  <!--
    换单任务页面
    显示当前正在执行或已完成的换单任务。页面采用表格展示任务详情，
    包含 ID、状态、创建时间、完成时间等信息。
  -->
  <div class="page">
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>完成时间</th>
            <th>成功/失败</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in tasks" :key="task.id">
            <td>{{ task.id }}</td>
            <td>{{ task.status }}</td>
            <td>{{ task.created_at }}</td>
            <td>{{ task.finished_at || '-' }}</td>
            <td>{{ task.success }} / {{ task.fail }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!tasks.length" class="empty">暂无换单任务</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import http from '@/utils/http';

const tasks = ref<any[]>([]);

async function load() {
  try {
    const { data } = await http.get('/orders/label-upload/tasks');
    tasks.value = data.items || data || [];
  } catch (e) {
    console.error('获取换单任务失败', e);
  }
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
</style>