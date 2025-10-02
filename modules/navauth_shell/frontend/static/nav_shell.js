/* modules/navauth_shell/frontend/static/nav_shell.js  (V6)
 * 功能总览：
 * 1) L1/L2/L3 导航与页签 Ink（滑动圆角线，与演示一致）
 * 2) “单一灰层 + 仲裁”：
 *    - 仅透明模糊（无颜色）
 *    - shell 弹窗：灰层在下，弹窗在上（不被模糊，可交互）
 *    - module 弹窗：仅提升 #tabCard/#tabPanel/iframe 到灰层之上，tabs 仍被冻结
 * 3) 默认 L1→L2→L3：优先 {default:true}，否则取首个 visible
 * 4) 修复：iframe 默认 300px 导致页签下内容变窄 —— 显式 width:100%
 */

(function(){
  // -------------------- DOM --------------------
  const body     = document.body;
  const USE_REAL_NAV = (body.getAttribute('data-use-real-nav') === 'true'); // 数据来源：true=后端导航
  const ALLOW_ROUTE_NAV = false; // [CHG] 点击仅激活/切换，不弹外链（统一禁止真实跳转）
  const track    = document.getElementById('navTrack');
  const pill     = document.getElementById('pill');
  const subInner = document.getElementById('subInner');
  const tabsEl   = document.getElementById('tabs');
  const tabCard  = document.getElementById('tabCard');
  const tabPanel = document.getElementById('tabPanel');
  const subRow  = document.getElementById('subRow');

  // -------------------- 注入样式（Ink + 透明模糊灰层 + 层级契约 + iframe 宽度修复） --------------------
  (function injectPatchCSS(){
    const OLD_ID = 'navShellPatch';
    document.getElementById(OLD_ID)?.remove();

    // 层级契约：壳层普通UI < 灰层(5000) < 模块卡片提升(6000) < 壳层弹窗(>=7000)
    const Z_SHELL_MASK   = 5000;
    const Z_IFRAME_ELEV  = 6000; // 仅在 module 弹窗时使用

    const css = `
:root{
  /* 页签 Ink 参数（与演示一致） */
  --tab-text-ml:37px;
  --tab-ink-height:2px; --tab-ink-radius:999px; --tab-ink-color:#000;
  --tab-ink-pad-x:-8px; --tab-ink-ml:6px; --tab-ink-mt:-1px;

  /* 模糊强度：淡淡效果（无颜色） */
  --mask-blur: 8px;
  --mask-saturate: 1.0;
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

/* 🚑 修复：iframe 默认 300px 导致内容“变窄” —— 显式拉满到容器宽度 */
.tabrow .tab-wrap{ min-width:0; } /* 防止 flex 子项因 min-width:auto 产生意外挤压 */
.tabrow .tab-wrap .tabcard .tabpanel iframe{
  width:100%; display:block; border:0; background:transparent;
}

/* 壳层“单一灰层”：仅透明模糊（不叠加任何颜色） */
.shell-mask{
  position:fixed; inset:0; width:100vw; height:100vh;
  background: transparent;
  -webkit-backdrop-filter: saturate(var(--mask-saturate)) blur(var(--mask-blur));
  backdrop-filter:         saturate(var(--mask-saturate)) blur(var(--mask-blur));
  opacity:0; pointer-events:none; transition:opacity .18s ease;
  z-index:${Z_SHELL_MASK};
}
html.mask-show .shell-mask{ opacity:1; }

/* 仲裁模式：
 * - module：灰层需拦截壳层背景；并仅提升 #tabCard/#tabPanel/iframe 到灰层之上
 * - shell ：灰层仅做模糊，不拦截；壳层弹窗强制置顶
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
html.mask-mode--shell .ant-drawer-mask + .ant-drawer,
html.mask-mode--shell .ant-modal-root,
html.mask-mode--shell .el-dialog__wrapper,
html.mask-mode--shell .layui-layer,
html.mask-mode--shell .van-overlay + .van-popup{
  position: relative; z-index:${Z_IFRAME_ELEV + 1000} !important;
}

/* ===== 壳层统一弹窗（屏幕级） ===== */
.shell-modal{ position:fixed; inset:0; display:none; align-items:center; justify-content:center; z-index:${Z_IFRAME_ELEV + 1000}; }
.shell-modal[aria-hidden="false"]{ display:flex; }
.shell-modal__backdrop{ position:absolute; inset:0; background:rgba(0,0,0,.28); }
.shell-modal__dialog{
  position:relative; background:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.2);
  width: min(920px, 92vw); max-height: 90vh; display:flex; flex-direction:column; overflow:hidden;
}
.shell-modal.is-sm .shell-modal__dialog{ width:min(560px,92vw); }
.shell-modal.is-lg .shell-modal__dialog{ width:min(1200px,96vw); }
.shell-modal.is-full .shell-modal__dialog{ width:96vw; height:94vh; }
.shell-modal__header{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(0,0,0,.06); }
.shell-modal__title{ font-size:16px; margin:0; }
.shell-modal__close{ border:0; background:transparent; font-size:20px; line-height:1; cursor:pointer; }
.shell-modal__body{ position:relative; padding:0; }
.shell-modal__body iframe{ display:block; width:100%; border:0; background:transparent; min-height:50vh; }
`;
    const style = document.createElement('style');
    style.id = OLD_ID;
    style.textContent = css;
    document.head.appendChild(style);
  })();

  // -------------------- 壳层灰层节点 --------------------
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

  
  // -------------------- 壳层统一弹窗（屏幕级，支持 iframe 承载） --------------------
  const shellModal = (function(){
    let root=null, titleEl=null, iframe=null;

    function ensure(){
      if(root) return;
      root = document.getElementById('shellModalRoot');
      if(!root){
        root = document.createElement('div');
        root.id = 'shellModalRoot';
        root.className = 'shell-modal modal';
        root.setAttribute('role','dialog');
        root.setAttribute('aria-modal','true');
        root.setAttribute('aria-hidden','true');
        root.innerHTML = `
          <div class="shell-modal__backdrop" data-close="1" aria-hidden="true"></div>
          <div class="shell-modal__dialog" role="document">
            <div class="shell-modal__header">
              <h3 id="shellModalTitle" class="shell-modal__title">—</h3>
              <button class="shell-modal__close" title="关闭" aria-label="关闭" data-close="1">×</button>
            </div>
            <div class="shell-modal__body">
              <iframe id="shellModalIframe" title="模块弹窗"></iframe>
            </div>
          </div>`;
        document.body.appendChild(root);
      }
      titleEl = root.querySelector('#shellModalTitle');
      iframe  = root.querySelector('#shellModalIframe');
      root.addEventListener('click', (e)=>{ if(e.target?.dataset?.close==='1'){ api.close(); } });
    }

    function setSize(size){
      root.classList.remove('is-sm','is-md','is-lg','is-full');
      const s = (size||'md').toLowerCase();
      root.classList.add('is-' + (['sm','md','lg','full'].includes(s)?s:'md'));
    }

    const api = {
      open({ title='弹窗', url='', size='md', onCloseEmit=null }={}){
        ensure();
        setSize(size);
        titleEl.textContent = title || '弹窗';
        iframe.src = url || 'about:blank';
        root.setAttribute('aria-hidden','false');
        // 进入 shell 模式（灰层仅做模糊，不拦截）
        state.shellModalActive = true;
        applyMaskState();
        // 关闭时要回发给业务 iframe 的事件名
        root.dataset.onCloseEmit = onCloseEmit || '';
      },
      update({ title, size }={}){
        ensure();
        if(typeof title==='string'){ titleEl.textContent = title; }
        if(size){ setSize(size); }
      },
      close(payload=null){
        ensure();
        try{
          const emit = root.dataset.onCloseEmit || '';
          const panelIF = document.querySelector('#tabPanel iframe');
          if(panelIF && panelIF.contentWindow){
            const msg = { type: emit || 'shell-modal-closed', payload };
            panelIF.contentWindow.postMessage(msg, '*');
          }
        }catch(e){ /* ignore */ }
        iframe.src = 'about:blank';
        root.setAttribute('aria-hidden','true');
        state.shellModalActive = false;
        applyMaskState();
      },
      forwardResult(data){
        try{
          const panelIF = document.querySelector('#tabPanel iframe');
          if(panelIF && panelIF.contentWindow){
            panelIF.contentWindow.postMessage({ type:'shell-modal-result', ...data }, '*');
          }
        }catch(e){ /* ignore */ }
      }
    };
    return api;
  })()
window.shellModal = window.shellModal || shellModal;
;
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
  // Hook: 记录 moduleBackdropActive 时间戳并启动 watchdog
  (function(){
    let watchdogTimer = 0; let tsShow = 0;
    function startWatch(){
      if(watchdogTimer) return;
      watchdogTimer = setInterval(()=>{
        try{
          const ifr = document.querySelector('#tabPanel iframe');
          if(!ifr || !ifr.contentDocument){ return; }
          const doc = ifr.contentDocument;
                                const selectors = [
            '.modal.open',
            '.modal[aria-modal="true"]:not([aria-hidden="true"])',
            'dialog[open]',
            '[role="dialog"][aria-modal="true"]:not([aria-hidden="true"])',
            '.ant-modal-wrap','.ant-modal-root','.el-overlay',
            '.layui-layer','.layui-layer-shade',
            '.van-overlay','.van-overlay + .van-popup',
            '#moduleBlurMask','.module-blur-mask'
          ].join(',');
          let anyVisible = false;
          doc.querySelectorAll(selectors).forEach(el=>{
            const st = ifr.contentWindow.getComputedStyle(el);
            const r = el.getBoundingClientRect();
            if(st && st.display!=='none' && st.visibility!=='hidden' && parseFloat(st.opacity||'1')>0 && r.width>0 && r.height>0){
              anyVisible = true;
            }
          });
          if(state.moduleBackdropActive){
            if(!tsShow) tsShow = Date.now();
            if(!anyVisible && (Date.now() - tsShow > 5000)){
              console.warn('[nav_shell] auto-cleared stuck mask (no overlay found in iframe).');
              state.moduleBackdropActive = false;
              applyMaskState();
              tsShow = 0;
            }
          }else{
            tsShow = 0;
          }
        }catch(e){ /* ignore cross-origin */ }
      }, 1000);
    }
    // 在收到 module 的 show 时开启监控；在 hide 或 shell 模态时会自然关闭
    window.addEventListener('message', (e)=>{
      const msg = e?.data || {};
      if(msg && msg.type==='shell-mask'){
        const show = msg.action==='show' || msg.visible===true;
        const source = msg.source || 'module';
        if(source==='module' || source==='iframe'){
          if(show){ startWatch(); }
        }
      }
    });
  })();


  // -------------------- 监听壳层弹窗 --------------------
  const SHELL_MODAL_SELECTORS = [
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
  state.shellModalActive = anyShellModalVisible();
  applyMaskState();

  // -------------------- 导航与页签（与演示文件一致） --------------------
  const SCHEMA_VERSION = 6;
  const STORAGE_KEY    = 'NAV_STATE_V6';
  let items = [];
  let lockedPath    = '/';
  let lockedSubHref = '';
  let lockedTabHref = '';

  // 预览状态与宽容窗
  let hoverPath = '/';
  let inSubRow = false;
  let leaveTimer = null;

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

  function getGraceMs(){ return Math.max(0, cssVarNum('--sub-grace-ms', 220)); }
  function currentVisualPath(){ return inSubRow ? hoverPath : (hoverPath || lockedPath); }

  // L1 胶囊位移
  let _pillRAF=0, _pillNext=null;
  function movePillToEl(el, opts={ instant:false }){
    if(!el) return;
    const left = el.offsetLeft - track.scrollLeft;
    const minw = cssVarNum('--pill-minw', 60);
    const width= Math.max(minw, el.offsetWidth);
    if(opts.instant){
      const prev = pill.style.transition;
      pill.style.transition = 'none';
      pill.style.width = width + 'px';
      pill.style.transform = `translate(${left}px,-50%)`;
      pill.style.opacity = 1;
      void pill.offsetWidth;
      pill.style.transition = prev || '';
      return;
    }
    _pillNext = { left, width };
    if(_pillRAF) return;
    _pillRAF = requestAnimationFrame(()=>{
      _pillRAF = 0;
      if(!_pillNext) return;
      pill.style.width = _pillNext.width + 'px';
      pill.style.transform = `translate(${_pillNext.left}px,-50%)`;
      pill.style.opacity = 1;
      _pillNext=null;
    });
  }
  track && track.addEventListener('scroll', ()=> movePillToL1Path(currentVisualPath()));
  function movePillToL1Path(path, opts={}){
    const a = [...track.querySelectorAll('a.link')].find(x=>x.dataset.path===path);
    movePillToEl(a, opts);
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

  // Hover 预览交互：一级离开 + 二级进入/离开 + 二级悬浮归属指示
  track && track.addEventListener('pointerleave', ()=>{
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(()=>{
      if(!inSubRow){
        hoverPath = lockedPath;
        movePillToL1Path(lockedPath); // 动画滑回
        renderSub();
      }
    }, getGraceMs());
  });
  subRow && subRow.addEventListener('pointerenter', ()=>{ inSubRow = true; clearTimeout(leaveTimer); });
  subRow && subRow.addEventListener('pointerleave', ()=>{
    inSubRow = false;
    hoverPath = lockedPath;
    movePillToL1Path(lockedPath); // [CHG] 动画滑回（去掉 {instant:true} 的“瞬移”）
    renderSub();
  });
  subInner && subInner.addEventListener('pointerover', (e)=>{
    const s = e.target.closest('a.sub'); if(!s) return;
    const owner = s.getAttribute('data-owner');
    const ownerEl = owner ? [...track.querySelectorAll('a.link')].find(a=>a.dataset.path===owner) : null;
    if(ownerEl) movePillToEl(ownerEl);
  });

  // 默认项选取（支持 YAML/后端 nav 的 default:true）
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
    track.querySelectorAll('a.link').forEach(x=>x.remove());
    (items||[]).forEach(it=>{
      const a=document.createElement('a');
      a.className = 'link' + (it.path===lockedPath?' active':'');
      a.dataset.path = it.path;
      a.href  = it.path;
      a.textContent = it.title || it.path;
      a.addEventListener('pointerenter', ()=>{ if(inSubRow) return; hoverPath = it.path; movePillToEl(a); renderSub(hoverPath, {preview:true}); });
      a.addEventListener('click',(e)=>{
        if(!ALLOW_ROUTE_NAV) e.preventDefault(); // [CHG] 仅激活/切换
        lockedPath = it.path;
        const l2 = getCurrentL2();
        lockedSubHref = l2 ? l2.path : '';
        const l3 = getCurrentL3();
        lockedTabHref = l3 ? l3.path : '';
        saveState();

        renderL1(); renderSub(); renderTabs(); loadTabContent(lockedTabHref);
        movePillToEl(a);
        hideMaskAll(); // 切换兜底收起灰层
        if(ALLOW_ROUTE_NAV && lockedSubHref) window.location.href = lockedSubHref; // [CHG]
      });
      track.appendChild(a);
    });
    requestAnimationFrame(()=> movePillToL1Path(lockedPath));
  }

  function renderSub(ownerPath=null, opts={preview:false}){
    const l1 = ownerPath ? (items||[]).find(x=>x.path===ownerPath) : getCurrentL1();
    const subs = (l1?.children||[]).filter(s=>s.visible!==false);
    subInner.innerHTML = subs.map(s=>
      `<a class="sub ${(!opts.preview && s.path===lockedSubHref)?'active':''}" data-owner="${l1?.path||''}" data-href="${s.path}" href="${s.path}">${s.title||s.path}</a>`
    ).join('');

    subInner.querySelectorAll('a.sub').forEach(a=>{
      // 保持原有 hover 行为
      a.addEventListener('pointerenter', ()=>{/* no-op 预览在 L1 侧处理 */});
      a.addEventListener('click',(e)=>{
        if(!ALLOW_ROUTE_NAV) e.preventDefault(); // [CHG]
        const owner = a.getAttribute('data-owner') || (l1?.path || lockedPath);
        lockedPath = owner;
        lockedSubHref = a.dataset.href || '';
        const l3 = getCurrentL3();
        lockedTabHref = l3 ? l3.path : '';
        saveState();

        subInner.querySelectorAll('a.sub').forEach(x=>x.classList.remove('active'));
        a.classList.add('active');
        renderL1(); renderSub(); renderTabs(); loadTabContent(lockedTabHref);
        hideMaskAll();
        if(ALLOW_ROUTE_NAV && lockedSubHref) window.location.href = lockedSubHref; // [CHG]
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
      a.addEventListener('pointerenter', ()=>{/* Ink 仅点击时动画 */});
      a.addEventListener('click',(e)=>{
        if(!ALLOW_ROUTE_NAV) e.preventDefault(); // [CHG]
        lockedTabHref = a.dataset.href || '';
        tabsEl.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
        a.classList.add('active');
        saveState();
        positionTabInk(a, true);
        loadTabContent(lockedTabHref);
        hideMaskAll();
        if(ALLOW_ROUTE_NAV && lockedTabHref) window.location.href = lockedTabHref; // [CHG]
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

  // 业务内容：iframe 出现在页签下面，并自适应视窗高度
  function loadTabContent(href){
    if(!href){ tabPanel.innerHTML=''; return; }
    tabPanel.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = href;
    iframe.title = '业务模块';
    iframe.setAttribute('frameborder','0');
    iframe.setAttribute('scrolling','auto');
    // 宽度依赖上方 CSS：.tabpanel iframe{ width:100%; display:block; }
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
    hoverPath = lockedPath;

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


  // 来自模块/弹窗的指令（统一弹窗协议）
  window.addEventListener('message', (e)=>{
    const msg = e?.data || {};
    if(!msg || typeof msg!=='object') return;

    if(msg.type === 'open-shell-modal'){
      const p = msg.payload || {};
      window.shellModal.open({ title:p.title, url:p.url, size:p.size||'md', onCloseEmit: p.onClose?.emit || '' });
      return;
    }
    if(msg.type === 'update-shell-modal'){
      window.shellModal.update(msg.payload||{});
      return;
    }
    if(msg.type === 'close-shell-modal'){
      window.shellModal.close(msg.payload||null);
      return;
    }
    if(msg.type === 'shell-modal-result'){
      window.shellModal.forwardResult({ scope: msg.scope, action: msg.action, data: msg.data||{} });
      return;
    }
  });

/* === nav_shell.js 末尾安全垫：全局 shellModal & 兼容旧用法 === */
(function(){
  function ensureShellModal(){
    // 若页面已有壳层弹窗实现，直接复用
    if (window.shellModal && typeof window.window.shellModal.open === 'function') return window.shellModal;

    // 动态创建容器（如 nav_shell.html 已有 #shellModalRoot 会直接复用）
    let root = document.getElementById('shellModalRoot');
    if(!root){
      root = document.createElement('div');
      root.id = 'shellModalRoot';
      root.className = 'shell-modal';
      root.setAttribute('role','dialog');
      root.setAttribute('aria-modal','true');
      root.setAttribute('aria-hidden','true');
      root.innerHTML = `
        <div class="shell-modal__backdrop" data-close="1" aria-hidden="true"></div>
        <div class="shell-modal__dialog" role="document">
          <div class="shell-modal__header">
            <h3 id="shellModalTitle" class="shell-modal__title">—</h3>
            <button class="shell-modal__close" title="关闭" aria-label="关闭" data-close="1">×</button>
          </div>
          <div class="shell-modal__body">
            <iframe id="shellModalIframe" title="模块弹窗"></iframe>
          </div>
        </div>`;
      document.body.appendChild(root);
      // 兜底样式（若主样式已注入，这段不会影响）
      const style = document.createElement('style');
      style.textContent = `
        .shell-modal{ position:fixed; inset:0; display:none; align-items:center; justify-content:center; z-index: 7001; }
        .shell-modal[aria-hidden="false"]{ display:flex; }
        .shell-modal__backdrop{ position:absolute; inset:0; background:rgba(0,0,0,.28); }
        .shell-modal__dialog{ position:relative; background:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.2);
          width:min(920px,92vw); max-height:90vh; display:flex; flex-direction:column; overflow:hidden; }
        .shell-modal__header{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(0,0,0,.06); }
        .shell-modal__title{ font-size:16px; margin:0; }
        .shell-modal__close{ border:0; background:transparent; font-size:20px; line-height:1; cursor:pointer; }
        .shell-modal__body{ position:relative; padding:0; }
        .shell-modal__body iframe{ display:block; width:100%; border:0; background:transparent; min-height:60vh; }
      `;
      document.head.appendChild(style);
      root.addEventListener('click', (e)=>{ if(e.target?.dataset?.close==='1'){ api.close(); } });
    }
    const titleEl = root.querySelector('#shellModalTitle');
    const iframe  = root.querySelector('#shellModalIframe');

    function setSize(size){
      root.classList.remove('is-sm','is-md','is-lg','is-full');
      const s = (size||'md').toLowerCase();
      root.classList.add('is-' + (['sm','md','lg','full'].includes(s)?s:'md'));
    }

    const api = {
      open({ title='弹窗', url='', size='md', onCloseEmit=null }={}){
        setSize(size);
        if(titleEl) titleEl.textContent = title || '弹窗';
        if(iframe)  iframe.src = url || 'about:blank';
        root.setAttribute('aria-hidden','false');
        // 与壳层灰层联动（若存在）
        try{ if(window.state){ window.state.shellModalActive = true; } if(typeof window.applyMaskState==='function'){ window.applyMaskState(); } }catch(_){}
        root.dataset.onCloseEmit = onCloseEmit || '';
      },
      update({ title, size }={}){
        if(typeof title==='string' && titleEl) titleEl.textContent = title;
        if(size){ setSize(size); }
      },
      close(payload=null){
        try{
          const emit = root.dataset.onCloseEmit || '';
          const panelIF = document.querySelector('#tabPanel iframe');
          if(panelIF && panelIF.contentWindow){
            const msg = { type: emit || 'shell-modal-closed', payload };
            panelIF.contentWindow.postMessage(msg, '*');
          }
        }catch(_){}
        if(iframe) iframe.src = 'about:blank';
        root.setAttribute('aria-hidden','true');
        try{ if(window.state){ window.state.shellModalActive = false; } if(typeof window.applyMaskState==='function'){ window.applyMaskState(); } }catch(_){}
      },
      forwardResult(data){
        try{
          const panelIF = document.querySelector('#tabPanel iframe');
          if(panelIF && panelIF.contentWindow){
            panelIF.contentWindow.postMessage({ type:'shell-modal-result', ...data }, '*');
          }
        }catch(_){}
      }
    };
    return api;
  }

  // 确保全局对象存在
  window.shellModal = window.shellModal || ensureShellModal();
  // 兼容旧监听里直接用 `shellModal.*` 的写法（避免 ReferenceError）
  if (typeof shellModal === 'undefined' && window.shellModal) {
    try{ var shellModal = window.shellModal; }catch(_){}
  }
})();
/* === nav_shell.js 末尾“强力弹窗补丁”（覆盖原安全垫） === */
(function(){
  // 1) 始终注入高优先级样式（不依赖是否新建 root）
  function ensureModalCSS(){
    var id = 'shellModalStyleForce';
    var st = document.getElementById(id);
    if(st) return;
    st = document.createElement('style');
    st.id = id;
    st.textContent = [
      // 在 shell 模式下，强制把壳层弹窗压到最上（高于任意 7000 !important）
      'html.mask-mode--shell #shellModalRoot,',
      'html.mask-mode--shell .shell-modal{ z-index:9999 !important; }',

      // 基础外层容器
      '.shell-modal{ position:fixed; inset:0; display:none !important; align-items:center; justify-content:center; }',
      '.shell-modal[aria-hidden="false"]{ display:flex !important; }',

      // 遮罩、对话框、标题、关闭
      '.shell-modal__backdrop{ position:absolute; inset:0; background:rgba(0,0,0,.28); }',
      '.shell-modal__dialog{ position:relative; background:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.2);',
      '  width:min(920px,92vw); max-height:90vh; display:flex; flex-direction:column; overflow:hidden; }',
      '.shell-modal__header{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(0,0,0,.06); }',
      '.shell-modal__title{ font-size:16px; margin:0; }',
      '.shell-modal__close{ border:0; background:transparent; font-size:20px; line-height:1; cursor:pointer; }',
      '.shell-modal__body{ position:relative; padding:0; }',
      '.shell-modal__body iframe{ display:block; width:100%; border:0; background:transparent; min-height:60vh; }',

      // 尺寸（可选）
      '.shell-modal.is-sm .shell-modal__dialog{ width:min(520px,92vw); }',
      '.shell-modal.is-lg .shell-modal__dialog{ width:min(1080px,94vw); }',
      '.shell-modal.is-full .shell-modal__dialog{ width:96vw; height:92vh; }'
    ].join('\n');
    document.head.appendChild(st);
  }

  // 2) 确保 root 存在（若 nav_shell.html 里已有，则复用）
  function ensureModalRoot(){
    var root = document.getElementById('shellModalRoot');
    if(!root){
      root = document.createElement('div');
      // 注意：保留 .modal 以兼容旧选择器，但我们有更高优先级的 .shell-modal 规则覆盖它
      root.id = 'shellModalRoot';
      root.className = 'shell-modal modal';
      root.setAttribute('role','dialog');
      root.setAttribute('aria-modal','true');
      root.setAttribute('aria-hidden','true');
      root.innerHTML =
        '<div class="shell-modal__backdrop" data-close="1" aria-hidden="true"></div>'+
        '<div class="shell-modal__dialog" role="document">'+
        '  <div class="shell-modal__header">'+
        '    <h3 id="shellModalTitle" class="shell-modal__title">—</h3>'+
        '    <button class="shell-modal__close" title="关闭" aria-label="关闭" data-close="1">×</button>'+
        '  </div>'+
        '  <div class="shell-modal__body"><iframe id="shellModalIframe" title="模块弹窗"></iframe></div>'+
        '</div>';
      document.body.appendChild(root);
    }
    ensureModalCSS();

    // 一次性绑定关闭
    if(!root.__boundClose){
      root.__boundClose = true;
      root.addEventListener('click', function(e){
        var t = e.target;
        if(t && t.getAttribute && t.getAttribute('data-close') === '1'){
          api.close();
        }
      });
    }
    return root;
  }

  // 3) 弹窗 API（全局）
  var api = {
    open: function(cfg){
      cfg = cfg || {};
      var root = ensureModalRoot();
      var titleEl = root.querySelector('#shellModalTitle');
      var iframe  = root.querySelector('#shellModalIframe');
      // 尺寸
      root.classList.remove('is-sm','is-md','is-lg','is-full');
      var size = (cfg.size || 'md').toLowerCase();
      root.classList.add('is-' + (['sm','md','lg','full'].indexOf(size) >= 0 ? size : 'md'));
      // 标题 & iframe
      if(titleEl) titleEl.textContent = cfg.title || '弹窗';
      if(iframe)  iframe.src = cfg.url || 'about:blank';
      // 显示
      root.style.zIndex = '9999'; // 兜底（真正生效的是上面的 !important 规则）
      root.setAttribute('aria-hidden','false');

      // 灰层联动（若壳层已有这两个函数/状态，将其置为 shell 模式）
      try{
        if(window.state) window.state.shellModalActive = true;
        if(typeof window.applyMaskState === 'function') window.applyMaskState();
        document.documentElement.classList.add('mask-mode--shell','mask-show');
      }catch(e){}
      // 关闭回传事件名
      root.dataset.onCloseEmit = (cfg.onClose && cfg.onClose.emit) ? String(cfg.onClose.emit) : '';
    },

    update: function(cfg){
      cfg = cfg || {};
      var root    = document.getElementById('shellModalRoot'); if(!root) return;
      var titleEl = root.querySelector('#shellModalTitle');
      if(typeof cfg.title === 'string' && titleEl){ titleEl.textContent = cfg.title; }
      if(cfg.size){
        root.classList.remove('is-sm','is-md','is-lg','is-full');
        var s = String(cfg.size).toLowerCase();
        root.classList.add('is-' + (['sm','md','lg','full'].indexOf(s) >= 0 ? s : 'md'));
      }
    },

    close: function(payload){
      var root   = document.getElementById('shellModalRoot'); if(!root) return;
      var iframe = root.querySelector('#shellModalIframe');
      // 回传给业务 iframe
      try{
        var emit = root.dataset.onCloseEmit || '';
        var panelIF = document.querySelector('#tabPanel iframe');
        if(panelIF && panelIF.contentWindow){
          panelIF.contentWindow.postMessage({ type: emit || 'shell-modal-closed', payload: payload || null }, '*');
        }
      }catch(e){}
      // 隐藏
      if(iframe) iframe.src = 'about:blank';
      root.setAttribute('aria-hidden','true');
      try{
        if(window.state) window.state.shellModalActive = false;
        if(typeof window.applyMaskState === 'function') window.applyMaskState();
      }catch(e){}
    },

    forwardResult: function(data){
      try{
        var panelIF = document.querySelector('#tabPanel iframe');
        if(panelIF && panelIF.contentWindow){
          panelIF.contentWindow.postMessage({ type:'shell-modal-result', scope:data && data.scope, action:data && data.action, data:data && data.data }, '*');
        }
      }catch(e){}
    }
  };

  // 4) 总是导出到全局
  window.shellModal = window.shellModal || api;

  // 5) 附加一个健壮的消息监听（不替换现有监听，防止上游失效）
  window.addEventListener('message', function(e){
    var msg = (e && e.data) || {};
    if(!msg || typeof msg !== 'object') return;

    try{
      if(msg.type === 'open-shell-modal'){
        var p = msg.payload || {};
        window.shellModal.open({ title:p.title, url:p.url, size:p.size||'md', onCloseEmit: p.onClose && p.onClose.emit });
        return;
      }
      if(msg.type === 'update-shell-modal'){
        window.shellModal.update(msg.payload || {});
        return;
      }
      if(msg.type === 'close-shell-modal'){
        window.shellModal.close(msg.payload || null);
        return;
      }
      if(msg.type === 'shell-modal-result'){
        window.shellModal.forwardResult({ scope: msg.scope, action: msg.action, data: msg.data || {} });
        return;
      }
    }catch(err){
      // 不让外层抛出中断
      console.error('[shellModal listener error]', err);
    }
  }, true); // capture: true，尽早兜底
})();
