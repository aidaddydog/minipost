
// 该文件整合了一级/二级/三级导航、筛选卡片、表格与弹窗交互
// —— 基于你提供的 UI（HTML/CSS/行为），此处仅把“数据源”改为真实 API。
// 重要：保持 UI 设计不变。

(function(){
  // ========== DOM 引用 ==========
  const track=document.getElementById('navTrack'), pill=document.getElementById('pill');
  const links=[...track.querySelectorAll('.link')];
  const subRow=document.getElementById('subRow'), subInner=document.getElementById('subInner');
  const tabsEl=document.getElementById('tabs'), tabCard=document.getElementById('tabCard'), tabPanel=document.getElementById('tabPanel');
  const tableWrap=document.getElementById('tableWrap'), tbodyEl=document.getElementById('luTbody');
  const logsTableWrap=document.getElementById('logsTableWrap'), logsTbody=document.getElementById('logsTbody');
  const footerBar=document.getElementById('footerBar');

  // 页底栏控件
  const pageSizeSel=document.getElementById('pageSize'), pageInfo=document.getElementById('pageInfo'), pageNums=document.getElementById('pageNums');
  const firstPage=document.getElementById('firstPage'), prevPage=document.getElementById('prevPage'), nextPage=document.getElementById('nextPage'), lastPage=document.getElementById('lastPage');
  const jumpTo=document.getElementById('jumpTo'); const goTop=document.getElementById('goTop');
  const selAll=document.getElementById('selAll'), selInvert=document.getElementById('selInvert');
  const selCounter=document.getElementById('selCounter');

  // 弹窗
  const bulkModal=document.getElementById('bulkModal'), bulkText=document.getElementById('bulkText');
  const bulkCancel=document.getElementById('bulkCancel'), bulkApply=document.getElementById('bulkApply');
  const opModal=document.getElementById('opModal'), opTitle=document.getElementById('opTitle'), opContent=document.getElementById('opContent');
  const opCancel=document.getElementById('opCancel'), opConfirm=document.getElementById('opConfirm');

  // ========== 状态 ==========
  const SCHEMA_VERSION = 11;
  const STORAGE_KEY = 'NAV_STATE_V11';
  const USE_REAL_NAV = false;
  let lockedPath='/orders', lockedSubHref='', lockedTabHref='';
  let hoverPath=lockedPath, inSubRow=false, leaveTimer=null;
  let currentTabContext='labelList';
  let selectedIds = new Set();

  // 列表数据
  let masterRows=[], viewRows=[], pageSize=50, pageIndex=1;
  let sortKey='time', sortDir='desc';
  const STATUS_ORDER = { '已预报':0, '待换单':1, '待导入面单':2, '待映射订单号':3, '已换单':4 };

  // 上传记录数据
  let logsMasterRows=[], logsViewRows=[], logsPageIndex=1;
  let currentLogsNos=[], currentLogsMode='fail';
  let currentAction='';

  // ========== 工具 ==========
  const _escMap = { '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;', \"'\":'&#39;' };
  const h = (s)=>String(s==null?'':s).replace(/[&<>\"']/g, m=>_escMap[m]);
  const cssVarNum = (name, fallback=0)=>{
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if(!v) return fallback; const n = parseFloat(v); return Number.isFinite(n) ? n : fallback;
  };
  async function api(path, opts){
    const r = await fetch(path, Object.assign({headers:{}, credentials:'same-origin'}, opts||{}));
    if(!r.ok){ const t = await r.text(); throw new Error(t || (r.status+'')); }
    const ct = r.headers.get('content-type')||'';
    if(ct.includes('application/json')) return await r.json();
    return await r.text();
  }
  const toLocal = (d)=>{
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  const formatDateTime = (d)=>{
    if(!(d instanceof Date) || isNaN(d)) return '-';
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  // ========== 一级/二级/三级导航 =========
  const SUBMAP={
    '/orders':[
      {text:'预报',href:'/orders/prealert'},
      {text:'订单列表',href:'/orders/list'},
      {text:'面单上传',href:'/orders/label-upload'},
      {text:'订单轨迹',href:'/orders/track'},
      {text:'订单规则',href:'/orders/rules'},
    ],
    '/products':[ {text:'商品列表',href:'/products/list'}, {text:'定制规则',href:'/products/custom-rules'} ],
    '/logistics':[ {text:'物流规则',href:'/logistics/rules'}, {text:'物流渠道',href:'/logistics/channels'}, {text:'地址管理',href:'/logistics/address'} ],
    '/settings':[ {text:'仓库设置',href:'/settings/warehouse'}, {text:'服务商授权',href:'/settings/provider-auth'}, {text:'店铺授权',href:'/settings/shop-auth'}, {text:'客户端管理',href:'/settings/client'}, {text:'系统设置',href:'/settings/system'} ]
  };
  const TABMAP={
    '/orders/prealert':[
      {key:'pickup',text:'预约取件',href:'/orders/prealert/pickup'},
      {key:'scan',  text:'扫码发货',href:'/orders/prealert/scan'},
      {key:'list',  text:'预报列表',href:'/orders/prealert/list'},
    ],
    '/orders/label-upload':[
      {key:'list', text:'面单列表', href:'/orders/label-upload/list'},
      {key:'logs', text:'上传记录', href:'/orders/label-upload/logs'}
    ],
  };
  const DEFAULT_TAB_BY_SUB={'/orders/prealert':'/orders/prealert/list','/orders/label-upload':'/orders/label-upload/list'};

  let _pillRAF=0, _pillNext=null;
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
  function renderSub(path){
    const list=SUBMAP[path]||[];
    subInner.innerHTML=list.map(i=>`<a class="sub" data-owner=\"${path}\" href=\"${i.href}\">${i.text}</a>`).join('');
    if(lockedSubHref){
      const t=[...subInner.querySelectorAll('.sub')].find(a=>a.getAttribute('href')===lockedSubHref);
      if(t) t.classList.add('active');
    }
    updateSubRowMinHeight();

    if(TABMAP[lockedSubHref]) renderTabs(lockedSubHref);
    else{
      tabsEl.innerHTML=''; ensureTabInk();
      tabCard.classList.add('no-tabs'); tableWrap.classList.add('hidden'); logsTableWrap.classList.add('hidden'); footerBar.classList.add('hidden');
      tabPanel.innerHTML='该二级暂无页签内容。';
    }
  }
  function renderSubPreview(path){
    const list=SUBMAP[path]||[];
    subInner.innerHTML=list.map(i=>`<a class="sub" data-owner=\"${path}\" href=\"${i.href}\">${i.text}</a>`).join('');
  }
  function highlightActive(){ links.forEach(a=>a.classList.toggle('active',a.dataset.path===lockedPath)); }
  function updateSubRowMinHeight(){
    const textH=subInner.getBoundingClientRect().height||0; const extra=5; subRow.style.minHeight=(textH+extra)+'px';
  }
  function ensureTabInk(){
    let ink=document.getElementById('tabInk');
    if(!ink){ ink=document.createElement('span'); ink.id='tabInk'; ink.className='tab-ink'; tabsEl.appendChild(ink); }
    return ink;
  }
  function positionTabInk(activeTabEl=null, animate=false){
    const ink = ensureTabInk();
    const a = activeTabEl || tabsEl.querySelector('.tab.active');
    if(!a){ ink.style.width='0px'; return; }
    const txt = a.querySelector('.tab__text') || a;
    const rect = txt.getBoundingClientRect(); const tabsRect = tabsEl.getBoundingClientRect();
    const padX  = cssVarNum('--tab-ink-pad-x',0); const ml    = cssVarNum('--tab-ink-ml',0);
    const left  = Math.round(rect.left - tabsRect.left + ml); const width = Math.max(2, Math.round(rect.width + padX*2));
    if(!animate){ const prev = ink.style.transition; ink.style.transition = 'none'; ink.style.width = width + 'px'; ink.style.transform = `translateX(${left}px)`; void ink.offsetWidth; ink.style.transition = prev || ''; }
    else{ ink.style.width = width + 'px'; ink.style.transform = `translateX(${left}px)`; }
  }

  // 事件
  links.forEach(a=>{
    a.addEventListener('pointerenter',()=>{ if(inSubRow) return; hoverPath=a.dataset.path; movePillToEl(a); renderSubPreview(hoverPath); });
    a.addEventListener('click',(e)=>{
      if(!USE_REAL_NAV) e.preventDefault();
      lockedPath=a.dataset.path; const firstSub=(SUBMAP[lockedPath]||[])[0];
      lockedSubHref=firstSub?firstSub.href:''; lockedTabHref=TABMAP[lockedSubHref] ? (DEFAULT_TAB_BY_SUB[lockedSubHref]||'') : '';
      localStorage.setItem(STORAGE_KEY, JSON.stringify({v:SCHEMA_VERSION,lockedPath,lockedSubHref,lockedTabHref,ts:Date.now()}));
      hoverPath=lockedPath; highlightActive(); renderSub(lockedPath);
      if(USE_REAL_NAV && lockedSubHref) window.location.href=lockedSubHref;
      fitTableHeight();
    });
  });
  track.addEventListener('pointerleave',()=>{
    clearTimeout(leaveTimer);
    leaveTimer=setTimeout(()=>{ if(!inSubRow){ hoverPath=lockedPath; movePillToEl(links.find(x=>x.dataset.path===lockedPath)||links[0]); renderSub(lockedPath); fitTableHeight(); } }, 220);
  });
  subRow.addEventListener('pointerenter',()=>{ inSubRow=true; clearTimeout(leaveTimer); });
  subRow.addEventListener('pointerleave',()=>{ inSubRow=false; hoverPath=lockedPath; movePillToEl(links.find(x=>x.dataset.path===lockedPath)||links[0]); renderSub(lockedPath); fitTableHeight(); });
  subInner.addEventListener('pointerover',(e)=>{
    const s=e.target.closest('a.sub'); if(!s) return;
    const ownerEl=links.find(a=>a.dataset.path===s.getAttribute('data-owner'));
    if(ownerEl) movePillToEl(ownerEl);
  });
  tabsEl.addEventListener('click',(e)=>{
    const t=e.target.closest('a.tab'); if(!t) return;
    if(!USE_REAL_NAV) e.preventDefault();
    tabsEl.querySelectorAll('.tab').forEach(a=>a.classList.remove('active')); t.classList.add('active');
    lockedTabHref=t.getAttribute('href')||'';
    localStorage.setItem(STORAGE_KEY, JSON.stringify({v:SCHEMA_VERSION,lockedPath,lockedSubHref,lockedTabHref,ts:Date.now()}));
    positionTabInk(t, true);
    const subHref = t.getAttribute('data-sub') || lockedSubHref;
    if(lockedTabHref.endsWith('/logs')) renderLabelUploadLogsPanel();
    else if(lockedTabHref.endsWith('/list')) renderLabelUploadListCardAndTable();
    else showPlaceholder(subHref);
    fitTableHeight();
  });
  function showPlaceholder(subHref){
    tabCard.classList.remove('no-tabs'); tableWrap.classList.add('hidden'); logsTableWrap.classList.add('hidden'); footerBar.classList.add('hidden');
    const tabsData=TABMAP[subHref]||[]; const activeTab=tabsData.find(t=>t.href===lockedTabHref);
    tabPanel.innerHTML=`<div>当前：<strong>${(SUBMAP[lockedPath]||[]).find(s=>s.href===subHref)?.text||''}</strong> &rsaquo; <strong>${activeTab?.text||''}</strong></div><div style="margin-top:12px;color:#64748b;">（此处为 <em>${activeTab?.text||''}</em> 的内容占位）</div>`;
  }

  function renderTabs(subHref){
    const tabsData=TABMAP[subHref]||[];
    if(!tabsData.length){ tabsEl.innerHTML=''; tabPanel.innerHTML=''; return; }
    if(!lockedTabHref || !tabsData.some(t=>t.href===lockedTabHref)){
      lockedTabHref=DEFAULT_TAB_BY_SUB[subHref]||tabsData[0].href;
    }
    tabsEl.innerHTML = tabsData.map(t=>
      `<a class="tab ${t.href===lockedTabHref?'active':''}" data-sub="${subHref}" data-key="${t.key}" href="${t.href}"><span class="tab__text">${t.text}</span></a>`
    ).join('');
    ensureTabInk();
    // 内容
    if(lockedTabHref.endsWith('/logs')) renderLabelUploadLogsPanel(); else renderLabelUploadListCardAndTable();
    requestAnimationFrame(()=>positionTabInk(tabsEl.querySelector('.tab.active'), false));
  }

  // 初始状态
  (function init(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw){
        const obj=JSON.parse(raw);
        if(obj && obj.v===SCHEMA_VERSION && obj.lockedPath && SUBMAP[obj.lockedPath]){
          lockedPath=obj.lockedPath; lockedSubHref=obj.lockedSubHref||''; lockedTabHref=obj.lockedTabHref||'';
        }
      }
    }catch{}
    if(!lockedSubHref){ const firstSub=(SUBMAP[lockedPath]||[])[0]; lockedSubHref=firstSub?firstSub.href:''; }
    hoverPath=lockedPath;
    movePillToEl(links.find(a=>a.dataset.path===lockedPath)||links[0]);
    renderSub(lockedPath);
    highlightActive();
    window.addEventListener('resize', ()=>{ fitTableHeight(); positionTabInk(tabsEl.querySelector('.tab.active'), false);} );
  })();

  // ========== 列表页：生成筛选卡片 + API 绑定 ==========
  function renderLabelUploadListCardAndTable(){
    currentTabContext='labelList';
    toggleFooterSelectionControls(true);
    tabCard.classList.remove('no-tabs');
    tabPanel.innerHTML=`
      <div class="toolbar" id="luToolbar">
        <div class="toolbar-left">
          <div class="range">
            <select class="select" id="timeField">
              <option value="created">创建时间</option>
              <option value="printed">打印时间</option>
            </select>
            <input type="datetime-local" class="input input--dt" id="startTime">
            <span>—</span>
            <input type="datetime-local" class="input input--dt" id="endTime">
            <div class="dropdown" id="quickDrop">
              <button class="btn" id="quickBtn">快捷时间 <span class="caret">▾</span></button>
              <div class="menu">
                <a href="#" data-days="1">近 1 天</a>
                <a href="#" data-days="3">近 3 天</a>
                <a href="#" data-days="7">近 7 天</a>
                <a href="#" data-days="15">近 15 天</a>
                <a href="#" data-days="30">近 30 天</a>
              </div>
            </div>
          </div>
          <select class="select" id="statusSel">
            <option value="">面单状态</option>
            <option>已预报</option>
            <option>待映射订单号</option>
            <option>待导入面单</option>
            <option>待换单</option>
            <option>已换单</option>
            <option>已作废</option>
          </select>
          <select class="select" id="shipSel">
            <option value="">运输方式</option>
            <option>USPS</option>
            <option>JC</option>
          </select>
          <button type="button" id="resetBtn" class="select" title="重置筛选">重置</button>
        </div>
        <div class="toolbar-actions">
          <input class="input input--search" id="kw" placeholder="单号搜索 / 双击批量搜索">
          <button class="btn btn--black" id="searchBtn">搜索</button>
          <div class="dropdown" id="bulkDrop">
            <button class="btn btn--black" id="bulkBtn">批量操作 <span class="caret">▾</span></button>
            <div class="menu">
              <a href="#" data-act="import-label">导入面单</a>
              <a href="#" data-act="import-map">导入单号映射</a>
              <a href="#" data-act="delete">批量删除</a>
              <a href="#" data-act="export-orders">订单导出</a>
              <a href="#" data-act="copy-waybill">批量复制单号</a>
              <a href="#" data-act="batch-print">批量打印</a>
              <a href="#" data-act="batch-activate">批量激活</a>
              <a href="#" data-act="batch-void">批量作废</a>
            </div>
          </div>
        </div>
      </div>`;

    tableWrap.classList.remove('hidden'); logsTableWrap.classList.add('hidden'); footerBar.classList.remove('hidden');

    bindLabelUploadEvents(); // 挂事件
    // 初次加载数据
    pageSize=parseInt(pageSizeSel.value,10)||50; pageIndex=1;
    fetchAndRender();
  }

  function enhanceDateInputs(inputs){ inputs.forEach(inp=>{ if(!inp) return; if(typeof inp.showPicker === 'function'){ inp.addEventListener('click', (e)=>{ e.preventDefault(); inp.showPicker(); }); inp.addEventListener('keydown', (e)=>{ if(e.key!=='Tab') e.preventDefault(); }); }}); }
  function toggleFooterSelectionControls(show){ [selAll, selInvert, selCounter].forEach(el=>{ if(el) el.classList.toggle('hidden', !show); }); }
  function fitTableHeight(){
    requestAnimationFrame(()=>{
      const wrap = document.querySelector('.table-wrap:not(.hidden)'); if(!wrap) return;
      const scroller = wrap.querySelector('.table-scroll'); if(!scroller) return;
      const top = scroller.getBoundingClientRect().top;
      const footerTop = footerBar.classList.contains('hidden') ? window.innerHeight : footerBar.getBoundingClientRect().top;
      const h = Math.max(120, Math.floor(footerTop - top - 12)); scroller.style.maxHeight = h + 'px'; scroller.style.height = h + 'px';
    });
  }

  function bindLabelUploadEvents(){
    const bulkDrop=document.getElementById('bulkDrop'), bulkBtn=document.getElementById('bulkBtn');
    const startTime=document.getElementById('startTime'), endTime=document.getElementById('endTime');
    const statusSel=document.getElementById('statusSel'), shipSel=document.getElementById('shipSel');
    const kw=document.getElementById('kw'), searchBtn=document.getElementById('searchBtn');
    const quickDrop=document.getElementById('quickDrop'), quickBtn=document.getElementById('quickBtn');
    const timeField=document.getElementById('timeField'); const resetBtn=document.getElementById('resetBtn');

    enhanceDateInputs([startTime,endTime]);

    // 快捷时间
    if(quickBtn && quickDrop){
      quickBtn.addEventListener('click',(e)=>{ e.stopPropagation(); const willOpen = !quickDrop.classList.contains('open'); document.querySelectorAll('.dropdown.open').forEach(x=>x.classList.remove('open')); quickDrop.classList.toggle('open', willOpen); });
      quickDrop.querySelectorAll('.menu a').forEach(a=>{ a.addEventListener('click',(e)=>{ e.preventDefault(); const days=parseInt(a.dataset.days||'',10); if(Number.isFinite(days)){ const to=new Date(); const from=new Date(to.getTime()-days*86400000); startTime.value=toLocal(from); endTime.value=toLocal(to);} document.querySelectorAll('.dropdown.open').forEach(x=>x.classList.remove('open')); fetchAndRender(); }); });
    }
    // 搜索
    if(searchBtn) searchBtn.addEventListener('click', ()=>{ pageIndex=1; fetchAndRender(); });
    if(kw){ kw.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ pageIndex=1; fetchAndRender(); } }); kw.addEventListener('dblclick', ()=>{ bulkText.value=''; openModal(bulkModal, kw); bulkText.focus(); }); }
    if(bulkCancel) bulkCancel.addEventListener('click', ()=> closeModal(bulkModal));
    if(bulkApply) bulkApply.addEventListener('click', ()=>{ const ids = bulkText.value.split(/\\s+/).map(s=>s.trim()).filter(Boolean); if(ids.length){ kw.value = ids.join(' ');} closeModal(bulkModal); pageIndex=1; fetchAndRender(); });

    // 批量操作
    if(bulkBtn && bulkDrop){
      bulkBtn.addEventListener('click',(e)=>{ e.stopPropagation(); const willOpen = !bulkDrop.classList.contains('open'); document.querySelectorAll('.dropdown.open').forEach(x=>x.classList.remove('open')); bulkDrop.classList.toggle('open', willOpen); });
      bulkDrop.querySelectorAll('.menu a').forEach(a=>{ a.addEventListener('click', async (e)=>{
        e.preventDefault();
        const act=a.dataset.act||'';
        if(act==='import-label'){
          openUpload('面单文件', async (file)=>{ await api('/api/v1/labels/import',{ method:'POST', body: formData({file}) }); fetchAndRender(); });
        }else if(act==='import-map'){
          openUpload('单号映射（CSV/XLSX）', async (file)=>{ await api('/api/v1/labels/import-mapping',{ method:'POST', body: formData({file}) }); fetchAndRender(); });
        }else if(act==='batch-void'){
          const nos = Array.from(selectedIds).map(id=>{ const tr = document.querySelector(`tr[data-id=\"${id}\"] .col-waybill`)?.textContent||''; return tr; }).filter(Boolean);
          await api('/api/v1/labels/bulk-void?voided=true',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(nos) }); fetchAndRender();
        }else if(act==='batch-activate'){
          const nos = Array.from(selectedIds).map(id=>{ const tr = document.querySelector(`tr[data-id=\"${id}\"] .col-waybill`)?.textContent||''; return tr; }).filter(Boolean);
          await api('/api/v1/labels/bulk-void?voided=false',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(nos) }); fetchAndRender();
        }else if(act==='delete'){
          alert('演示：删除操作已禁用（建议逻辑为作废而非物删）');
        }else if(act==='copy-waybill'){
          const txt = getSelectedRows().map(r=>r.waybill).filter(Boolean).join('\\n'); await copyToClipboard(txt); alert(`已复制 ${getSelectedRows().length} 个运单号`);
        }else{
          alert('占位操作 ' + act);
        }
        document.querySelectorAll('.dropdown.open').forEach(x=>x.classList.remove('open'));
      }); });
    }

    if(resetBtn) resetBtn.addEventListener('click', ()=>{ startTime.value=''; endTime.value=''; document.getElementById('kw').value=''; timeField.value='created'; document.getElementById('statusSel').value=''; document.getElementById('shipSel').value=''; pageIndex=1; fetchAndRender(); });

    // 全局一次性绑定
    if(!bindLabelUploadEvents._bound){
      bindLabelUploadEvents._bound = true;
      const chkAll=document.getElementById('chkAll');
      if(chkAll) chkAll.addEventListener('change',()=>{ if(currentTabContext!=='labelList') return; const slice=getCurrentPageRows(); if(chkAll.checked){ slice.forEach(r=>selectedIds.add(r.id)); } else { slice.forEach(r=>selectedIds.delete(r.id)); } updateCurrentPageSelectionUI(); });
      tbodyEl.addEventListener('change',(e)=>{ if(currentTabContext!=='labelList') return; if(e.target && e.target.matches('input.rowchk')){ const id = +e.target.getAttribute('data-id'); if(e.target.checked) selectedIds.add(id); else selectedIds.delete(id); syncHeaderCheckbox(); updateSelCounter(); const tr=e.target.closest('tr'); if(tr) tr.classList.toggle('selected', e.target.checked); } });
      pageSizeSel.addEventListener('change',()=>{ pageSize=parseInt(pageSizeSel.value,10)||50; pageIndex=1; renderTable(); fitTableHeight(); });
      firstPage.addEventListener('click',(e)=>{ e.preventDefault(); pageIndex=1; renderTable(); fitTableHeight(); });
      prevPage .addEventListener('click',(e)=>{ e.preventDefault(); pageIndex=Math.max(1,pageIndex-1); renderTable(); fitTableHeight(); });
      nextPage .addEventListener('click',(e)=>{ e.preventDefault(); pageIndex=Math.min(totalPages(),pageIndex+1); renderTable(); fitTableHeight(); });
      lastPage .addEventListener('click',(e)=>{ e.preventDefault(); pageIndex=totalPages(); renderTable(); fitTableHeight(); });
      jumpTo   .addEventListener('change',()=>{ const p=+jumpTo.value||1; pageIndex=Math.min(Math.max(1,p),totalPages()); renderTable(); fitTableHeight(); });
      selAll.addEventListener('click',(e)=>{ e.preventDefault(); const slice=getCurrentPageRows(); slice.forEach(r=>selectedIds.add(r.id)); updateCurrentPageSelectionUI(); });
      selInvert.addEventListener('click',(e)=>{ e.preventDefault(); const slice=getCurrentPageRows(); slice.forEach(r=>{ if(selectedIds.has(r.id)) selectedIds.delete(r.id); else selectedIds.add(r.id); }); updateCurrentPageSelectionUI(); });
      logsTbody.addEventListener('click', async (e)=>{
        const btn = e.target.closest('button.log-view'); if(!btn) return;
        const id = Number(btn.dataset.id); const row = logsMasterRows.find(x=>x.id===id);
        if(row){
          openUploadLogModal(row, 'fail');
          try{
            const data = await api(`/api/v1/labels/logs/${id}/detail?mode=fail`);
            const ta = document.getElementById('logListBox'); if(ta) ta.value = data.list || '';
            opConfirm.onclick = async ()=>{ await copyToClipboard(ta.value); closeModal(opModal); };
          }catch{}
        }
      });
    }
  }

  function formData(map){
    const fd = new FormData();
    for(const k in map){
      const v = map[k];
      if(v instanceof File) fd.append(k, v, v.name);
      else fd.append(k, v);
    }
    return fd;
  }
  async function openUpload(title, onPicked){
    currentAction = 'upload';
    opTitle.textContent = title;
    opContent.innerHTML = `<div>选择文件：</div><div style="margin-top:8px"><input id="uploadInput" type="file"></div>`;
    openModal(opModal);
    const input = () => opContent.querySelector('#uploadInput');
    const handler = async ()=>{ const f = input().files[0]; if(f){ await onPicked(f); closeModal(opModal);} };
    opConfirm.onclick = handler;
  }

  // API 加载 & 渲染
  async function fetchAndRender(){
    const params = new URLSearchParams();
    const tf = document.getElementById('timeField')?.value || 'created';
    const start = document.getElementById('startTime').value;
    const end = document.getElementById('endTime').value;
    const status = document.getElementById('statusSel').value;
    const ship = document.getElementById('shipSel').value;
    const kw = document.getElementById('kw').value;
    if(start) params.set('start', start);
    if(end) params.set('end', end);
    if(status) params.set('status', status);
    if(ship) params.set('ship', ship);
    if(kw) params.set('q', kw);
    params.set('time_field', tf);
    params.set('page', String(pageIndex));
    params.set('size', String(pageSize));
    const data = await api('/api/v1/labels/list?' + params.toString());
    masterRows = data.items.map((it)=>{
      return {
        id: it.id, orderNo: it.orderNo || '', waybill: it.waybill, transNo: it.transNo || '',
        ship: it.ship || '', file: it.file || '', status: it.status || '',
        createdAt: it.createdAt ? new Date(it.createdAt) : null,
        printedAt: it.printedAt ? new Date(it.printedAt) : null, voided: !!it.voided
      };
    });
    viewRows = masterRows.slice();
    sortRows(); renderTable(); fitTableHeight();
  }

  function totalPages(){ return Math.max(1, Math.ceil(viewRows.length/pageSize)); }
  function getCurrentPageRows(){ const start=(pageIndex-1)*pageSize; return viewRows.slice(start, start+pageSize); }
  function getSelectedRows(){ return masterRows.filter(r=>selectedIds.has(r.id)); }
  function updateSelCounter(){ if(selCounter) selCounter.textContent = `已选择 ${selectedIds.size} 条`; }
  function syncHeaderCheckbox(){
    const head=document.getElementById('chkAll');
    const slice=getCurrentPageRows();
    const total=slice.length;
    const sel = slice.filter(r=>selectedIds.has(r.id)).length;
    head.indeterminate = sel>0 && sel<total;
    head.checked = total>0 && sel===total;
  }
  function updateCurrentPageSelectionUI(){
    const slice = getCurrentPageRows(); const ids = new Set(slice.map(r=>r.id));
    tbodyEl.querySelectorAll('tr').forEach(tr=>{
      const id = Number(tr.getAttribute('data-id')); if(!ids.has(id)) return;
      const checked = selectedIds.has(id);
      const cb = tr.querySelector('input.rowchk'); if(cb) cb.checked = checked;
      tr.classList.toggle('selected', checked);
    });
    syncHeaderCheckbox(); updateSelCounter();
  }
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
    if(bs){ bs.classList.toggle('active', sortKey==='status'); bs.querySelector('.ind').textContent = sortKey==='status' ? (sortDir==='asc'?'↑':'↓') : '⇅'; bs.setAttribute('aria-label', sortKey==='status' ? `按状态${sortDir==='asc'?'升序':'降序'}` : '按状态排序'); }
    if(bt){ bt.classList.toggle('active', sortKey==='time'  ); bt.querySelector('.ind').textContent = sortKey==='time'   ? (sortDir==='asc'?'↑':'↓') : '⇅'; bt.setAttribute('aria-label', sortKey==='时间' ? `按时间${sortDir==='asc'?'升序':'降序'}` : '按时间排序'); }
    if(thStatus) thStatus.setAttribute('aria-sort', sortKey==='status'?(sortDir==='asc'?'ascending':'descending'):'none');
    if(thTime)   thTime  .setAttribute('aria-sort', sortKey==='time'  ?(sortDir==='asc'?'ascending':'descending'):'none');
  }
  function renderTable(){
    const start=(pageIndex-1)*pageSize, slice=viewRows.slice(start,start+pageSize);
    tbodyEl.innerHTML='';
    let i = 0;
    function chunk(){
      const frag = document.createDocumentFragment();
      for(let c=0;c<50 && i<slice.length;c++,i++){
        const r = slice[i];
        const tr = document.createElement('tr'); tr.setAttribute('data-id', String(r.id));
        if(selectedIds.has(r.id)) tr.classList.add('selected'); if(r.voided) tr.classList.add('voided');
        const tdChk = document.createElement('td'); tdChk.className='col-chk'; tdChk.innerHTML = `<input type="checkbox" class="chk rowchk" data-id="${r.id}" ${selectedIds.has(r.id)?'checked':''}>`;
        const tdOrder = document.createElement('td'); tdOrder.className='col-order';   tdOrder.textContent = r.orderNo||'';
        const tdWay   = document.createElement('td'); tdWay.className  ='col-waybill'; tdWay.textContent   = r.waybill;
        const tdTrans = document.createElement('td'); tdTrans.className='col-trans';   tdTrans.textContent = r.transNo||'';
        const tdShip  = document.createElement('td'); tdShip.className ='col-ship';    tdShip.textContent  = r.ship||'-';
        const tdFile  = document.createElement('td'); tdFile.className ='col-file';    tdFile.textContent  = r.file || '-';
        const tdStat  = document.createElement('td'); tdStat.className ='col-status';  tdStat.textContent  = r.status + (r.voided?'｜已作废':'');
        const tdTime  = document.createElement('td'); tdTime.className ='col-created';
        tdTime.innerHTML = `<div class="time2"><div>创建时间：${h(formatDateTime(r.createdAt))}</div><div>打印时间：${h(formatDateTime(r.printedAt))}</div></div>`;
        const tdOp    = document.createElement('td'); tdOp.className='col-op';
        const prevBtn = document.createElement('button'); prevBtn.type='button'; prevBtn.className='btn-link preview'; prevBtn.textContent='预览';
        prevBtn.addEventListener('click', ()=>{ if(r.file){ window.open('/api/v1/file/' + encodeURIComponent(r.waybill), '_blank'); } });
        const toggleBtn = document.createElement('button'); toggleBtn.type='button'; toggleBtn.className='btn-link toggle-void'; toggleBtn.dataset.id = String(r.id);
        toggleBtn.textContent = r.voided ? '激活' : '作废';
        toggleBtn.addEventListener('click', async ()=>{
          await api('/api/v1/labels/bulk-void?voided=' + String(!r.voided), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify([r.waybill]) });
          fetchAndRender();
        });
        tdOp.appendChild(prevBtn); tdOp.appendChild(toggleBtn);
        tr.appendChild(tdChk); tr.appendChild(tdOrder); tr.appendChild(tdWay); tr.appendChild(tdTrans);
        tr.appendChild(tdShip); tr.appendChild(tdFile); tr.appendChild(tdStat); tr.appendChild(tdTime); tr.appendChild(tdOp);
        frag.appendChild(tr);
      }
      tbodyEl.appendChild(frag);
      if(i<slice.length){ requestAnimationFrame(chunk); }
    }
    requestAnimationFrame(chunk);

    pageInfo.textContent=`共 ${viewRows.length} 条 ${pageIndex}/${totalPages()} 页`; jumpTo.value=pageIndex;
    const pages=totalPages(); const nums=[]; const s=Math.max(1,pageIndex-2), e=Math.min(pages,pageIndex+2);
    for(let i=s;i<=e;i++){ nums.push(`<a href="#" data-p="${i}" style="${i===pageIndex?'font-weight:700;text-decoration:underline':''}">${i}</a>`); }
    pageNums.innerHTML=nums.join(''); pageNums.querySelectorAll('a').forEach(a=>a.addEventListener('click',(e)=>{ e.preventDefault(); pageIndex=+a.dataset.p; renderTable(); fitTableHeight(); }));
    syncHeaderCheckbox(); fitTableHeight(); updateSelCounter();
    updateSortBtnsUI();
  }

  // 排序按钮
  const bs=document.getElementById('sortStatus'), bt=document.getElementById('sortTime');
  if(bs) bs.addEventListener('click', ()=>{ if(currentTabContext!=='labelList') return; if(sortKey==='status'){ sortDir = (sortDir==='asc'?'desc':'asc'); } else { sortKey='status'; sortDir='asc'; } sortRows(); pageIndex=1; renderTable(); updateSortBtnsUI(); });
  if(bt) bt.addEventListener('click', ()=>{ if(currentTabContext!=='labelList') return; if(sortKey==='time'){ sortDir = (sortDir==='asc'?'desc':'asc'); } else { sortKey='time'; sortDir='desc'; } sortRows(); pageIndex=1; renderTable(); updateSortBtnsUI(); });

  // ========== 上传记录页 ==========
  function renderLabelUploadLogsPanel(){
    currentTabContext='logs'; toggleFooterSelectionControls(false);
    tabCard.classList.remove('no-tabs');
    tabPanel.innerHTML=`
      <div class="toolbar" id="logsToolbar">
        <div class="toolbar-left">
          <div class="range">
            <input type="datetime-local" class="input input--dt" id="logsStart">
            <span>—</span>
            <input type="datetime-local" class="input input--dt" id="logsEnd">
            <div class="dropdown" id="logsQuickDrop">
              <button class="btn" id="logsQuickBtn">快捷时间 <span class="caret">▾</span></button>
              <div class="menu">
                <a href="#" data-days="1">近 1 天</a>
                <a href="#" data-days="3">近 3 天</a>
                <a href="#" data-days="7">近 7 天</a>
                <a href="#" data-days="15">近 15 天</a>
                <a href="#" data-days="30">近 30 天</a>
              </div>
            </div>
          </div>
          <button type="button" id="logsResetBtn" class="select" title="重置筛选">重置</button>
        </div>
      </div>`;
    tableWrap.classList.add('hidden'); logsTableWrap.classList.remove('hidden'); footerBar.classList.remove('hidden');
    bindLogsEvents(); pageSize=parseInt(pageSizeSel.value,10)||50; logsPageIndex=1; fetchLogsAndRender();
  }

  function bindLogsEvents(){
    const s=document.getElementById('logsStart'), e=document.getElementById('logsEnd');
    const quickDrop=document.getElementById('logsQuickDrop'), quickBtn=document.getElementById('logsQuickBtn');
    const resetBtn=document.getElementById('logsResetBtn');
    enhanceDateInputs([s,e]);
    if(quickBtn && quickDrop){
      quickBtn.addEventListener('click',(ev)=>{ ev.stopPropagation(); const willOpen = !quickDrop.classList.contains('open'); document.querySelectorAll('.dropdown.open').forEach(x=>x.classList.remove('open')); quickDrop.classList.toggle('open', willOpen); });
      quickDrop.querySelectorAll('.menu a').forEach(a=>{ a.addEventListener('click',(e2)=>{ e2.preventDefault(); const days=parseInt(a.dataset.days||'',10); if(Number.isFinite(days)){ const to=new Date(); const from=new Date(to.getTime()-days*86400000); s.value=toLocal(from); e.value=toLocal(to); } document.querySelectorAll('.dropdown.open').forEach(x=>x.classList.remove('open')); fetchLogsAndRender(); }); });
    }
    if(resetBtn) resetBtn.addEventListener('click', ()=>{ s.value=''; e.value=''; fetchLogsAndRender(); });
  }

  async function fetchLogsAndRender(){
    const params = new URLSearchParams();
    const s=document.getElementById('logsStart').value, e=document.getElementById('logsEnd').value;
    if(s) params.set('start', s); if(e) params.set('end', e);
    params.set('page', String(logsPageIndex)); params.set('size', String(pageSize));
    const data = await api('/api/v1/labels/logs?' + params.toString());
    logsMasterRows = data.items.map(it=>({ id: it.id, time: it.time, file: it.file, type: it.type, total: it.total, success: it.success, fail: it.fail, operator: it.operator }));
    renderLogsTable();
  }
  function renderLogsTable(){
    const start=(logsPageIndex-1)*pageSize, slice=logsMasterRows.slice(start, start+pageSize);
    logsTbody.innerHTML = slice.map(r=>`
      <tr data-id="${r.id}">
        <td>${h(r.time)}</td><td>${h(r.file)}</td><td>${h(r.type)}</td>
        <td>${r.total}</td><td>${r.success}</td><td>${r.fail}</td>
        <td>${h(r.operator)}</td>
        <td><button class="btn-link log-view" data-id="${r.id}" title="查看上传日志">查看</button></td>
      </tr>`).join('');
    pageInfo.textContent=`共 ${logsMasterRows.length} 条 ${logsPageIndex}/${totalPagesLogs()} 页`; jumpTo.value=logsPageIndex;
    const pages=totalPagesLogs(); const nums=[]; const sIdx=Math.max(1,logsPageIndex-2), eIdx=Math.min(pages,logsPageIndex+2);
    for(let i=sIdx;i<=eIdx;i++){ nums.push(`<a href="#" data-p="${i}" style="${i===logsPageIndex?'font-weight:700;text-decoration:underline':''}">${i}</a>`); }
    pageNums.innerHTML=nums.join(''); pageNums.querySelectorAll('a').forEach(a=>a.addEventListener('click',(e)=>{ e.preventDefault(); logsPageIndex=+a.dataset.p; renderLogsTable(); fitTableHeight(); }));
    fitTableHeight();
  }
  function totalPagesLogs(){ return Math.max(1, Math.ceil(logsMasterRows.length/pageSize)); }
  function openUploadLogModal(row, mode='fail'){
    currentLogsMode = mode;
    // 简化：服务端保留了完整号段（换行文本）；此处改为即时获取
    opTitle.textContent = `上传日志（${row.type}｜${row.file}）`;
    opContent.innerHTML = `<div style="display:flex;gap:8px;margin:6px 0 10px;">
      <button type="button" class="btn ${mode==='success'?'btn--black':''}" data-logtab="success">成功（${row.success}）</button>
      <button type="button" class="btn ${mode==='fail'?'btn--black':''}" data-logtab="fail">失败（${row.fail}）</button>
      <span style="margin-left:auto;color:#64748b;">点击“确认”复制当前列表</span></div>
      <textarea id="logListBox" readonly>（由于数据量可能较大，建议在后台导出号段文本）</textarea>`;
    currentAction = 'copy-upload-logs'; openModal(opModal);
  }

  // ========== 弹窗 + 页面可达性 ==========
  let lastTrigger=null;
  function queryFocusable(container){ return [...container.querySelectorAll('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled && el.offsetParent!==null); }
  function setPageInert(inertOn){
    const nodes = [document.querySelector('.shell'), document.querySelector('.subrow'), document.querySelector('.tabrow'), document.getElementById('footerBar')].filter(Boolean);
    nodes.forEach(el=>{ if(inertOn){ el.setAttribute('inert',''); } else { el.removeAttribute('inert'); }});
    document.documentElement.style.overflow = inertOn ? 'hidden' : '';
  }
  function openModal(modal, opener=null){
    lastTrigger = opener || document.activeElement;
    modal.style.display = 'flex'; setPageInert(true);
    const box = modal.querySelector('.box'); box && box.focus();
    function trap(e){
      if(e.key!=='Tab') return;
      const focusables = queryFocusable(modal); if(!focusables.length) return;
      const first=focusables[0], last=focusables[focusables.length-1];
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
    }
    function esc(e){ if(e.key==='Escape'){ e.preventDefault(); closeModal(modal); } }
    function outside(e){ if(e.target===modal){ closeModal(modal); } }
    modal._trap = trap; modal._esc = esc; modal._outside = outside;
    modal.addEventListener('keydown', trap); document.addEventListener('keydown', esc); modal.addEventListener('click', outside);
  }
  function closeModal(modal){
    modal.style.display='none';
    modal.removeEventListener('keydown', modal._trap||(()=>{}));
    document.removeEventListener('keydown', modal._esc||(()=>{}));
    modal.removeEventListener('click', modal._outside||(()=>{}));
    setPageInert(false);
    if(lastTrigger && typeof lastTrigger.focus==='function'){ lastTrigger.focus(); }
  }
  opCancel.addEventListener('click', ()=> closeModal(opModal));
  opConfirm.addEventListener('click', async ()=>{
    if(currentAction==='copy-upload-logs'){
      // 留空：仅关闭
      closeModal(opModal); return;
    }
  });

  function positionInit(){
    // 初始定位胶囊
    movePillToEl(links.find(a=>a.dataset.path===lockedPath)||links[0]);
  }
  positionInit();

})();
async function copyToClipboard(text){ try{ await navigator.clipboard.writeText(text||''); }catch(e){ const ta=document.createElement('textarea'); ta.value=text||''; ta.style.position='fixed'; ta.style.left='-9999px'; document.body.appendChild(ta); ta.focus(); ta.select(); try{ document.execCommand('copy'); }finally{ document.body.removeChild(ta); } } }
