/* modules/navauth_shell/frontend/static/nav_shell.js  (V5)
 * 功能总览：
 * 1) L1/L2/L3 导航与页签 Ink（滑动圆角线，与演示一致）
 * 2) “单一灰层 + 仲裁”：
 *    - ChatGPT 风格：仅透明模糊（无任何颜色叠加）
 *    - shell 弹窗：灰层在下，弹窗在上（不被模糊，可交互）
 *    - module 弹窗：仅提升 #tabCard/#tabPanel/iframe 到灰层之上，tabs 仍被灰层冻结
 * 3) 默认 L1→L2→L3：优先 {default:true}，否则取首个 visible
 */

(function(){
  // -------------------- DOM --------------------
  const body     = document.body;
  const USE_REAL_NAV = (body.getAttribute('data-use-real-nav') === 'true');
  const track    = document.getElementById('navTrack');
  const pill     = document.getElementById('pill');
  const subInner = document.getElementById('subInner');
  const tabsEl   = document.getElementById('tabs');
  const tabCard  = document.getElementById('tabCard');
  const tabPanel = document.getElementById('tabPanel');

  // -------------------- 注入样式（Ink + 透明模糊灰层 + 层级契约） --------------------
  (function injectPatchCSS(){
    const OLD_ID = 'navShellPatch';
    document.getElementById(OLD_ID)?.remove();

    // 层级契约：壳层普通UI < 灰层(5000) < 模块卡片提升(6000) < 壳层弹窗(>=7000)
    const Z_SHELL_MASK   = 5000;
    const Z_IFRAME_ELEV  = 6000; // 只在 module 弹窗时临时使用

    const css = `
:root{
  /* 页签 Ink 参数（与演示一致） */
  --tab-text-ml:37px;
  --tab-ink-height:2px; --tab-ink-radius:999px; --tab-ink-color:#000;
  --tab-ink-pad-x:-8px; --tab-ink-ml:6px; --tab-ink-mt:-1px;

  /* 模糊强度：保持淡淡效果 */
  --mask-blur: 8px;
  --mask-saturate: 1.0; /* 不改变色彩饱和度，防止“加色”的观感 */
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

/* 壳层“单一灰层”：仅透明模糊（不叠加任何颜色） */
.shell-mask{
  position:fixed; inset:0; width:100vw; height:100vh;
  background: transparent; /* 不加颜色 */
  -webkit-backdrop-filter: saturate(var(--mask-saturate)) blur(var(--mask-blur));
  backdrop-filter:         saturate(var(--mask-saturate)) blur(var(--mask-blur));
  opacity:0; pointer-events:none; transition:opacity .18s ease;
  z-index:${Z_SHELL_MASK};
}
html.mask-show .shell-mask{ opacity:1; }

/* 仲裁模式：
 * - module：灰层需拦截壳层背景；同时只提升 #tabCard/#tabPanel/iframe 到灰层之上，tabs 仍被冻结
 * - shell ：灰层仅做模糊，不拦截；并强制把常见弹窗置于灰层之上，防止被模糊/遮挡
 */
html.mask-mode--module .shell-mask{ pointer-events:auto; }
html.mask-mode--shell  .shell-mask{ pointer-events:none; }

/* module 弹窗：仅提升卡片与面板（以及 iframe） */
html.mask-mode--module #tabCard,
html.mask-mode--module #tabPanel{
  position: relative; z-index:${Z_IFRAME_ELEV};
}
html.mask-mode--module #tabPanel iframe{
  position: relative; z-index:${Z_IFRAME_ELEV};
}

/* shell 弹窗：通用选择器强制置顶（高于灰层） */
html.mask-mode--shell .modal,
html.mask-mode--shell [role="dialog"][aria-modal="true"],
html.mask-mode--shell dialog[open],
html.mask-mode--shell .ant-modal-wrap,
html.mask-mode--shell .ant-drawer-mask + .ant-drawer,  /* 部分抽屉结构 */
html.mask-mode--shell .ant-modal-root,
html.mask-mode--shell .el-dialog__wrapper,
html.mask-mode--shell .layui-layer,
html.mask-mode--shell .van-overlay + .van-popup{
  position: relative; z-index:${Z_IFRAME_ELEV + 1000} !important;
}
`;
    const style = document.createElement('style');
    style.id = OLD_ID;
    style.textContent = css;
    document.head.appendChild(style);
  })();

  // -------------------- 灰层节点 --------------------
  const shellMask = (function ensureMask(){
    let el = document.getElementById('shellMask');
    if(!el){
      el = document.createElement('div');
      el.id = 'shellMask';
      el.className = 'shell-mask';
      document.body.appendChild(el);
    }
    return el;
  })();

  // -------------------- 仲裁状态 --------------------
  let state = {
    moduleBackdropActive: false, // iframe里是否有弹窗
    shellModalActive:     false  // 壳层是否有弹窗
  };

  function applyMaskState(){
    const doc = document.documentElement;
    const show = state.moduleBackdropActive || state.shellModalActive;
    doc.classList.toggle('mask-show', show);

    // 模式切换
    doc.classList.remove('mask-mode--module','mask-mode--shell');
    if(!show){
      document.documentElement.style.overflow = '';
      return;
    }
    if(state.shellModalActive){
      // 壳层弹窗优先级更高：灰层仅做模糊，且不拦截
      doc.classList.add('mask-mode--shell');
      document.documentElement.style.overflow = 'hidden';
      return;
    }
    // 仅模块弹窗：灰层拦截壳层背景，提升卡片/iframe
    doc.classList.add('mask-mode--module');
    document.documentElement.style.overflow = 'hidden';
  }
  function hideMaskAll(){
    state.moduleBackdropActive = false;
    state.shellModalActive     = false;
    applyMaskState();
  }

  // -------------------- 与 iframe 联动（桥接脚本会 postMessage） --------------------
  window.addEventListener('message', (e)=>{
    const msg = e?.data || {};
    if(msg && msg.type === 'shell-mask'){
      const show   = msg.action === 'show' || msg.visible === true;
      const source = msg.source || 'module';
      if(source === 'module' || source === 'iframe'){
        state.moduleBackdropActive = !!show;
        applyMaskState();
      }
    }
  });

  // -------------------- 监听壳层弹窗（更强选择器覆盖） --------------------
  const SHELL_MODAL_SELECTORS = [
    '.modal',
    'dialog[aria-modal="true"]',
    '[role="dialog"][aria-modal="true"]',
    '.ant-modal-wrap', '.ant-modal-root', '.ant-drawer-mask + .ant-drawer',
    '.el-dialog__wrapper',
    '.layui-layer',
    '.van-overlay + .van-popup'
  ];
  function isVisible(el){
    if(!el || !el.ownerDocument) return false;
    const st = getComputedStyle(el);
    if(st.display==='none' || st.visibility==='hidden' || parseFloat(st.opacity||'1') === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width>0 && r.height>0;
  }
  function anyShellModalVisible(){
    for(const sel of SHELL_MODAL_SELECTORS){
      const list = document.querySelectorAll(sel);
      for(const el of list){ if(isVisible(el)) return true; }
    }
    // 兜底：role=dialog 但未标 aria-modal
    const extra = document.querySelectorAll('[role="dialog"]');
    for(const el of extra){ if(isVisible(el)) return true; }
    return false;
  }
  const moShell = new MutationObserver(()=>{
    const v = anyShellModalVisible();
    if(v !== state.shellModalActive){
      state.shellModalActive = v;
      applyMaskState();
    }
  });
  moShell.observe(document.documentElement, {
    childList:true, subtree:true, attributes:true,
    attributeFilter:['style','class','open','hidden','aria-hidden']
  });
  // 启动时先算一次
  state.shellModalActive = anyShellModalVisible();
  applyMaskState();

  // -------------------- 导航与页签（与演示文件一致） --------------------
  const SCHEMA_VERSION = 5;
  const STORAGE_KEY    = 'NAV_STATE_V5';
  let items = [];
  let lockedPath    = '/';
  let lockedSubHref = '';
  let lockedTabHref = '';

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
      void ink.offsetWidth;
      ink.style.transition = prev || '';
    }else{
      ink.style.width = width + 'px';
      ink.style.transform = `translateX(${left}px)`;
    }
  }
  window.addEventListener('resize', ()=> positionTabInk(tabsEl?.querySelector('.tab.active'), false));

  // 默认项选取
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

  // 渲染 L1/L2/L3
  function renderL1(){
    const trackEl = track;
    trackEl.querySelectorAll('a.link').forEach(x=>x.remove());
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

        renderL1(); renderSub(); renderTabs(); loadTabContent(lockedTabHref);
        movePillToEl(a);
        hideMaskAll(); // 切换兜底收起灰层
        if(USE_REAL_NAV && lockedSubHref) window.location.href = lockedSubHref;
      });
      trackEl.appendChild(a);
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

        subInner.querySelectorAll('a.sub').forEach(x=>x.classList.remove('active'));
        a.classList.add('active');
        renderTabs(); loadTabContent(lockedTabHref);
        hideMaskAll();
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
        hideMaskAll();
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

  // 业务内容：使 iframe 正好出现在页签下面
  function loadTabContent(href){
    if(!href){ tabPanel.innerHTML=''; return; }
    tabPanel.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = href;
    iframe.title = '业务模块';
    iframe.setAttribute('frameborder','0');
    iframe.setAttribute('scrolling','auto');
    tabPanel.appendChild(iframe);

    const fit = ()=>{
      const top = tabPanel.getBoundingClientRect().top;
      const h = Math.max(120, Math.floor(window.innerHeight - top - 12));
      iframe.style.height = h + 'px';
    };
    fit();
    window.addEventListener('resize', fit);
    new ResizeObserver(fit).observe(tabPanel);
  }

  // 启动
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
      // 演示/本地联调
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
