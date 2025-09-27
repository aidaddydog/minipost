/* modules/navauth_shell/frontend/static/nav_shell.js
 * 壳层交互（L1/L2/L3） + 页签 Ink 下划线 + “页签下方 iframe 载入业务页面”
 * + 全局蒙层（配合 iframe 内弹窗），以获得“全屏透明灰滤镜”的视觉效果。
 * 本文件会自动向 <head> 注入必要的补丁 CSS（.tab-ink / .shell-mask / iframe z-index）。
 */

(function(){
  // -------------------- DOM & 设置 --------------------
  const body    = document.body;
  const USE_REAL_NAV = (body.getAttribute('data-use-real-nav') === 'true');

  const track   = document.getElementById('navTrack');   // L1 轨道
  const pill    = document.getElementById('pill');       // L1 胶囊
  const subInner= document.getElementById('subInner');   // L2 容器
  const tabsEl  = document.getElementById('tabs');       // L3 页签容器
  const tabCard = document.getElementById('tabCard');    // 卡片
  const tabPanel= document.getElementById('tabPanel');   // 卡片里的业务载体（会插入 iframe）

  // -------------------- 注入补丁 CSS（Ink + 全局蒙层） --------------------
  (function injectPatchCSS(){
    if (document.getElementById('navShellPatch')) return;
    const css = `
/* --- Ink（页签文本下方滑动圆角线） --- */
:root{
  --tab-text-ml:37px;      /* 与演示一致：页签文本左内边距 */
  --tab-ink-height:2px;
  --tab-ink-radius:999px;
  --tab-ink-color:#000;    /* 横线颜色 */
  --tab-ink-pad-x:-8px;    /* 左右延展 */
  --tab-ink-ml:6px;        /* 相对文本起点的左偏移 */
  --tab-ink-mt:-1px;       /* 距 tabs 底部的垂直间距 */
}
.tabs{ position:relative; z-index:2; }
.tab__text{ display:inline-block; margin-left:var(--tab-text-ml); }
.tab-ink{
  position:absolute; left:0;
  top:calc(100% + var(--tab-ink-mt));
  height:var(--tab-ink-height); width:0;
  background:var(--tab-ink-color);
  border-radius:var(--tab-ink-radius);
  transform:translateX(0);
  transition:
    transform var(--anim-speed, .25s) var(--anim-ease, cubic-bezier(.22,.61,.36,1)),
    width     var(--anim-speed, .25s) var(--anim-ease, cubic-bezier(.22,.61,.36,1));
  z-index:4; pointer-events:none; opacity:1;
}
/* --- 壳层全局蒙层（配合 iframe 内弹窗） --- */
.shell-mask{
  position:fixed; inset:0; background:rgba(0,0,0,.35);
  display:none; z-index:999;    /* 低于 iframe（见下） */
}
.shell-mask.show{ display:block; }
/* 业务 iframe 放在更高层，确保可点击弹窗 */
.tabrow .tab-wrap .tabcard .tabpanel iframe{
  position:relative; z-index:1000; border:0; width:100%;
}
`;
    const style = document.createElement('style');
    style.id = 'navShellPatch';
    style.textContent = css;
    document.head.appendChild(style);
  })();

  // -------------------- 全局蒙层（壳层） --------------------
  const shellMask = (() => {
    let el = document.getElementById('shellMask');
    if (!el) {
      el = document.createElement('div');
      el.id = 'shellMask';
      el.className = 'shell-mask';
      document.body.appendChild(el);
    }
    return el;
  })();
  function hideShellMask(){
    shellMask.classList.remove('show');
    document.documentElement.style.overflow = '';
  }
  window.addEventListener('message', (e) => {
    const msg = e.data || {};
    if (msg && msg.type === 'shell-mask') {
      const show = msg.action === 'show';
      shellMask.classList.toggle('show', show);
      document.documentElement.style.overflow = show ? 'hidden' : '';
    }
  });

  // -------------------- 状态持久化 --------------------
  const SCHEMA_VERSION = 3;
  const STORAGE_KEY    = 'NAV_STATE_V3';
  let items = [];            // L1 列表（包含 children）
  let lockedPath = '/';      // 当前 L1 path
  let lockedSubHref = '';    // 当前 L2 href
  let lockedTabHref = '';    // 当前 L3 href

  function saveState(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v:SCHEMA_VERSION, lockedPath, lockedSubHref, lockedTabHref, ts:Date.now() }));
    }catch(e){}
  }
  function restoreState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      const o = JSON.parse(raw);
      if(o && o.v === SCHEMA_VERSION){
        lockedPath    = o.lockedPath    || lockedPath;
        lockedSubHref = o.lockedSubHref || lockedSubHref;
        lockedTabHref = o.lockedTabHref || lockedTabHref;
      }
    }catch(e){}
  }

  // -------------------- 工具 & 动效 --------------------
  const $ = (s, el=document)=> el.querySelector(s);
  function cssVarNum(name, fallback=0){
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if(!v) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  // L1 胶囊位移
  let _pillRAF=0, _pillNext=null;
  function movePillToEl(el){
    if(!el) return;
    const left = el.offsetLeft - track.scrollLeft;
    const minw = cssVarNum('--pill-minw', 60);
    const width= Math.max(minw, el.offsetWidth);
    _pillNext = { left, width };
    if(_pillRAF) return;
    _pillRAF = requestAnimationFrame(()=>{
      _pillRAF=0;
      if(!_pillNext) return;
      pill.style.width = _pillNext.width + 'px';
      pill.style.transform = `translate(${_pillNext.left}px,-50%)`;
      pill.style.opacity = 1;
      _pillNext=null;
    });
  }
  function movePillToL1Path(path){
    const a = [...track.querySelectorAll('a.link')].find(x=>x.dataset.path===path);
    movePillToEl(a);
  }
  track && track.addEventListener('scroll', ()=> movePillToL1Path(lockedPath));

  // Tabs 下划线（Ink）
  function ensureTabInk(){
    let ink = document.getElementById('tabInk');
    if(!ink){
      ink = document.createElement('span');
      ink.id = 'tabInk';
      ink.className = 'tab-ink';
      tabsEl.appendChild(ink);
    }
    return ink;
  }
  function positionTabInk(activeTabEl=null, animate=false){
    const ink = ensureTabInk();
    const a = activeTabEl || tabsEl.querySelector('.tab.active');
    if(!a){ ink.style.width='0px'; return; }
    const txt = a.querySelector('.tab__text') || a;
    const rect = txt.getBoundingClientRect();
    const tabsRect = tabsEl.getBoundingClientRect();
    const padX  = cssVarNum('--tab-ink-pad-x',0);
    const ml    = cssVarNum('--tab-ink-ml',0);
    const left  = Math.round(rect.left - tabsRect.left + ml);
    const width = Math.max(2, Math.round(rect.width + padX*2));

    if(!animate){
      const prev = ink.style.transition;
      ink.style.transition = 'none';
      ink.style.width = width + 'px';
      ink.style.transform = `translateX(${left}px)`;
      // 强制回流以应用无动画
      void ink.offsetWidth;
      ink.style.transition = prev || '';
    }else{
      ink.style.width = width + 'px';
      ink.style.transform = `translateX(${left}px)`;
    }
  }

  // -------------------- 渲染 --------------------
  function renderL1(){
    // 清理原有
    [...track.querySelectorAll('a.link')].forEach(x=>x.remove());
    (items||[]).forEach(it=>{
      const a=document.createElement('a');
      a.className='link' + (it.path===lockedPath?' active':'');
      a.dataset.path = it.path;
      a.href = it.path;
      a.textContent = it.title || it.path;
      a.addEventListener('click', (e)=>{
        if(!USE_REAL_NAV) e.preventDefault();
        lockedPath = it.path;
        const l1 = getCurrentL1();
        const sub = pickDefaultL2(l1);
        lockedSubHref = sub ? sub.path : '';
        const tab = pickDefaultL3(sub);
        lockedTabHref = tab ? tab.path : '';
        saveState();
        renderL1(); renderSub(); renderTabs(); loadTabContent(lockedTabHref);
        movePillToEl(a);
        hideShellMask();      // 切换时兜底隐藏壳层蒙层
        if(USE_REAL_NAV && lockedSubHref) window.location.href = lockedSubHref;
      });
      track.appendChild(a);
    });
    requestAnimationFrame(()=> movePillToL1Path(lockedPath));
  }

  function renderSub(){
    const l1 = getCurrentL1();
    const subs = (l1 && l1.children || []).filter(s=>s.visible!==false);
    subInner.innerHTML = subs.map(s=>
      `<a class="sub ${s.path===lockedSubHref?'active':''}" data-href="${s.path}" href="${s.path}">${s.title||s.path}</a>`
    ).join('');
    subInner.querySelectorAll('a.sub').forEach(a=>{
      a.addEventListener('click',(e)=>{
        if(!USE_REAL_NAV) e.preventDefault();
        lockedSubHref = a.dataset.href || '';
        const sub = getCurrentL2();
        const tab = pickDefaultL3(sub);
        lockedTabHref = tab ? tab.path : '';
        saveState();
        // 视觉
        subInner.querySelectorAll('a.sub').forEach(x=>x.classList.remove('active')); a.classList.add('active');
        renderTabs(); loadTabContent(lockedTabHref);
        hideShellMask();
        if(USE_REAL_NAV && lockedSubHref) window.location.href = lockedSubHref;
      });
    });
    updateSubRowMinHeight();
  }

  function renderTabs(){
    const sub = getCurrentL2();
    const tabs = (sub && sub.children || []).filter(t=>t.visible!==false);
    tabsEl.innerHTML = tabs.map(t=>
      `<a class="tab ${t.path===lockedTabHref?'active':''}" data-href="${t.path}" href="${t.path}"><span class="tab__text">${t.title||t.path}</span></a>`
    ).join('');
    ensureTabInk();

    tabsEl.querySelectorAll('a.tab').forEach(a=>{
      a.addEventListener('click', (e)=>{
        if(!USE_REAL_NAV) e.preventDefault();
        lockedTabHref = a.dataset.href || '';
        tabsEl.querySelectorAll('a.tab').forEach(x=>x.classList.remove('active')); a.classList.add('active');
        saveState();
        positionTabInk(a, true);   // 点击时动画
        loadTabContent(lockedTabHref);
        hideShellMask();
        if(USE_REAL_NAV && lockedTabHref) window.location.href = lockedTabHref;
      });
    });

    tabCard.classList.remove('no-tabs');
    // 初次/切换 L2 时：无动画定位 Ink
    requestAnimationFrame(()=> positionTabInk(tabsEl.querySelector('.tab.active'), false));
  }

  function updateSubRowMinHeight(){
    const row = document.getElementById('subRow');
    if(!row) return;
    const textH=subInner.getBoundingClientRect().height||0;
    row.style.minHeight=(textH+5)+'px';
  }

  // -------------------- 选择默认项 --------------------
  function getCurrentL1(){
    return items.find(x=>x.path===lockedPath) || items[0] || null;
  }
  function getCurrentL2(){
    const l1 = getCurrentL1();
    if(!l1) return null;
    return (l1.children||[]).find(s=>s.path===lockedSubHref) || (l1.children||[])[0] || null;
  }
  function pickDefaultL2(l1){
    if(!l1) return null;
    return (l1.children||[]).find(s=>s.default && s.visible!==false)
        || (l1.children||[]).find(s=>s.visible!==false)
        || null;
  }
  function pickDefaultL3(sub){
    if(!sub) return null;
    return (sub.children||[]).find(t=>t.default && t.visible!==false)
        || (sub.children||[]).find(t=>t.visible!==false)
        || null;
  }

  // -------------------- 业务内容载入（关键：iframe 放在页签下面） --------------------
  function loadTabContent(href){
    if(!href){ tabPanel.innerHTML=''; return; }
    tabPanel.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = href;
    iframe.title = '业务模块';
    iframe.setAttribute('frameborder','0');
    iframe.setAttribute('scrolling','auto');
    tabPanel.appendChild(iframe);

    // 自适应高度
    const fit = ()=>{
      const top = tabPanel.getBoundingClientRect().top;
      const h = Math.max(120, Math.floor(window.innerHeight - top - 12));
      iframe.style.height = h + 'px';
    };
    fit();
    window.addEventListener('resize', fit);
    new ResizeObserver(fit).observe(tabPanel);
  }

  // -------------------- 启动：拉取导航 & 首屏定位 --------------------
  function initAfterNav(){
    restoreState();

    const l1 = items.find(x=>x.path===lockedPath) || items[0] || null;
    if(!l1){ items=[]; renderL1(); return; }
    lockedPath = l1.path;

    const sub = (lockedSubHref && (l1.children||[]).find(s=>s.path===lockedSubHref)) || pickDefaultL2(l1);
    lockedSubHref = sub ? sub.path : '';

    const tab = (sub && lockedTabHref && (sub.children||[]).find(t=>t.path===lockedTabHref)) || pickDefaultL3(sub);
    lockedTabHref = tab ? tab.path : '';

    renderL1(); renderSub(); renderTabs(); loadTabContent(lockedTabHref);
    movePillToL1Path(lockedPath);
    saveState();

    // 尺寸变化时重算 Ink 与 iframe 高度
    window.addEventListener('resize', ()=>{
      positionTabInk(tabsEl.querySelector('.tab.active'), false);
    });
  }

  async function bootstrap(){
    if(!USE_REAL_NAV){
      // 演示/降级：给出最小导航，便于纯前端联调
      items = [{
        level:1, title:'物流', path:'/logistics', order:1, visible:true, children:[
          { level:2, title:'物流渠道', path:'/logistics/channel', order:1, visible:true, default:true, children:[
            { level:3, title:'自定义物流', path:'/logistics/channel/custom', order:60, visible:true, default:true }
          ] }
        ]
      }];
      initAfterNav();
      return;
    }
    try{
      const res = await fetch('/api/nav', { headers:{'Accept':'application/json'} });
      const data = await res.json();
      items = Array.isArray(data.items) ? data.items : [];
    }catch(e){
      items = [];
    }
    initAfterNav();
  }

  bootstrap();
})();
