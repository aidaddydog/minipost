<template>
  <header style="display:flex;gap:12px;padding:10px 16px;border-bottom:1px solid #eee">
    <strong>Minipost</strong>
    <router-link to="/orders/label-upload/list">面单列表</router-link>
    <router-link to="/orders/label-upload/logs">上传记录</router-link>
    <router-link to="/orders/label-upload/tasks">换单任务</router-link>
    <router-link to="/orders/label-upload/audit">换单审计</router-link>
  </header>
  <main style="padding:16px"><router-view/></main>
</template>
