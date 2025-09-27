
/* 壳层交互与动效（导航壳 + L3 内嵌渲染） */
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

  // L3 容器（列表/记录/底栏）
  const tableWrap     = document.getElementById('tableWrap');
  const tbodyEl       = document.getElementById('luTbody');
  const logsTableWrap = document.getElementById('logsTableWrap');
  const logsTbody     = document.getElementById('logsTbody');
  const footerBar     = document.getElementById('footerBar');

  // 页脚控件
  const pageSizeSel=document.getElementById('pageSize'), pageInfo=document.getElementById('pageInfo'), pageNums=document.getElementById('pageNums');
  const firstPage=document.getElementById('firstPage'), prevPage=document.getElementById('prevPage'), nextPage=document.getElementById('nextPage'), lastPage=document.getElementById('lastPage');
  const jumpTo=document.getElementById('jumpTo');
  const goTop=document.getElementById('goTop');
  const selAll=document.getElementById('selAll'), selInvert=document.getElementById('selInvert');
  const selCounter=document.getElementById('selCounter');

  // 状态
  let L1 = []; // [{title, path, children: L2[{title, path, children: L3[] }]}]
  let lockedPath = '';
  let lockedSubHref = '';
  let lockedTabHref = '';
  let hoverPath = '';
  let inSubRow = false;
  let leaveTimer = null;

  // ========== 基础工具 ==========
  const _escMap = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' };
  const h = (s)=>String(s==null?'':s).replace(/[&<>"']/g, m=>_escMap[m]);
  function cssVarNum(name, fallback=0){ const v=getComputedStyle(document.documentElement).getPropertyValue(name).trim(); if(!v) return fallback; const n=parseFloat(v); return Number.isFinite(n)?n:fallback; }

  // === 胶囊位移 ===
  let _pillRAF = 0, _pillNext = null;
  function movePillToEl(el){
    if(!el) return;
    const left = el.offsetLeft - track.scrollLeft;
    const minw=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pill-minw'))||60;
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

  // === Tab 下划线 ===
  function ensureTabInk(){
    let ink=document.getElementById('tabInk');
    if(!ink){
      ink=document.createElement('span'); ink.id='tabInk'; ink.className='tab-ink'; tabsEl.appendChild(ink);
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
      const prev = ink.style.transition; ink.style.transition='none';
      ink.style.width=width+'px'; ink.style.transform=`translateX(${left}px)`;
      void ink.offsetWidth; ink.style.transition = prev || '';
    }else{
      ink.style.width=width+'px'; ink.style.transform=`translateX(${left}px)`;
    }
  }

  // === 渲染 L1/L2/L3 ===
  function findL1(path){ return L1.find(it => it.path === path) || null; }

  function renderL1(){
    const frag=document.createDocumentFragment();
    track.querySelectorAll('a.link').forEach(el=>el.remove());
    for(const item of L1){
      const a=document.createElement('a');
      a.className='link'; a.dataset.path=item.path; a.href=item.path; a.textContent = item.title || item.path;
      if(item.path===lockedPath) a.classList.add('active');
      a.addEventListener('pointerenter',()=>{ if(inSubRow) return; hoverPath=item.path; movePillToEl(a); renderSubPreview(hoverPath); });
      a.addEventListener('click',(e)=>{
        if(!USE_REAL_NAV) e.preventDefault();
        lockedPath=item.path;
        const firstSub=((item.children||[]).find(s=>s.visible!==false))||null;
        lockedSubHref = firstSub ? (firstSub.path||'') : '';
        lockedTabHref = '';
        try{ localStorage.setItem('NAV_STATE_V11', JSON.stringify({v:11, lockedPath, lockedSubHref, lockedTabHref, ts:Date.now()})); }catch(e){}
        hoverPath=lockedPath; highlightActive(); renderSub(lockedPath);
        if(USE_REAL_NAV && lockedSubHref) window.location.href=lockedSubHref;
      });
      frag.appendChild(a);
    }
    track.appendChild(frag);
    movePillToEl(track.querySelector(`.link[data-path="${hoverPath||lockedPath}"]`) || track.querySelector('.link'));
  }

  function highlightActive(){ track.querySelectorAll('.link').forEach(a=>a.classList.toggle('active', a.dataset.path===lockedPath)); }

  function renderSub(path){
    const l1 = findL1(path);
    const list = (l1 && Array.isArray(l1.children)) ? l1.children.filter(s=>s.visible!==false) : [];
    subInner.innerHTML = list.map(i=>`<a class="sub" data-owner="${h(path)}" href="${h(i.path||'#')}">${h(i.title||i.path||'')}</a>`).join('');
    updateSubRowMinHeight();
    // 激活二级
    if(lockedSubHref && list.some(x=>x.path===lockedSubHref)){
      const t=[...subInner.querySelectorAll('.sub')].find(a=>a.getAttribute('href')===lockedSubHref);
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
    subInner.innerHTML = list.map(i=>`<a class="sub" data-owner="${h(path)}" href="${h(i.path||'#')}">${h(i.title||i.path||'')}</a>`).join('');
  }

  function renderTabs(L3){
    if(!Array.isArray(L3) || !L3.length){
      tabsEl.innerHTML=''; ensureTabInk(); tabCard.classList.add('no-tabs');
      tableWrap.classList.add('hidden'); logsTableWrap.classList.add('hidden'); footerBar.classList.add('hidden');
      tabPanel.textContent='该二级暂无页签内容。'; return;
    }
    if(!lockedTabHref || !L3.some(t=>t.path===lockedTabHref)){ lockedTabHref = L3[0].path || ''; }
    tabsEl.innerHTML = L3.map(t=>`<a class="tab ${t.path===lockedTabHref?'active':''}" data-sub="${h(lockedSubHref)}" data-key="${h(t.key||'')}" href="${h(t.path)}"><span class="tab__text">${h(t.title||t.text||'')}</span></a>`).join('');
    ensureTabInk(); updatePanelForActiveTab(lockedSubHref);
    requestAnimationFrame(()=>positionTabInk(tabsEl.querySelector('.tab.active'), false));
  }

  function updateSubRowMinHeight(){ const textH=subInner.getBoundingClientRect().height||0; const extra=5; subRow.style.minHeight=(textH+extra)+'px'; }

  // 交互：一级/二级 hover 离开
  track.addEventListener('pointerleave',()=>{ clearTimeout(leaveTimer); leaveTimer=setTimeout(()=>{ if(!inSubRow){ hoverPath=lockedPath; movePillToEl(track.querySelector(`.link[data-path="${hoverPath||lockedPath}"]`)||track.querySelector('.link')); renderSub(lockedPath); } }, 220); });
  subRow.addEventListener('pointerenter',()=>{ inSubRow=true; clearTimeout(leaveTimer); });
  subRow.addEventListener('pointerleave',()=>{ inSubRow=false; hoverPath=lockedPath; movePillToEl(track.querySelector(`.link[data-path="${hoverPath||lockedPath}"]`)||track.querySelector('.link')); renderSub(lockedPath); });
  subInner.addEventListener('pointerover',(e)=>{ const s=e.target.closest('a.sub'); if(!s) return; const ownerEl=track.querySelector(`.link[data-path="${s.getAttribute('data-owner')}"]`); if(ownerEl) movePillToEl(ownerEl); });
  subInner.addEventListener('click',(e)=>{
    const a=e.target.closest('a.sub'); if(!a) return;
    if(!USE_REAL_NAV) e.preventDefault();
    const owner=a.getAttribute('data-owner'); lockedPath=owner; lockedSubHref=a.getAttribute('href')||'';
    const l1=findL1(lockedPath); const currentSub = (l1?.children||[]).find(x=>x.path===lockedSubHref);
    const L3=(currentSub?.children||[]).filter(t=>t.visible!==false) || [];
    lockedTabHref = L3.length ? (L3[0].path||'') : '';
    try{ localStorage.setItem('NAV_STATE_V11', JSON.stringify({v:11,lockedPath,lockedSubHref,lockedTabHref,ts:Date.now()})); }catch(e){}
    renderSub(lockedPath); if(USE_REAL_NAV && lockedSubHref) window.location.href=lockedSubHref;
  });

  // Tab 点击
  tabsEl.addEventListener('click',(e)=>{
    const t=e.target.closest('a.tab'); if(!t) return;
    if(!USE_REAL_NAV) e.preventDefault();
    tabsEl.querySelectorAll('.tab').forEach(a=>a.classList.remove('active'));
    t.classList.add('active');
    lockedTabHref=t.getAttribute('href')||'';
    try{ localStorage.setItem('NAV_STATE_V11', JSON.stringify({v:11,lockedPath,lockedSubHref,lockedTabHref,ts:Date.now()})); }catch(e){}
    positionTabInk(t, true);
    loadTabContent(lockedTabHref);
  });
  window.addEventListener('resize', ()=>{ positionTabInk(tabsEl.querySelector('.tab.active'), false); });

  // === 构建 L3 自 tabs 映射 ===
  function attachL3FromTabs(L1, tabsMap){
    if(!Array.isArray(L1) || !tabsMap) return L1||[];
    for(const l1 of L1){
      for(const l2 of (l1.children||[])){
        const arr = tabsMap[l2.path] || tabsMap[(l2.path||'').replace(/\/$/,'')] || null;
        if(Array.isArray(arr) && arr.length){
          l2.children = arr.map(t=>({ title: t.text||t.title||'', path: t.href||'', key: t.key||'', visible: true }));
        }
      }
    }
    return L1;
  }

  // === /api/nav 加载 ===
  async function loadNav(){
    // 读本地状态（兼容迁移）
    try{
      let raw = localStorage.getItem('NAV_STATE_V11') || localStorage.getItem('NAV_STATE_V10');
      if(raw){
        const obj=JSON.parse(raw);
        if(obj && obj.lockedPath){ lockedPath=obj.lockedPath||''; lockedSubHref=obj.lockedSubHref||''; lockedTabHref=obj.lockedTabHref||''; }
      }
    }catch(e){}

    try{
      const res = await fetch('/api/nav', { credentials: 'include' });
      const json = await res.json();
      const items = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : (Array.isArray(json?.items) ? json.items : []));
      const _tabs = json?.tabs || {};
      L1 = items.map(it=>({
        title: it.title||'', path: it.path||'/', order: it.order||0, visible: it.visible!==false,
        children: Array.isArray(it.children)? it.children.map(c=>({ title: c.text||c.title||'', path: c.href||c.path||'', visible: c.visible!==false })) : []
      })).filter(it=>it.visible).sort((a,b)=>(a.order||0)-(b.order||0));
      L1 = attachL3FromTabs(L1, _tabs);
      if(!lockedPath){ lockedPath = L1[0]?.path || '/'; }
      if(!lockedSubHref){ const firstSub = ((findL1(lockedPath)?.children)||[]).find(s=>s.visible!==false); lockedSubHref = firstSub ? (firstSub.path||'') : ''; }
      if(lockedSubHref){
        const l1=findL1(lockedPath);
        const sub=(l1?.children||[]).find(x=>x.path===lockedSubHref);
        const L3=(sub?.children||[]).filter(t=>t.visible!==false) || [];
        if(!lockedTabHref && L3.length){ lockedTabHref = L3[0].path || ''; }
      }
    }catch(e){
      // 空壳
      L1 = [{ title:'首页', path:'/admin', visible:true, order:1, children:[] }];
      if(!lockedPath) lockedPath = '/admin';
    }

    hoverPath = lockedPath;
    renderL1();
    renderSub(lockedPath);
  }

  // === L3 内嵌：面单上传（列表 / 上传记录） ===
  let currentTabContext='labelList';
  let selectedIds = new Set();
  let masterRows=[], viewRows=[], pageSize=50, pageIndex=1;
  let sortKey='status', sortDir='asc';
  const STATUS_ORDER = { '已预报':0, '待换单':1, '待导入面单':2, '待映射订单号':3, '已换单':4 };
  let logsMasterRows=[], logsViewRows=[], logsPageIndex=1;
  let currentAction='', currentLogsNos=[], currentLogsMode='fail';
  let _globalEventsBound=false;

  function toLocal(d){ const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
  function formatDateTime(d){ if(!(d instanceof Date) || isNaN(d)) return '-'; const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }
  function genDemoRows(n=120){
    const statuses=['已预报','待映射订单号','待导入面单','待换单','已换单'];
    const ships=['USPS','JC',''];
    const now=Date.now(); const rows=[];
    for(let i=1;i<=n;i++){
      const created=new Date(now - Math.floor(Math.random()*60)*86400000 - Math.floor(Math.random()*86400000));
      const printed=Math.random()<0.6 ? new Date(created.getTime()+Math.floor(Math.random()*3)*86400000 + Math.floor(Math.random()*86400000)) : null;
      const pad=(x,len)=>String(x).padStart(len,'0');
      rows.push({ id:i, orderNo:`OD${created.getFullYear()}${pad(created.getMonth()+1,2)}${pad(created.getDate(),2)}${pad(i,4)}`, waybill:`1Z${Math.random().toString(36).slice(2,10).toUpperCase()}${Math.floor(Math.random()*1e6)}`, transNo:`TR${pad(i,6)}`, ship:ships[Math.floor(Math.random()*ships.length)], file: Math.random()<0.12?'':`label_${pad(i,4)}.pdf`, status:statuses[Math.floor(Math.random()*statuses.length)], createdAt:created, printedAt:printed, voided:false });
    }
    return rows;
  }
  function genUploadLogs(n=36){
    const ops=['系统','王涛','Emma','Jack','Lucy','运营A']; const types=['面单文件','运单号']; const out=[];
    for(let i=1;i<=n;i++){
      const d=new Date(Date.now()-Math.floor(Math.random()*45)*86400000 - Math.floor(Math.random()*10)*3600000);
      const pad=(x,len=2)=>String(x).padStart(len,'0'); const type=types[Math.random()<0.6?0:1];
      const total=50+Math.floor(Math.random()*150); const success=30+Math.floor(Math.random()*(total-30)); const fail=Math.max(0,total-success);
      const mkWB=()=>`1Z${Math.random().toString(36).slice(2,10).toUpperCase()}${Math.floor(Math.random()*1e5)}`;
      const mkOD=(i)=>`OD${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(i,4)}`;
      const numsSucc=Array.from({length:success},(_,k)=> type==='运单号'? mkWB() : mkOD(k+1));
      const numsFail=Array.from({length:fail},(_,k)=> type==='运单号'? mkWB() : mkOD(k+2001));
      out.push({ id:i, time:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`, file:`upload_${pad(d.getMonth()+1)}${pad(d.getDate())}_${String(Math.floor(Math.random()*9999)).padStart(4,'0')}.${type==='面单文件'?'xlsx':'txt'}`, type, total, success, fail, operator:ops[Math.floor(Math.random()*ops.length)], successNos:numsSucc, failNos:numsFail });
    }
    return out.sort((a,b)=>a.time<b.time?1:-1);
  }

  function fitTableHeight(){
    requestAnimationFrame(()=>{
      const wrap = document.querySelector('.table-wrap:not(.hidden)'); if(!wrap) return;
      const scroller = wrap.querySelector('.table-scroll'); if(!scroller) return;
      const top = scroller.getBoundingClientRect().top;
      const footerTop = footerBar.classList.contains('hidden') ? window.innerHeight : footerBar.getBoundingClientRect().top;
      const h = Math.max(120, Math.floor(footerTop - top - 12));
      scroller.style.maxHeight = h + 'px'; scroller.style.height = h + 'px';
    });
  }
  function toggleFooterSelectionControls(show){ [selAll, selInvert, selCounter].forEach(el=>{ if(el) el.classList.toggle('hidden', !show); }); }

  function renderLabelUploadListCardAndTable(){
    currentTabContext='labelList'; toggleFooterSelectionControls(true);
    tabCard.classList.remove('no-tabs');
    tableWrap.classList.remove('hidden'); logsTableWrap.classList.add('hidden'); footerBar.classList.remove('hidden');
    tabPanel.innerHTML = `
      <div class="toolbar" id="luToolbar">
        <div class="toolbar-left">
          <div class="range">
            <select class="select" id="timeField"><option value="created">创建时间</option><option value="printed">打印时间</option></select>
            <input type="datetime-local" class="input input--dt" id="startTime"><span>—</span><input type="datetime-local" class="input input--dt" id="endTime">
            <div class="dropdown" id="quickDrop"><button class="btn" id="quickBtn">快捷时间 <span class="caret">▾</span></button>
              <div class="menu"><a href="#" data-days="1">近 1 天</a><a href="#" data-days="3">近 3 天</a><a href="#" data-days="7">近 7 天</a><a href="#" data-days="15">近 15 天</a><a href="#" data-days="30">近 30 天</a></div>
            </div>
          </div>
          <select class="select" id="statusSel">
            <option value="">面单状态</option><option>已预报</option><option>待映射订单号</option><option>待导入面单</option><option>待换单</option><option>已换单</option><option>已作废</option>
          </select>
          <select class="select" id="shipSel"><option value="">运输方式</option><option>USPS</option><option>JC</option></select>
          <button type="button" id="resetBtn" class="select" title="重置筛选">重置</button>
        </div>
        <div class="toolbar-actions">
          <input class="input input--search" id="kw" placeholder="单号搜索 / 双击批量搜索">
          <button class="btn btn--black" id="searchBtn">搜索</button>
          <div class="dropdown" id="bulkDrop">
            <button class="btn btn--black" id="bulkBtn">批量操作 <span class="caret">▾</span></button>
            <div class="menu">
              <a href="#" data-act="import-label">导入面单</a><a href="#" data-act="import-map">导入单号映射</a><a href="#" data-act="delete">批量删除</a><a href="#" data-act="export-orders">订单导出</a><a href="#" data-act="copy-waybill">批量复制单号</a><a href="#" data-act="batch-print">批量打印</a><a href="#" data-act="batch-activate">批量激活</a><a href="#" data-act="batch-void">批量作废</a>
            </div>
          </div>
        </div>
      </div>`;
    if(!masterRows.length){ masterRows = genDemoRows(120); }
    pageSize=parseInt(pageSizeSel.value,10)||50; pageIndex=1; selectedIds.clear();
    bindLabelUploadEvents(); applyFilters(); fitTableHeight(); updateSortBtnsUI();
  }

  function renderLabelUploadLogsPanel(){
    currentTabContext='logs'; toggleFooterSelectionControls(false);
    tabCard.classList.remove('no-tabs');
    tableWrap.classList.add('hidden'); logsTableWrap.classList.remove('hidden'); footerBar.classList.remove('hidden');
    tabPanel.innerHTML = `
      <div class="toolbar" id="logsToolbar">
        <div class="toolbar-left">
          <div class="range">
            <input type="datetime-local" class="input input--dt" id="logsStart"><span>—</span><input type="datetime-local" class="input input--dt" id="logsEnd">
            <div class="dropdown" id="logsQuickDrop"><button class="btn" id="logsQuickBtn">快捷时间 <span class="caret">▾</span></button>
              <div class="menu"><a href="#" data-days="1">近 1 天</a><a href="#" data-days="3">近 3 天</a><a href="#" data-days="7">近 7 天</a><a href="#" data-days="15">近 15 天</a><a href="#" data-days="30">近 30 天</a></div>
            </div>
          </div>
          <button type="button" id="logsResetBtn" class="select" title="重置筛选">重置</button>
        </div>
      </div>`;
    if(!logsMasterRows.length){ logsMasterRows = genUploadLogs(36); }
    pageSize=parseInt(pageSizeSel.value,10)||50; logsPageIndex=1;
    bindLogsEvents(); applyLogsFilters(); fitTableHeight();
  }

  // ===== 列表页逻辑 =====
  function enhanceDateInputs(inputs){ inputs.forEach(inp=>{ if(!inp) return; if(typeof inp.showPicker==='function'){ inp.addEventListener('click', (e)=>{ e.preventDefault(); inp.showPicker(); }); inp.addEventListener('keydown', (e)=>{ if(e.key!=='Tab') e.preventDefault(); }); } }); }
  function upgradeSelectToMenu(selectEl){ if(!selectEl || selectEl.dataset.enhanced === '1') return; const wrapper = document.createElement('div'); wrapper.className = 'cselect'; const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cs-toggle'; btn.setAttribute('aria-haspopup','listbox'); btn.setAttribute('aria-expanded','false'); const txtSpan = document.createElement('span'); txtSpan.className = 'cs-text'; const curOpt = selectEl.options[selectEl.selectedIndex] || null; txtSpan.textContent = curOpt ? curOpt.text : ''; const caret = document.createElement('span'); caret.className = 'caret'; caret.textContent = '▾'; btn.appendChild(txtSpan); btn.appendChild(caret); const menu = document.createElement('div'); menu.className = 'menu'; menu.setAttribute('role','listbox'); menu.tabIndex = -1; const aEls = []; [...selectEl.options].forEach((opt, idx)=>{ const a = document.createElement('a'); a.href = '#'; a.dataset.value = opt.value; a.textContent = opt.text; a.setAttribute('role','option'); if(idx===selectEl.selectedIndex) a.setAttribute('aria-selected','true'); a.addEventListener('click', (e)=>{ e.preventDefault(); selectEl.value = opt.value; txtSpan.textContent = opt.text; menu.querySelectorAll('[aria-selected]').forEach(x=>x.removeAttribute('aria-selected')); a.setAttribute('aria-selected','true'); selectEl.dispatchEvent(new Event('change', { bubbles:true })); closeAllMenus(null); btn.focus(); }); menu.appendChild(a); aEls.push(a); }); selectEl.classList.add('sr-select'); selectEl.dataset.enhanced = '1'; selectEl.parentNode.insertBefore(wrapper, selectEl); wrapper.appendChild(selectEl); wrapper.appendChild(btn); wrapper.appendChild(menu); btn.addEventListener('click', (e)=>{ e.stopPropagation(); const willOpen = !wrapper.classList.contains('open'); closeAllMenus(willOpen?wrapper:null); wrapper.classList.toggle('open', willOpen); btn.setAttribute('aria-expanded', willOpen?'true':'false'); if(willOpen){ const cur = aEls.find(a=>a.getAttribute('aria-selected')==='true') || aEls[0]; if(cur) { menu.focus({preventScroll:true}); setTimeout(()=>cur.scrollIntoView({block:'nearest'}),0); } } }); }
  function closeAllMenus(exceptEl=null){ document.querySelectorAll('.dropdown.open').forEach(el=>{ if(el!==exceptEl) el.classList.remove('open'); }); document.querySelectorAll('.cselect.open').forEach(el=>{ if(el!==exceptEl){ el.classList.remove('open'); const btn=el.querySelector('.cs-toggle'); if(btn) btn.setAttribute('aria-expanded','false'); } }); }
  document.addEventListener('click',(e)=>{ if(!e.target.closest('.dropdown') && !e.target.closest('.cselect')) closeAllMenus(null); });
  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeAllMenus(null); });

  function bindLabelUploadEvents(){
    const bulkDrop=document.getElementById('bulkDrop'), bulkBtn=document.getElementById('bulkBtn');
    const startTime=document.getElementById('startTime'), endTime=document.getElementById('endTime');
    const statusSel=document.getElementById('statusSel'), shipSel=document.getElementById('shipSel');
    const kw=document.getElementById('kw'), searchBtn=document.getElementById('searchBtn');
    const quickDrop=document.getElementById('quickDrop'), quickBtn=document.getElementById('quickBtn');
    const timeField=document.getElementById('timeField');
    const resetBtn=document.getElementById('resetBtn');

    upgradeSelectToMenu(timeField); upgradeSelectToMenu(statusSel); upgradeSelectToMenu(shipSel);
    enhanceDateInputs([startTime,endTime]);

    if(bulkBtn && bulkDrop){
      bulkBtn.addEventListener('click',(e)=>{ e.stopPropagation(); const willOpen = !bulkDrop.classList.contains('open'); closeAllMenus(willOpen?bulkDrop:null); bulkDrop.classList.toggle('open', willOpen); });
      bulkDrop.querySelectorAll('.menu a').forEach(a=>{ a.addEventListener('click',(e)=>{ e.preventDefault(); alert('占位：'+(a.dataset.act||'')); closeAllMenus(null); }); });
    }
    if(quickBtn && quickDrop){
      quickBtn.addEventListener('click',(e)=>{ e.stopPropagation(); const willOpen=!quickDrop.classList.contains('open'); closeAllMenus(willOpen?quickDrop:null); quickDrop.classList.toggle('open', willOpen); });
      quickDrop.querySelectorAll('.menu a').forEach(a=>{ a.addEventListener('click',(e)=>{ e.preventDefault(); const days=parseInt(a.dataset.days||'',10); if(Number.isFinite(days)){ const to=new Date(); const from=new Date(to.getTime()-days*86400000); startTime.value=toLocal(from); endTime.value=toLocal(to);} closeAllMenus(null); applyFilters(); }); });
    }
    if(searchBtn) searchBtn.addEventListener('click',()=>{ applyFilters(); fitTableHeight(); });
    if(kw){ kw.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ applyFilters(); fitTableHeight(); } }); }

    if(timeField) timeField.addEventListener('change', ()=>{ applyFilters(); });
    if(resetBtn) resetBtn.addEventListener('click', ()=>{
      startTime.value=''; endTime.value=''; kw.value=''; timeField.value='created'; statusSel.value=''; shipSel.value='';
      applyFilters();
    });

    if(_globalEventsBound) return; _globalEventsBound=true;

    const chkAll=document.getElementById('chkAll'); const bs=document.getElementById('sortStatus'), bt=document.getElementById('sortTime');
    if(chkAll) chkAll.addEventListener('change',()=>{ const slice=getCurrentPageRows(); if(chkAll.checked){ slice.forEach(r=>selectedIds.add(r.id)); }else{ slice.forEach(r=>selectedIds.delete(r.id)); } updateCurrentPageSelectionUI(); });
    tbodyEl.addEventListener('change',(e)=>{ if(e.target && e.target.matches('input.rowchk')){ const id=+e.target.getAttribute('data-id'); if(e.target.checked) selectedIds.add(id); else selectedIds.delete(id); syncHeaderCheckbox(); updateSelCounter(); const tr=e.target.closest('tr'); if(tr) tr.classList.toggle('selected', e.target.checked); } });
    if(bs) bs.addEventListener('click', ()=>{ if(sortKey==='status'){ sortDir = (sortDir==='asc'?'desc':'asc'); } else { sortKey='status'; sortDir='asc'; } sortRows(); pageIndex=1; renderTable(); updateSortBtnsUI(); });
    if(bt) bt.addEventListener('click', ()=>{ if(sortKey==='time'){ sortDir = (sortDir==='asc'?'desc':'asc'); } else { sortKey='time'; sortDir='desc'; } sortRows(); pageIndex=1; renderTable(); updateSortBtnsUI(); });

    pageSizeSel.addEventListener('change',()=>{ pageSize=parseInt(pageSizeSel.value,10)||50; pageIndex=1; if(currentTabContext==='logs'){ renderLogsTable(); } else { renderTable(); } fitTableHeight(); });
    firstPage.addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext==='logs'){ logsPageIndex=1; renderLogsTable(); } else { pageIndex=1; renderTable(); } fitTableHeight(); });
    prevPage .addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext==='logs'){ logsPageIndex=Math.max(1,logsPageIndex-1); renderLogsTable(); } else { pageIndex=Math.max(1,pageIndex-1); renderTable(); } fitTableHeight(); });
    nextPage .addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext==='logs'){ logsPageIndex=Math.min(totalPagesLogs(),logsPageIndex+1); renderLogsTable(); } else { pageIndex=Math.min(totalPages(),pageIndex+1); renderTable(); } fitTableHeight(); });
    lastPage .addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext==='logs'){ logsPageIndex=totalPagesLogs(); renderLogsTable(); } else { pageIndex=totalPages(); renderTable(); } fitTableHeight(); });
    jumpTo   .addEventListener('change',()=>{ const p=+jumpTo.value||1; if(currentTabContext==='logs'){ logsPageIndex=Math.min(Math.max(1,p),totalPagesLogs()); renderLogsTable(); } else { pageIndex=Math.min(Math.max(1,p),totalPages()); renderTable(); } fitTableHeight(); });
    goTop.addEventListener('click',(e)=>{ e.preventDefault(); const sc=document.querySelector('.table-wrap:not(.hidden) .table-scroll'); if(sc) sc.scrollTo({top:0, behavior:'smooth'}); });
    selAll.addEventListener('click',(e)=>{ e.preventDefault(); const slice=getCurrentPageRows(); slice.forEach(r=>selectedIds.add(r.id)); updateCurrentPageSelectionUI(); });
    selInvert.addEventListener('click',(e)=>{ e.preventDefault(); const slice=getCurrentPageRows(); slice.forEach(r=>{ if(selectedIds.has(r.id)) selectedIds.delete(r.id); else selectedIds.add(r.id); }); updateCurrentPageSelectionUI(); });
  }

  function getCurrentPageRows(){ const start=(pageIndex-1)*pageSize; return viewRows.slice(start,start+pageSize); }
  function updateCurrentPageSelectionUI(){ const slice=getCurrentPageRows(); const ids=new Set(slice.map(r=>r.id)); tbodyEl.querySelectorAll('tr').forEach(tr=>{ const id=Number(tr.getAttribute('data-id')); if(!ids.has(id)) return; const checked = selectedIds.has(id); const cb = tr.querySelector('input.rowchk'); if(cb) cb.checked = checked; tr.classList.toggle('selected', checked); }); syncHeaderCheckbox(); updateSelCounter(); }
  function syncHeaderCheckbox(){ const head=document.getElementById('chkAll'); const slice=getCurrentPageRows(); const total=slice.length; const sel = slice.filter(r=>selectedIds.has(r.id)).length; head.indeterminate = sel>0 && sel<total; head.checked = total>0 && sel===total; }
  function updateSelCounter(){ if(selCounter) selCounter.textContent = `已选择 ${selectedIds.size} 条`; }

  function sortRows(){
    const tf = document.getElementById('timeField')?.value || 'created';
    viewRows.sort((a,b)=>{
      if(sortKey==='status'){
        const av = STATUS_ORDER.hasOwnProperty(a.status)? STATUS_ORDER[a.status] : 99;
        const bv = STATUS_ORDER.hasOwnProperty(b.status)? STATUS_ORDER[b.status] : 99;
        return (av - bv) * (sortDir==='asc'?1:-1);
      }else if(sortKey==='time'){
        const va = tf==='printed' ? a.printedAt : a.createdAt;
        const vb = tf==='printed' ? b.printedAt : b.createdAt;
        const na = va instanceof Date && !isNaN(va) ? +va : (sortDir==='asc' ? Infinity : -Infinity);
        const nb = vb instanceof Date && !isNaN(vb) ? +vb : (sortDir==='asc' ? Infinity : -Infinity);
        return (na - nb) * (sortDir==='asc'?1:-1);
      }
      return 0;
    });
  }
  function updateSortBtnsUI(){
    const bs=document.getElementById('sortStatus'), bt=document.getElementById('sortTime');
    const thStatus=document.getElementById('thStatus'), thTime=document.getElementById('thTime');
    if(bs){ bs.classList.toggle('active', sortKey==='status'); bs.querySelector('.ind').textContent = sortKey==='status' ? (sortDir==='asc'?'↑':'↓') : '⇅'; }
    if(bt){ bt.classList.toggle('active', sortKey==='time'  ); bt.querySelector('.ind').textContent = sortKey==='time'   ? (sortDir==='asc'?'↑':'↓') : '⇅'; }
    if(thStatus) thStatus.setAttribute('aria-sort', sortKey==='status'?(sortDir==='asc'?'ascending':'descending'):'none');
    if(thTime)   thTime  .setAttribute('aria-sort', sortKey==='time'  ?(sortDir==='asc'?'ascending':'descending'):'none');
  }

  function applyFilters(){
    const timeField=document.getElementById('timeField')?.value||'created';
    const startVal=document.getElementById('startTime').value, endVal=document.getElementById('endTime').value;
    const statusSel=document.getElementById('statusSel').value.trim(), shipSel=document.getElementById('shipSel').value.trim();
    const kw=document.getElementById('kw').value.trim();
    const picks=kw?kw.split(/\s+/).filter(Boolean).map(s=>s.toLowerCase()):[];
    const getDate=r=> timeField==='printed'? r.printedAt : r.createdAt;
    const startTs = startVal ? new Date(startVal).getTime() : null;
    const endTs   = endVal   ? new Date(endVal).getTime()   : null;
    viewRows=masterRows.filter(r=>{
      const d=getDate(r);
      const ts = d instanceof Date && !isNaN(d) ? +d : null;
      if(startTs!==null){ if(ts===null || ts<startTs) return false; }
      if(endTs!==null){   if(ts===null || ts>endTs)   return false; }
      if(statusSel){
        if(statusSel === '已作废'){ if(!r.voided) return false; }
        else{ if(r.status !== statusSel) return false; }
      }
      if(shipSel && r.ship!==shipSel) return false;
      if(picks.length){
        const hay=(r.orderNo+' '+r.waybill+' '+r.transNo).toLowerCase();
        let hit=false; for(let i=0;i<picks.length;i++){ if(hay.includes(picks[i])){ hit=true; break; } }
        if(!hit) return false;
      }
      return true;
    });
    sortRows(); pageIndex=1; renderTable();
  }

  function totalPages(){ return Math.max(1, Math.ceil(viewRows.length/pageSize)); }
  function renderTable(){
    const start=(pageIndex-1)*pageSize, slice=viewRows.slice(start,start+pageSize);
    tbodyEl.innerHTML='';
    let i=0;
    function chunk(){
      const frag=document.createDocumentFragment();
      for(let c=0;c<50 && i<slice.length;c++,i++){
        const r=slice[i];
        const tr=document.createElement('tr'); tr.setAttribute('data-id', String(r.id));
        if(selectedIds.has(r.id)) tr.classList.add('selected'); if(r.voided) tr.classList.add('voided');
        const tdChk=document.createElement('td'); tdChk.className='col-chk'; tdChk.innerHTML=`<input type="checkbox" class="chk rowchk" data-id="${r.id}" ${selectedIds.has(r.id)?'checked':''}>`;
        const tdOrder=document.createElement('td'); tdOrder.className='col-order'; tdOrder.textContent=r.orderNo;
        const tdWay=document.createElement('td'); tdWay.className='col-waybill'; tdWay.textContent=r.waybill;
        const tdTrans=document.createElement('td'); tdTrans.className='col-trans'; tdTrans.textContent=r.transNo;
        const tdShip=document.createElement('td'); tdShip.className='col-ship'; tdShip.textContent=r.ship||'-';
        const tdFile=document.createElement('td'); tdFile.className='col-file'; tdFile.textContent=r.file||'-';
        const tdStat=document.createElement('td'); tdStat.className='col-status'; tdStat.textContent=`${r.status}${r.voided?'｜已作废':''}`;
        const tdTime=document.createElement('td'); tdTime.className='col-created'; tdTime.innerHTML=`<div class="time2"><div>创建时间：${h(formatDateTime(r.createdAt))}</div><div>打印时间：${h(formatDateTime(r.printedAt))}</div></div>`;
        const tdOp=document.createElement('td'); tdOp.className='col-op'; const prev=document.createElement('button'); prev.type='button'; prev.className='btn-link preview'; prev.textContent='预览'; if(!(r.file && r.file.trim())) prev.disabled=true; const toggle=document.createElement('button'); toggle.type='button'; toggle.className='btn-link toggle-void'; toggle.dataset.id=String(r.id); toggle.textContent=r.voided?'激活':'作废'; tdOp.appendChild(prev); tdOp.appendChild(toggle);
        tr.appendChild(tdChk); tr.appendChild(tdOrder); tr.appendChild(tdWay); tr.appendChild(tdTrans); tr.appendChild(tdShip); tr.appendChild(tdFile); tr.appendChild(tdStat); tr.appendChild(tdTime); tr.appendChild(tdOp);
        frag.appendChild(tr);
      }
      tbodyEl.appendChild(frag);
      if(i<slice.length){ requestAnimationFrame(chunk); }
    }
    requestAnimationFrame(chunk);

    pageInfo.textContent=`共 ${viewRows.length} 条 ${pageIndex}/${totalPages()} 页`; jumpTo.value=pageIndex;
    const pages=totalPages(); const nums=[]; const s=Math.max(1,pageIndex-2), e=Math.min(pages,pageIndex+2);
    for(let i=s;i<=e;i++){ nums.push(`<a href="#" data-p="${i}" style="${i===pageIndex?'font-weight:700;text-decoration:underline':''}">${i}</a>`); }
    pageNums.innerHTML=nums.join('');
    pageNums.querySelectorAll('a').forEach(a=>a.addEventListener('click',(e)=>{ e.preventDefault(); pageIndex=+a.dataset.p; renderTable(); fitTableHeight(); }));

    syncHeaderCheckbox(); fitTableHeight(); updateSelCounter();
  }

  function bindLogsEvents(){
    const s=document.getElementById('logsStart'), e=document.getElementById('logsEnd');
    const quickDrop=document.getElementById('logsQuickDrop'), quickBtn=document.getElementById('logsQuickBtn');
    const resetBtn=document.getElementById('logsResetBtn');
    enhanceDateInputs([s,e]);
    if(quickBtn && quickDrop){
      quickBtn.addEventListener('click',(ev)=>{ ev.stopPropagation(); const willOpen = !quickDrop.classList.contains('open'); closeAllMenus(willOpen?quickDrop:null); quickDrop.classList.toggle('open', willOpen); });
      quickDrop.querySelectorAll('.menu a').forEach(a=>{ a.addEventListener('click',(e2)=>{ e2.preventDefault(); const days=parseInt(a.dataset.days||'',10); if(Number.isFinite(days)){ const to=new Date(); const from=new Date(to.getTime()-days*86400000); s.value=toLocal(from); e.value=toLocal(to);} closeAllMenus(null); applyLogsFilters(); }); });
    }
    if(resetBtn) resetBtn.addEventListener('click', ()=>{ s.value=''; e.value=''; applyLogsFilters(); });
    logsTbody.addEventListener('click', (e)=>{
      const btn = e.target.closest('button.log-view'); if(!btn) return;
      const id = Number(btn.dataset.id);
      const row = logsMasterRows.find(x=>x.id===id);
      if(row) alert('占位：弹出日志（成功/失败切换+复制）');
    });
  }
  function applyLogsFilters(){
    const s=document.getElementById('logsStart').value; const e=document.getElementById('logsEnd').value;
    const st=s?new Date(s).getTime():null; const et=e?new Date(e).getTime():null;
    logsViewRows = logsMasterRows.filter(r=>{ const ts=new Date(r.time.replace(/-/g,'/')).getTime(); if(st!==null && ts<st) return false; if(et!==null && ts>et) return false; return true; });
    logsPageIndex=1; renderLogsTable();
  }
  function totalPagesLogs(){ return Math.max(1, Math.ceil(logsViewRows.length/pageSize)); }
  function renderLogsTable(){
    const start=(logsPageIndex-1)*pageSize, slice=logsViewRows.slice(start, start+pageSize);
    logsTbody.innerHTML = slice.map(r=>`<tr data-id="${r.id}"><td>${h(r.time)}</td><td>${h(r.file)}</td><td>${h(r.type)}</td><td>${r.total}</td><td>${r.success}</td><td>${r.fail}</td><td>${h(r.operator)}</td><td><button class="btn-link log-view" data-id="${r.id}">查看</button></td></tr>`).join('');
    pageInfo.textContent=`共 ${logsViewRows.length} 条 ${logsPageIndex}/${totalPagesLogs()} 页`; jumpTo.value=logsPageIndex;
    const pages=totalPagesLogs(); const nums=[]; const s=Math.max(1,logsPageIndex-2), e=Math.min(pages,logsPageIndex+2);
    for(let i=s;i<=e;i++){ nums.push(`<a href="#" data-p="${i}" style="${i===logsPageIndex?'font-weight:700;text-decoration:underline':''}">${i}</a>`); }
    pageNums.innerHTML=nums.join('');
    pageNums.querySelectorAll('a').forEach(a=>a.addEventListener('click',(e)=>{ e.preventDefault(); logsPageIndex=+a.dataset.p; renderLogsTable(); fitTableHeight(); }));
    fitTableHeight();
  }

  // === Tab 内容装载 ===
  function loadTabContent(href){
    if(!href) return;
    const isList = /\/orders\/label-upload\/list$/.test(href);
    const isLogs = /\/orders\/label-upload\/logs$/.test(href);
    if(isList){ renderLabelUploadListCardAndTable(); return; }
    if(isLogs){ renderLabelUploadLogsPanel(); return; }
    tabCard.classList.remove('no-tabs');
    tableWrap.classList.add('hidden'); logsTableWrap.classList.add('hidden'); footerBar.classList.add('hidden');
    tabPanel.textContent = '该页签暂无内容。';
  }

  // 初始：读取本地状态 → 加载导航 → 渲染
  (function init(){
    try{
      let raw=localStorage.getItem('NAV_STATE_V11') || localStorage.getItem('NAV_STATE_V10');
      if(raw){
        const obj=JSON.parse(raw);
        if(obj && obj.v===11 && obj.lockedPath){ lockedPath=obj.lockedPath; lockedSubHref=obj.lockedSubHref||''; lockedTabHref=obj.lockedTabHref||''; }
      }
    }catch(e){}
    loadNav();
  })();
})();
