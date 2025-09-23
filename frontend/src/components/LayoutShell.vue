
<template>
  <div class="shell">
    <!-- 顶部：Logo / 导航卡片 / 头像 -->
    <div class="header">
      <RouterLink class="logo" to="/" aria-label="仪表盘"></RouterLink>
      <div class="header-gap-left" aria-hidden="true"></div>

      <div class="nav-rail" role="navigation" aria-label="主导航（一级）">
        <div class="track">
          <div class="pill" :style="pillStyle" aria-hidden="true"></div>
          <RouterLink v-for="(l,idx) in l1" :key="l.path" class="link" :to="l.path"
                      :class="{active: isActive(l.path)}"
                      ref="l1refs[idx]">{{ l.text }}</RouterLink>
        </div>
      </div>

      <div class="header-gap-right" aria-hidden="true"></div>
      <div class="avatar" aria-label="头像"></div>
    </div>
  </div>

  <!-- 二级整行 -->
  <div class="subrow" aria-label="次级导航整行">
    <div class="subrow-inner">
      <div class="subbar-offset" aria-hidden="true"></div>
      <div class="subbar">
        <div class="sub-inner">
          <RouterLink v-for="s in l2" :key="s.to" class="sub" :to="s.to" :class="{active:isExact(s.to)}">
            {{ s.text }}
          </RouterLink>
        </div>
      </div>
    </div>
  </div>

  <!-- 面板 -->
  <div class="tabrow" aria-label="三级页签卡片行">
    <div class="tabrow-inner">
      <div class="tab-offset" aria-hidden="true"></div>
      <div class="tab-wrap">
        <!-- 三级页签（映射到二级下的子页） -->
        <div v-if="tabs.length" class="tabs">
          <RouterLink v-for="t in tabs" :key="t.to" class="tab" :to="t.to" :class="{active:isExact(t.to)}">
            <span class="tab__text">{{ t.text }}</span>
          </RouterLink>
          <span class="tab-ink" :style="inkStyle"></span>
        </div>

        <div class="tabcard" :class="{'no-tabs': !tabs.length}">
          <!-- 真实页面内容 -->
          <router-view />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { computed, onMounted, ref, watch } from 'vue'

const route = useRoute()

const l1 = [
  { path: '/orders/label-upload/list', text:'订单' },
  { path: '/products/list',            text:'商品' },
  { path: '/logistics/rules',          text:'物流' },
  { path: '/settings/system',          text:'设置' },
]
const l2Map: Record<string,{text:string,to:string}[]> = {
  '/orders': [
    { text:'面单上传', to:'/orders/label-upload/list' },
    { text:'上传记录', to:'/orders/label-upload/logs' },
  ],
  '/products': [
    { text:'商品列表', to:'/products/list' },
  ],
  '/logistics': [
    { text:'物流规则', to:'/logistics/rules' },
  ],
  '/settings': [
    { text:'系统设置', to:'/settings/system' },
  ],
}
const tabMap: Record<string,{text:string,to:string}[]> = {
  '/orders/label-upload': [
    { text:'面单列表', to:'/orders/label-upload/list' },
    { text:'上传记录', to:'/orders/label-upload/logs' },
  ],
}

function isActive(pathPrefix:string){ return route.path.startsWith(pathPrefix.split('/').slice(0,2).join('/')) }
function isExact(to:string){ return route.path===to }

const l2 = computed(()=>{
  const p = '/'+route.path.split('/')[1]
  return l2Map[p] || []
})
const tabs = computed(()=>{
  // 取前3段作为key
  const key = '/'+route.path.split('/').slice(0,3).join('/')
  // 回退：匹配 '/orders/label-upload'
  const k2 = '/'+route.path.split('/').slice(0,3).join('/')
  return tabMap['/orders/label-upload'] || []
})

// 胶囊滑块（简化实现）
const pillStyle = computed(()=>{
  // 仅根据当前一级索引粗略定位
  const idx = l1.findIndex(l => isActive(l.path))
  const minw = 60
  const left = 14 + idx * 80
  return { width: minw+'px', transform:`translate(${left}px,-50%)`, opacity:'1' }
})
const inkStyle = computed(()=>({ width:'60px', transform:'translateX(18px)' }))
</script>

<style scoped>
/* 无作用域样式均来自 huandan-ui.css */
</style>
