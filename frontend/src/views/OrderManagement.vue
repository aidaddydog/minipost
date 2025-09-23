<template>
  <div class="order-management">
    <!-- 顶部二级导航 -->
    <nav class="sub-nav">
      <div
        class="nav-item"
        :class="{ active: activeTab === 'list' }"
        @click="navigate('list')"
      >
        面单列表
      </div>
      <div
        class="nav-item"
        :class="{ active: activeTab === 'logs' }"
        @click="navigate('logs')"
      >
        上传记录
      </div>
      <div
        class="nav-item"
        :class="{ active: activeTab === 'tasks' }"
        @click="navigate('tasks')"
      >
        换单任务
      </div>
      <div
        class="nav-item"
        :class="{ active: activeTab === 'audit' }"
        @click="navigate('audit')"
      >
        换单审计
      </div>
    </nav>
    <div class="content">
      <!-- 渲染子路由 -->
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();

// 当前活动 tab 根据路由路径判断
const activeTab = computed(() => {
  const path = route.path;
  if (path.endsWith('/logs')) return 'logs';
  if (path.endsWith('/tasks')) return 'tasks';
  if (path.endsWith('/audit')) return 'audit';
  return 'list';
});

function navigate(tab: string) {
  const base = '/orders/label-upload';
  router.push(`${base}/${tab}`);
}
</script>

<style scoped>
@import '../styles/huandan-ui.css';

.sub-nav {
  display: flex;
  gap: var(--l2-gap);
  padding: 8px 0;
}

.nav-item {
  cursor: pointer;
  padding: var(--l2-item-py) var(--l2-item-px);
  border-radius: var(--l2-item-radius);
  color: var(--l2-color);
  font-size: var(--l2-font-size);
}

.nav-item.active {
  background-color: var(--pill-bg);
  color: var(--l2-hover);
}

.content {
  margin-top: 10px;
}
</style>