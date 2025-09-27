/* modules/navauth_shell/frontend/static/nav_shell.js  (V3)
 * 壳层交互：L1/L2/L3 导航 + 页签 Ink + 整页灰滤镜（壳层蒙层）
 * - 自动注入 .tab-ink（滑动圆角线）与 .shell-mask（壳层全局蒙层）样式
 * - iframe 层级抬高到蒙层之上：灰滤镜全屏可见，同时 iframe 内的弹窗可交互
 * - 默认 L1→L2→L3：优先找 nav 数据里的 { default:true }，否则取第一个 visible=true
 */

(function(){
  // -------------------- DOM --------------------
  const body     = document.body;
  const USE_REAL_NAV = (body.getAttribute('data-use-real-nav') === 'true'); // 壳层 body 上 data-use-real-nav="true" 时走真实 /api/nav
  const track    = document.getElementById('navTrack');   // L1 容器（轨道）
  const pill     = document.getElementById('pill');       // L1 胶囊
  const subInner = document.getElementById('subInner');   // L2 容器
  const tabsEl   = document.getElementById('tabs');       // L3 页签容器
  const tabCard  = document.getElementById('tabCard');    // 卡片
  const tabPanel = document.getElementById('tabPanel');   // 卡片内容（iframe 挂载点）

  // -------------------- 注入补丁 CSS --------------------
  (function injectPatchCSS(){
    const OLD_ID = 'navShellPatch';
    document.getElementById(OLD_ID)?.remove();

    // 采用极高层级，确保壳层任意元素都被蒙层覆盖；iframe 再 +1 确保可交互
    const Z_SHELL_MASK = 2147483000;
    const Z_IFRAME     = 2147483001;

    const css = `
:root{
  --tab-text-ml:37px;
  --tab-ink-height:2px; --tab-ink-radius:999px; --tab-ink-color:#000;
  --tab-ink-pad-x:-8px; --tab-ink-ml:6px; --tab-ink-mt:-1px;
}
/* 页签 Ink（滑动圆角线） */
.tabs{ position:relative; z-index:2; }
.tab__text{ display:inline-block; margin-left:var(--tab-text-ml); }
.tab-ink{
  position:absolute; left:0; top:calc(100% + var(--tab-ink-mt));
  height:var(--tab-ink-height); width:0;
  background:var(--tab-ink-color); border-radius:var(--tab-ink-radius);
  transform:translateX(0);
  transition:
    transform var(--anim-speed,.25s) var(--anim-ease,cubic-bezier(.22,.61,.36,1)),
    width     var(--anim-speed,.25s) var(--anim-ease,cubic-bezier(.22,.61,.36,1));
  z-index:4; pointer-events:none; opacity:1;
}
/* 壳层全局蒙层：与 iframe 内弹窗背景叠加，实现整页灰滤镜 */
.shell-mask{
  position:fixed; left:0; top:0; right:0; bottom:0; width:100vw; height:100vh;
  background:rgba(0,0,0,.35);
  display:none; z-index:${Z_SHELL_MASK};
}
.shell-mask.show{ display:block; }
/* iframe 置于蒙层之上，保证可以点击到 iframe 内弹窗 */
.tabrow .tab-wrap .tabcard .tabpanel iframe{
  position:relative; z-index:${Z_IFRAME}; border:0; width:100%;
}
`;
    const style = document.createElement('style');
    style.id = OLD_ID;
    style.textContent = css;
    document.head.appendChild(style);
  })();

  // -------------------- 壳层全局蒙层节点 --------------------
  const shellMask = (function ensureMask(){
    let el = document.getElementById('shellMask');
    if(!el){
      el = document.createElement('div');
      el.id = 'shellMask';
      el.className = 'shell-mask';
      document.body.appendChild(el); // 一定挂到 <body> 直下
    }
    return el;
  })();
  function hideShellMask(){
    shellMask.classList.remove('show');
    document.documentElement.style.overflow = '';
  }
  // 监听来自 iframe 的联动消息
  window.addEventListener('message', (e)=>{
    const msg = e?.data || {};
    if(msg && msg.type === 'shell-mask'){
      const show = msg.action === 'show';
      shellMask.classList.toggle('show', show);
      document.documentElement.style.overflow = show ? 'hidden' : '';
    }
  });

  // -------------------- 状态 & 存储 --------------------
  const SCHEMA_VERSION = 3;
  const STORAGE_KEY    = 'NAV_STATE_V3';
  let items = [];             // L1 列表（含 children）
  let lockedPath    = '/';    // 当前 L1 path
  let lockedSubHref = '';     // 当前 L2 href
  let lockedTabHref = '';     // 当前 L3 href

  function saveState(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v:SCHEMA_VERSION, lockedPath, lockedSubHref, lockedTabHref, ts:Date.now()
      }));
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

  // -------------------- 工具 --------------------
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
  track && track.addEventListener('scroll', ()=> movePillToL1Path(lockedPath));
  function movePillToL1Path(path){
    const a = [...track.querySelectorAll('a.link')].find(x=>x.dataset.path===path);
    movePillToEl(a);
  }

  // 页签 Ink
  function ensureTabInk(){
    let ink = document.getElementById('tabInk');
    if(!ink){
      ink = document.createElement('span');
      ink.id = 'tabInk';
      ink.className = 'tab-ink';
      tabsEl && tabsEl.appendChild(ink);
    }
    return ink;
  }
  function positionTabInk(activeTabEl=null, animate=false){
    const ink = ensureTabInk();
    const a = activeTabEl || tabsEl?.querySelector('.tab.active');
    if(!a || !ink){ return; }
    const txt = a.querySelector('.tab__text') || a;
    const rect = txt.getBoundingClientRect();
    const tabsRect = tabsEl.getBoundingClientRect();
    const padX = cssVarNum('--tab-ink-pad-x',0);
    const ml   = cssVarNum('--tab-ink-ml',0);
    const left  = Math.round(rect.left - tabsRect.left + ml);
    const width = Math.max(2, Math.round(rect.width + padX*2));
    if(!animate){
      const prev = ink.style.transition;
      ink.style.transition = 'none';
      ink.style.width = width + 'px';
      ink.style.transform = `translateX(${left}px)`;
      void ink.offsetWidth; // 强制回流
      ink.style.transition = prev || '';
    }else{
      ink.style.width = width + 'px';
      ink.style.transform = `translateX(${left}px)`;
    }
  }
  window.addEventListener('resize', ()=> positionTabInk(tabsEl?.querySelector('.tab.active'), false));

  // -------------------- 默认项选取 --------------------
  function getCurrentL1(){ return items.find(x=>x.path===lockedPath) || items[0] || null; }
  function getCurrentL2(){
    const l1 = getCurrentL1(); if(!l1) return null;
    return (l1.children||[]).find(s=>s.path===lockedSubHref)
        || (l1.children||[]).find(s=>s.default && s.visible!==false)
        || (l1.children||[]).find(s=>s.visible!==false)
        || null;
  }
  function getCurrentL3(){
    const l2 = getCurrentL2(); if(!l2) return null;
    return (l2.children||[]).find(t=>t.path===lockedTabHref)
        || (l2.children||[]).find(t=>t.default && t.visible!==false)
        || (l2.children||[]).find(t=>t.visible!==false)
        || null;
  }

  // -------------------- 渲染 L1/L2/L3 --------------------
  function renderL1(){
    // 清理并重绘
    track.querySelectorAll('a.link').forEach(x=>x.remove());
    (items||[]).forEach(it=>{
      const a=document.createElement('a');
      a.className = 'link' + (it.path===lockedPath?' active':'');
      a.dataset.path = it.path;
      a.href  = it.path;
      a.textContent = it.title || it.path;
      a.addEventListener('click',(e)=>{
        if(!USE_REAL_NAV) e.preventDefault();
        lockedPath = it.path;
        const l2 = getCurrentL2();
        lockedSubHref = l2 ? l2.path : '';
        const l3 = getCurrentL3();
        lockedTabHref = l3 ? l3.path : '';
        saveState();

        // UI & 内容
        renderL1(); renderSub(); renderTabs(); loadTabContent(lockedTabHref);
        movePillToEl(a);
        hideShellMask(); // 切换时兜底隐藏壳层蒙层
        if(USE_REAL_NAV && lockedSubHref) window.location.href = lockedSubHref;
      });
      track.appendChild(a);
    });
    requestAnimationFrame(()=> movePillToL1Path(lockedPath));
  }

  function renderSub(){
    const l1 = getCurrentL1();
    const subs = (l1?.children||[]).filter(s=>s.visible!==false);
    subInner.innerHTML = subs.map(s=>
      `<a class="sub ${s.path===lockedSubHref?'active':''}" data-href="${s.path}" href="${s.path}">${s.title||s.path}</a>`
    ).join('');

    subInner.querySelectorAll('a.sub').forEach(a=>{
      a.addEventListener('click',(e)=>{
        if(!USE_REAL_NAV) e.preventDefault();
        lockedSubHref = a.dataset.href || '';
        const l3 = getCurrentL3();
        lockedTabHref = l3 ? l3.path : '';
        saveState();

        // 视觉 & 内容
        subInner.querySelectorAll('a.sub').forEach(x=>x.classList.remove('active'));
        a.classList.add('active');
        renderTabs(); loadTabContent(lockedTabHref);
        hideShellMask();
        if(USE_REAL_NAV && lockedSubHref) window.location.href = lockedSubHref;
      });
    });
    updateSubRowMinHeight();
  }

  function renderTabs(){
    const l2 = getCurrentL2();
    const tabs = (l2?.children||[]).filter(t=>t.visible!==false);
    tabsEl.innerHTML = tabs.map(t=>
      `<a class="tab ${t.path===lockedTabHref?'active':''}" data-href="${t.path}" href="${t.path}">
         <span class="tab__text">${t.title||t.path}</span>
       </a>`
    ).join('');
    ensureTabInk();

    tabsEl.querySelectorAll('a.tab').forEach(a=>{
      a.addEventListener('click',(e)=>{
        if(!USE_REAL_NAV) e.preventDefault();
        lockedTabHref = a.dataset.href || '';
        tabsEl.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
        a.classList.add('active');
        saveState();
        positionTabInk(a, true);
        loadTabContent(lockedTabHref);
        hideShellMask();
        if(USE_REAL_NAV && lockedTabHref) window.location.href = lockedTabHref;
      });
    });

    tabCard.classList.remove('no-tabs');
    requestAnimationFrame(()=> positionTabInk(tabsEl.querySelector('.tab.active'), false));
  }

  function updateSubRowMinHeight(){
    const row = document.getElementById('subRow');
    if(!row) return;
    const textH=subInner.getBoundingClientRect().height||0;
    row.style.minHeight=(textH+5)+'px';
  }

  // -------------------- 载入业务内容（iframe 放在页签下面） --------------------
  function loadTabContent(href){
    if(!href){ tabPanel.innerHTML=''; return; }
    tabPanel.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = href;
    iframe.title = '业务模块';
    iframe.setAttribute('frameborder','0');
    iframe.setAttribute('scrolling','auto');
    tabPanel.appendChild(iframe);

    // 高度自适应
    const fit = ()=>{
      const top = tabPanel.getBoundingClientRect().top;
      const h = Math.max(120, Math.floor(window.innerHeight - top - 12));
      iframe.style.height = h + 'px';
    };
    fit();
    window.addEventListener('resize', fit);
    new ResizeObserver(fit).observe(tabPanel);
  }

  // -------------------- 启动 --------------------
  function initAfterNav(){
    restoreState();

    const l1 = items.find(x=>x.path===lockedPath) || items[0] || null;
    if(!l1){ items=[]; renderL1(); return; }
    lockedPath = l1.path;

    const l2 = getCurrentL2();
    lockedSubHref = l2 ? l2.path : '';

    const l3 = getCurrentL3();
    lockedTabHref = l3 ? l3.path : '';

    renderL1(); renderSub(); renderTabs(); loadTabContent(lockedTabHref);
    movePillToL1Path(lockedPath);
    saveState();

    window.addEventListener('resize', ()=>{
      positionTabInk(tabsEl?.querySelector('.tab.active'), false);
    });
  }

  async function bootstrap(){
    if(!USE_REAL_NAV){
      // 演示/本地联调（与演示页结构一致）：可删除
      items = [{
        level:1, title:'物流', path:'/logistics', visible:true, children:[
          { level:2, title:'物流渠道', path:'/logistics/channel', visible:true, default:true, children:[
            { level:3, title:'自定义物流', path:'/logistics/channel/custom', visible:true, default:true }
          ] }
        ]
      }];
      initAfterNav();
      return;
    }
    try{
      const res = await fetch('/api/nav', { headers:{ 'Accept':'application/json' } });
      const data = await res.json();
      items = Array.isArray(data.items) ? data.items : [];
    }catch(e){
      items = [];
    }
    initAfterNav();
  }

  bootstrap();
})();
