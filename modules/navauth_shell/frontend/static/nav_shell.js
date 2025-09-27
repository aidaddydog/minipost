/* 壳层交互与动效（仅导航壳，不含业务） */
(function(){
  const body = document.body;
  const USE_REAL_NAV = (body.getAttribute('data-use-real-nav') === 'true');

  // DOM 引用
  const track = document.getElementById('navTrack');
  const pill  = document.getElementById('pill');
  const subRow   = document.getElementById('subRow');
  const subInner = document.getElementById('subInner');
  const tabsEl   = document.getElementById('tabs');
  const tabCard  = document.getElementById('tabCard');
  const tabPanel = document.getElementById('tabPanel');

  // === Inline L3 content loader (embed into tabPanel instead of full-page navigation) ===
  function ensureTabFrame(){
    let frame = tabPanel.querySelector('iframe.tabpanel__frame');
    if(!frame){
      frame = document.createElement('iframe');
      frame.className = 'tabpanel__frame';
      frame.setAttribute('frameborder', '0');
      frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      frame.style.width = '100%';
      frame.style.border = '0';
      frame.style.minHeight = 'calc(100vh - 220px)'; // 简易适配，可按需在 CSS 中调整 --tab-frame-offset
      tabPanel.innerHTML = '';
      tabPanel.appendChild(frame);
    }
    return frame;
  }
  function loadTabContent(href){
    if(!href) return;
    const frame = ensureTabFrame();
    if(frame.getAttribute('src') !== href){
      frame.setAttribute('src', href);
    }
  }

  // 状态
  let L1 = []; // [{title, path, children: L2[]}]
  let lockedPath = '';
  let lockedSubHref = '';
  let lockedTabHref = '';
  let hoverPath = '';
  let inSubRow = false;
  let leaveTimer = null;

  // 工具
  const cssVarNum = (name, fallback=0)=>{
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if(!v) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };

  // 胶囊移动
  let _pillRAF = 0, _pillNext = null;
  function movePillToEl(el){
    if(!el) return;
    const left = el.offsetLeft - track.scrollLeft;
    const minw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pill-minw')) || 60;
    const width = Math.max(minw, el.offsetWidth);
    _pillNext = { left, width };
    if (_pillRAF) return;
    _pillRAF = requestAnimationFrame(()=>{
      _pillRAF = 0;
      if(!_pillNext) return;
      pill.style.width = _pillNext.width + 'px';
      pill.style.transform = `translate(${_pillNext.left}px,-50%)`;
      pill.style.opacity = 1;
      _pillNext = null;
    });
  }

  function highlightActive(){
    [...track.querySelectorAll('.link')].forEach(a=>a.classList.toggle('active', a.dataset.path === lockedPath));
  }

  /* 渲染 L1 / L2 / L3 —— 仅使用通用字段：title/path/children/visible/order */
  function renderL1(){
    track.querySelectorAll('a.link').forEach(a=>a.remove());
    const frag = document.createDocumentFragment();
    L1.forEach(item=>{
      if(item.visible === false) return;
      const a = document.createElement('a');
      a.className = 'link';
      a.textContent = item.title || item.path || '';
      a.href = item.path || '#';
      a.dataset.path = item.path || '';
      a.addEventListener('pointerenter',()=>{
        if(inSubRow) return;
        hoverPath = a.dataset.path;
        movePillToEl(a);
        renderSubPreview(hoverPath);
      });
      a.addEventListener('click', (e)=>{
        if(!USE_REAL_NAV) e.preventDefault(); // 壳层静态预览不跳转
        lockedPath = a.dataset.path;
        const firstSub = ((item.children||[]).find(s=>s.visible!==false)) || null;
        lockedSubHref = firstSub ? (firstSub.path||'') : '';
        lockedTabHref = '';
        // 状态落盘
        try{ localStorage.setItem('NAV_STATE_V11', JSON.stringify({v:11, lockedPath, lockedSubHref, lockedTabHref, ts:Date.now()})); }catch(e){}
        hoverPath = lockedPath;
        highlightActive();
        renderSub(lockedPath);
        if(USE_REAL_NAV && lockedSubHref){ window.location.href = lockedSubHref; }
      });
      frag.appendChild(a);
    });
    track.appendChild(frag);

    // 初始定位
    const first = track.querySelector(`.link[data-path="${lockedPath}"]`) || track.querySelector('.link');
    movePillToEl(first);
    highlightActive();
  }

  function findL1(path){ return L1.find(i=>i.path===path); }

  function renderSub(path){
    const l1 = findL1(path);
    const list = (l1 && Array.isArray(l1.children)) ? l1.children.filter(s=>s.visible!==false) : [];
    subInner.innerHTML = list.map(i=>`<a class="sub" data-owner="${path}" href="${i.path||'#'}">${i.title||i.path||''}</a>`).join('');
    updateSubRowMinHeight();

    if(lockedSubHref && list.some(x=>x.path===lockedSubHref)){
      const t = [...subInner.querySelectorAll('.sub')].find(a=>a.getAttribute('href')===lockedSubHref);
      if(t) t.classList.add('active');
    }

    // 渲染 L3 tabs
    const currentSub = list.find(s=>s.path===lockedSubHref);
    const L3 = (currentSub && Array.isArray(currentSub.children)) ? currentSub.children.filter(t=>t.visible!==false) : [];
    renderTabs(L3);
  }

  function renderSubPreview(path){
    const l1 = findL1(path);
    const list = (l1 && Array.isArray(l1.children)) ? l1.children.filter(s=>s.visible!==false) : [];
    subInner.innerHTML = list.map(i=>`<a class="sub" data-owner="${path}" href="${i.path||'#'}">${i.title||i.path||''}</a>`).join('');
  }

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
    const padX = cssVarNum('--tab-ink-pad-x', -8);
    const ml   = cssVarNum('--tab-ink-ml', 6);

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

  function renderTabs(L3){
    if(!L3.length){
      tabsEl.innerHTML = '';
      ensureTabInk();
      tabCard.classList.add('no-tabs');
      tabPanel.textContent = '该二级暂无页签内容。';
      return;
    }
    if(!lockedTabHref || !L3.some(t=>t.path===lockedTabHref)){
      lockedTabHref = (L3[0].path || '');
    }
    tabsEl.innerHTML = L3.map(t =>
      `<a class="tab ${t.path===lockedTabHref?'active':''}" data-key="${t.tabKey||''}" href="${t.path||'#'}"><span class="tab__text">${t.title||t.path||''}</span></a>`
    ).join('');
    ensureTabInk();
    tabCard.classList.remove('no-tabs');
    // 初次或刷新时载入当前激活 tab 的内容
    if(lockedTabHref){ loadTabContent(lockedTabHref); }
    tabPanel.textContent = '此处为业务模块内容占位。';
    requestAnimationFrame(()=>positionTabInk(tabsEl.querySelector('.tab.active'), false));
  }

  function updateSubRowMinHeight(){
    const textH = subInner.getBoundingClientRect().height || 0;
    const extra = cssVarNum('--sub-extra', 5);
    subRow.style.minHeight = (textH + extra) + 'px';
  }

  // 事件绑定
  track.addEventListener('pointerleave', ()=>{
    clearTimeout(leaveTimer);
    const grace = cssVarNum('--sub-grace-ms', 220);
    leaveTimer = setTimeout(()=>{
      if(!inSubRow){
        hoverPath = lockedPath;
        movePillToEl(track.querySelector(`.link[data-path="${lockedPath}"]`) || track.querySelector('.link'));
        renderSub(lockedPath);
      }
    }, grace);
  });
  subRow.addEventListener('pointerenter', ()=>{ inSubRow = true; clearTimeout(leaveTimer); });
  subRow.addEventListener('pointerleave', ()=>{ inSubRow = false; hoverPath = lockedPath; movePillToEl(track.querySelector(`.link[data-path="${lockedPath}"]`) || track.querySelector('.link')); renderSub(lockedPath); });

  subInner.addEventListener('pointerover', (e)=>{
    const s = e.target.closest('a.sub'); if(!s) return;
    const ownerEl = track.querySelector(`.link[data-path="${s.getAttribute('data-owner')}"]`);
    if(ownerEl) movePillToEl(ownerEl);
  });

  subInner.addEventListener('click', (e)=>{
    const a = e.target.closest('a.sub'); if(!a) return;
    if(!USE_REAL_NAV) e.preventDefault();
    lockedPath = a.getAttribute('data-owner') || lockedPath;
    lockedSubHref = a.getAttribute('href') || '';
    lockedTabHref = '';
    try{ localStorage.setItem('NAV_STATE_V11', JSON.stringify({v:11, lockedPath, lockedSubHref, lockedTabHref, ts:Date.now()})); }catch(e){}
    hoverPath = lockedPath; highlightActive();
    subInner.querySelectorAll('.sub').forEach(s=>s.classList.remove('active')); a.classList.add('active');

    // 渲染 L3
    const l1 = findL1(lockedPath);
    const L3 = ((l1?.children||[]).find(s=>s.path===lockedSubHref)?.children||[]).filter(t=>t.visible!==false);
    renderTabs(L3);

    if(lockedSubHref){ const l1 = findL1(lockedPath); const L3 = ((l1?.children||[]).find(s=>s.path===lockedSubHref)?.children||[]).filter(t=>t.visible!==false); const first = (L3[0] && L3[0].path) || ''; if(first) loadTabContent(first); }
  });

  tabsEl.addEventListener('click', (e)=>{
    const t = e.target.closest('a.tab'); if(!t) return;
    if(!USE_REAL_NAV) e.preventDefault();
    tabsEl.querySelectorAll('.tab').forEach(a=>a.classList.remove('active'));
    t.classList.add('active');
    lockedTabHref = t.getAttribute('href') || '';
    try{ localStorage.setItem('NAV_STATE_V11', JSON.stringify({v:11, lockedPath, lockedSubHref, lockedTabHref, ts:Date.now()})); }catch(e){}
    positionTabInk(t, true);
    tabCard.classList.remove('no-tabs');
    // 初次或刷新时载入当前激活 tab 的内容
    if(lockedTabHref){ loadTabContent(lockedTabHref); }
    tabPanel.textContent = '此处为业务模块内容占位。';
    if(lockedTabHref) loadTabContent(lockedTabHref);
  });

  window.addEventListener('resize', ()=>{ positionTabInk(tabsEl.querySelector('.tab.active'), false); });
  track.addEventListener('scroll', ()=>{ movePillToEl(track.querySelector(`.link[data-path="${hoverPath||lockedPath}"]`) || track.querySelector('.link')); });

  // 加载导航（聚合器 or 空壳）
  async function loadNav(){
    // 读本地状态（兼容迁移）
    try{
      let raw = localStorage.getItem('NAV_STATE_V11') || localStorage.getItem('NAV_STATE_V10');
      if(raw){
        const obj = JSON.parse(raw);
        if(obj && obj.lockedPath){ lockedPath = obj.lockedPath; lockedSubHref = obj.lockedSubHref || ''; lockedTabHref = obj.lockedTabHref || ''; }
      }
    }catch(e){}

    if(USE_REAL_NAV){
      try{
        const res = await fetch('/api/nav', { credentials: 'same-origin' });
        const json = await res.json();
        // 兼容多种返回结构：{data: [...] } 或直接 [...]
        const items = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : (Array.isArray(json?.items) ? json.items : []));
        // 仅取 level==1
        L1 = items.filter(it => (it && (it.level === 1 || it.level === '1') && it.visible !== false))
                  .sort((a,b)=> (a.order||0) - (b.order||0));
      }catch(e){
        // 聚合失败则空壳
        L1 = [];
      }
    }else{
      // 空壳：不挂任何业务 L2/L3（符合本轮范围）
      L1 = [{ title: '首页', path: '/admin', visible: true, order: 1, children: [] }];
    }

    // 默认锁定
    if(!lockedPath){ lockedPath = L1[0]?.path || '/admin'; }
    hoverPath = lockedPath;

    renderL1();
    renderSub(lockedPath);
  }

  loadNav();
})();
