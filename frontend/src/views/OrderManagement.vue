<template>
  <div class="shell">
    <div class="header">
      <a class="logo" href="/admin" aria-label="仪表盘"></a>
      <div class="header-gap-left" aria-hidden="true"></div>

      <div class="nav-rail" ref="rail">
        <div class="track">
          <div class="pill" ref="pill"></div>
          <a class="link" :class="{active: l1==='orders'}" @click.prevent="switchL1('orders')">订单</a>
          <a class="link" :class="{active: l1==='products'}" @click.prevent="switchL1('products')">商品</a>
          <a class="link" :class="{active: l1==='logistics'}" @click.prevent="switchL1('logistics')">物流</a>
          <a class="link" :class="{active: l1==='settings'}" @click.prevent="switchL1('settings')">设置</a>
        </div>
      </div>

      <div class="header-gap-right" aria-hidden="true"></div>
      <div class="avatar" aria-label="头像"></div>
    </div>
  </div>

  <div class="subrow">
    <div class="subrow-inner">
      <div class="subbar-offset" aria-hidden="true"></div>
      <div class="subbar">
        <div class="sub-inner">
          <a class="sub" :class="{active: sub==='prealert'}" @click.prevent="go('/orders/prealert/list')">预报</a>
          <a class="sub" :class="{active: sub==='list'}" @click.prevent="go('/orders/label-upload/list')">面单上传</a>
          <a class="sub" :class="{active: sub==='track'}" @click.prevent="go('/orders/track')">订单轨迹</a>
          <a class="sub" :class="{active: sub==='rules'}" @click.prevent="go('/orders/rules')">订单规则</a>
        </div>
      </div>
    </div>
  </div>

  <div class="tabrow">
    <div class="tabrow-inner">
      <div class="tab-offset" aria-hidden="true"></div>
      <div class="tab-wrap">
        <div class="tabs" ref="tabs">
          <a class="tab" :class="{active: tab==='list'}" @click.prevent="go('/orders/label-upload/list')"><span class="tab__text">面单列表</span></a>
          <a class="tab" :class="{active: tab==='logs'}" @click.prevent="go('/orders/label-upload/logs')"><span class="tab__text">上传记录</span></a>
          <span class="tab-ink" ref="ink"></span>
        </div>
        <div class="tabcard">
          <router-view />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const l1 = ref('orders')
const sub = ref('list')
const tab = ref('list')

const rail = ref<HTMLElement|null>(null)
const pill = ref<HTMLElement|null>(null)
const tabs = ref<HTMLElement|null>(null)
const ink = ref<HTMLElement|null>(null)

function go(path: string){
  router.push(path)
}

function switchL1(key: string){
  l1.value = key
}

function movePillToActive(){
  const el = rail.value?.querySelector('.link.active') as HTMLElement | null
  if(!el || !pill.value || !rail.value) return
  const left = el.offsetLeft - (rail.value.querySelector('.track') as HTMLElement).scrollLeft
  const minw = 60
  const width = Math.max(minw, el.offsetWidth)
  pill.value.style.width = width + 'px'
  pill.value.style.transform = `translate(${left}px,-50%)`
  pill.value.style.opacity = '1'
}

function positionInk(){
  const a = tabs.value?.querySelector('.tab.active .tab__text') as HTMLElement | null
  if(!a || !ink.value || !tabs.value) return
  const rect = a.getBoundingClientRect()
  const tabsRect = (tabs.value as HTMLElement).getBoundingClientRect()
  const left = Math.round(rect.left - tabsRect.left + 6)
  const width = Math.max(2, Math.round(rect.width - 16))
  ink.value.style.width = width + 'px'
  ink.value.style.transform = `translateX(${left}px)`
}

function syncByRoute(){
  const p = route.path
  sub.value = p.includes('/label-upload') ? 'list' : 'prealert'
  tab.value = p.endsWith('/logs') ? 'logs' : 'list'
  requestAnimationFrame(()=>{ positionInk(); movePillToActive() })
}

onMounted(()=>{
  syncByRoute()
  movePillToActive()
  window.addEventListener('resize', positionInk)
})
watch(()=>route.path, ()=> syncByRoute())
</script>

<style scoped>
@import '../styles/huandan-ui.css';
</style>
