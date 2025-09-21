import { upgradeSelectToMenu } from '/static/js/core/select_enhance.js';
import { closeAllMenus } from '/static/js/core/dropdown.js';
import { openModal, closeModal } from '/static/js/core/modal.js';
import { ensureTabInk, positionTabInk } from '/static/js/core/tabs_ink.js';
import { chunkRender } from '/static/js/utils/chunk_render.js';
import { enhanceDateInputs } from '/static/js/utils/time_picker_native.js';
import { copyToClipboard } from '/static/js/utils/clip.js';

const SCHEMA_VERSION = 11;
const STORAGE_KEY_NEW = 'NAV_STATE_V11';
const GRACE_MS = 220;

// DOM
const track=document.getElementById('navTrack'), pill=document.getElementById('pill');
const links=[...document.querySelectorAll('.link')];
const subRow=document.getElementById('subRow'), subInner=document.getElementById('subInner');
const tabsEl=document.getElementById('tabs'), tabCard=document.getElementById('tabCard'), tabPanel=document.getElementById('tabPanel');
const tableWrap=document.getElementById('tableWrap'), tbodyEl=document.getElementById('luTbody');
const logsTableWrap=document.getElementById('logsTableWrap'), logsTbody=document.getElementById('logsTbody');
const footerBar=document.getElementById('footerBar');

const pageSizeSel=document.getElementById('pageSize'), pageInfo=document.getElementById('pageInfo'), pageNums=document.getElementById('pageNums');
const firstPage=document.getElementById('firstPage'), prevPage=document.getElementById('prevPage'), nextPage=document.getElementById('nextPage'), lastPage=document.getElementById('lastPage');
const jumpTo=document.getElementById('jumpTo'); const goTop=document.getElementById('goTop');
const selAll=document.getElementById('selAll'), selInvert=document.getElementById('selInvert'); const selCounter=document.getElementById('selCounter');

const bulkModal=document.getElementById('bulkModal'), bulkText=document.getElementById('bulkText');
const bulkCancel=document.getElementById('bulkCancel'), bulkApply=document.getElementById('bulkApply');
const opModal=document.getElementById('opModal'), opTitle=document.getElementById('opTitle'), opContent=document.getElementById('opContent');
const opCancel=document.getElementById('opCancel'), opConfirm=document.getElementById('opConfirm');

let lockedPath='/orders', lockedSubHref='', lockedTabHref=''; let hoverPath=lockedPath, inSubRow=false;
let currentTabContext='labelList'; let selectedIds = new Set();

const SUBMAP={
  '/orders':[
    {text:'预报',href:'/orders/prealert'},
    {text:'订单列表',href:'/orders/list'},
    {text:'面单上传',href:'/orders/label-upload'},
    {text:'订单轨迹',href:'/orders/track'},
    {text:'订单规则',href:'/orders/rules'},
  ],
  '/products':[
    {text:'商品列表',href:'/products/list'},
    {text:'定制规则',href:'/products/custom-rules'},
  ],
  '/logistics':[
    {text:'物流规则',href:'/logistics/rules'},
    {text:'物流渠道',href:'/logistics/channels'},
    {text:'地址管理',href:'/logistics/address'},
  ],
  '/settings':[
    {text:'仓库设置',href:'/settings/warehouse'},
    {text:'服务商授权',href:'/settings/provider-auth'},
    {text:'店铺授权',href:'/settings/shop-auth'},
    {text:'客户端管理',href:'/settings/client'},
    {text:'系统设置',href:'/settings/system'},
  ],
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
const STATUS_ORDER = { '已预报':0, '待换单':1, '待导入面单':2, '待映射订单号':3, '已换单':4 };

// 工具
const _escMap = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' };
const h = (s)=>String(s==null?'':s).replace(/[&<>"']/g, m=>_escMap[m]);
function toLocal(d){ const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function formatDateTime(d){ if(!(d instanceof Date) || isNaN(d)) return '-'; const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }

// “首屏”初始化
(function init(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY_NEW);
    if(raw){
      const obj=JSON.parse(raw);
      if(obj && obj.v===SCHEMA_VERSION && obj.lockedPath && SUBMAP[obj.lockedPath]){
        lockedPath=obj.lockedPath; const okSub=Object.values(SUBMAP).flat().some(s=>s.href===obj.lockedSubHref); lockedSubHref=okSub?obj.lockedSubHref:'';
        if(lockedSubHref&&TABMAP[lockedSubHref]){
          const okTab=(TABMAP[lockedSubHref]||[]).some(t=>t.href===obj.lockedTabHref); lockedTabHref=okTab?obj.lockedTabHref:(DEFAULT_TAB_BY_SUB[lockedSubHref]||'');
        }else lockedTabHref='';
      }
    }
  }catch(e){}
  if(!lockedSubHref){ const firstSub=(SUBMAP[lockedPath]||[])[0]; lockedSubHref=firstSub?firstSub.href:''; }
  renderSub(lockedPath); highlightActive();
  window.addEventListener('resize', ()=>{ fitTableHeight(); positionTabInk(tabsEl.querySelector('.tab.active')); });
})();

function highlightActive(){ links.forEach(a=>a.classList.toggle('active',a.dataset.path===lockedPath)); }
function renderSub(path){
  const list=SUBMAP[path]||[];
  subInner.innerHTML=list.map(i=>`<a class="sub" data-owner="${path}" href="${i.href}">${i.text}</a>`).join('');
  if(lockedSubHref){ const t=[...subInner.querySelectorAll('.sub')].find(a=>a.getAttribute('href')===lockedSubHref); if(t) t.classList.add('active'); }

  if(TABMAP[lockedSubHref]) renderTabs(lockedSubHref);
  else{
    tabsEl.innerHTML=''; tabCard.classList.add('no-tabs'); tableWrap.classList.add('hidden'); logsTableWrap.classList.add('hidden'); footerBar.classList.add('hidden'); tabPanel.innerHTML='该二级暂无页签内容。';
  }
}
function renderTabs(subHref){
  const tabsData=TABMAP[subHref]||[];
  if(!lockedTabHref || !tabsData.some(t=>t.href===lockedTabHref)) lockedTabHref=DEFAULT_TAB_BY_SUB[subHref]||tabsData[0].href;
  tabsEl.innerHTML = tabsData.map(t=>`<a class="tab ${t.href===lockedTabHref?'active':''}" data-sub="${subHref}" data-key="${t.key}" href="${t.href}"><span class="tab__text">${t.text}</span></a>`).join('');
  updatePanelForActiveTab(subHref); positionTabInk(tabsEl.querySelector('.tab.active'));
}

function updatePanelForActiveTab(subHref){
  if(subHref==='/orders/label-upload'){
    if(lockedTabHref.endsWith('/logs')) renderLabelUploadLogsPanel();
    else renderLabelUploadListCardAndTable();
    return;
  }
  tabCard.classList.remove('no-tabs'); tableWrap.classList.add('hidden'); logsTableWrap.classList.add('hidden'); footerBar.classList.add('hidden');
  tabPanel.innerHTML='<div style="color:#64748b">（此处为占位内容）</div>';
}

// ===== 面单列表（演示数据） =====
let masterRows=[], viewRows=[], pageSize=50, pageIndex=1;
let sortKey='status', sortDir='asc';

function genDemoRows(n=100){
  const statuses=['已预报','待映射订单号','待导入面单','待换单','已换单']; const ships=['USPS','JC',''];
  const now=Date.now(); const rows=[];
  for(let i=1;i<=n;i++){
    const created=new Date(now - Math.floor(Math.random()*60)*86400000 - Math.floor(Math.random()*86400000));
    const printed=Math.random()<0.6 ? new Date(created.getTime()+Math.floor(Math.random()*3)*86400000 + Math.floor(Math.random()*86400000)) : null;
    const pad=(x,len)=>String(x).padStart(len,'0');
    rows.push({ id:i, orderNo:`OD${created.getFullYear()}${pad(created.getMonth()+1,2)}${pad(created.getDate(),2)}${pad(i,4)}`,
      waybill:`1Z${Math.random().toString(36).slice(2,10).toUpperCase()}${Math.floor(Math.random()*1e6)}`, transNo:`TR${pad(i,6)}`,
      ship:ships[Math.floor(Math.random()*ships.length)], file: Math.random() < 0.12 ? '' : `label_${pad(i,4)}.pdf`,
      status:statuses[Math.floor(Math.random()*statuses.length)], createdAt:created, printedAt:printed, voided:false });
  } return rows;
}

function renderLabelUploadListCardAndTable(){
  currentTabContext='labelList'; toggleFooterSelectionControls(true);
  tabCard.classList.remove('no-tabs');
  tabPanel.innerHTML=`
    <div class="toolbar" id="luToolbar">
      <div class="toolbar-left">
        <div class="range">
          <select class="select" id="timeField"><option value="created">创建时间</option><option value="printed">打印时间</option></select>
          <input type="datetime-local" class="input input--dt" id="startTime"><span>—</span><input type="datetime-local" class="input input--dt" id="endTime">
          <div class="dropdown" id="quickDrop"><button class="btn" id="quickBtn">快捷时间 <span class="caret">▾</span></button>
            <div class="menu"><a href="#" data-days="1">近 1 天</a><a href="#" data-days="3">近 3 天</a><a href="#" data-days="7">近 7 天</a><a href="#" data-days="15">近 15 天</a><a href="#" data-days="30">近 30 天</a></div>
          </div>
        </div>
        <select class="select" id="statusSel"><option value="">面单状态</option><option>已预报</option><option>待映射订单号</option><option>待导入面单</option><option>待换单</option><option>已换单</option><option>已作废</option></select>
        <select class="select" id="shipSel"><option value="">运输方式</option><option>USPS</option><option>JC</option></select>
        <button type="button" id="resetBtn" class="select" title="重置筛选">重置</button>
      </div>
      <div class="toolbar-actions">
        <input class="input input--search" id="kw" placeholder="单号搜索 / 双击批量搜索">
        <button class="btn btn--black" id="searchBtn">搜索</button>
        <div class="dropdown" id="bulkDrop"><button class="btn btn--black" id="bulkBtn">批量操作 <span class="caret">▾</span></button>
          <div class="menu">
            <a href="#" data-act="import-label">导入面单</a><a href="#" data-act="import-map">导入单号映射</a><a href="#" data-act="delete">批量删除</a>
            <a href="#" data-act="export-orders">订单导出</a><a href="#" data-act="copy-waybill">批量复制单号</a><a href="#" data-act="batch-print">批量打印</a>
            <a href="#" data-act="batch-activate">批量激活</a><a href="#" data-act="batch-void">批量作废</a>
          </div>
        </div>
      </div>
    </div>`;

  tableWrap.classList.remove('hidden'); logsTableWrap.classList.add('hidden'); footerBar.classList.remove('hidden');
  if(!masterRows.length) masterRows = genDemoRows(120); pageSize=parseInt(pageSizeSel.value,10)||50; pageIndex=1;
  bindLabelUploadEvents(); applyFilters(); fitTableHeight(); updateSortBtnsUI();
}

function renderLabelUploadLogsPanel(){
  currentTabContext='logs'; toggleFooterSelectionControls(false);
  tabCard.classList.remove('no-tabs');
  tabPanel.innerHTML=`
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
  tableWrap.classList.add('hidden'); logsTableWrap.classList.remove('hidden'); footerBar.classList.remove('hidden');
  if(!window.logsMasterRows){ window.logsMasterRows = genUploadLogs(36); } pageSize=parseInt(pageSizeSel.value,10)||50; window.logsPageIndex=1;
  bindLogsEvents(); applyLogsFilters(); fitTableHeight();
}

function genUploadLogs(n=20){
  const ops=['系统','王涛','Emma','Jack','Lucy','运营A'], types=['面单文件','运单号']; const out=[];
  for(let i=1;i<=n;i++){
    const d=new Date(Date.now()-Math.floor(Math.random()*45)*86400000 - Math.floor(Math.random()*10)*3600000);
    const pad=(x,len=2)=>String(x).padStart(len,'0'); const type=types[Math.random()<0.6?0:1]; const total=50+Math.floor(Math.random()*150);
    const success=30+Math.floor(Math.random()*(total-30)); const fail=Math.max(0,total-success);
    const mkWB=()=>`1Z${Math.random().toString(36).slice(2,10).toUpperCase()}${Math.floor(Math.random()*1e5)}`;
    const mkOD=(i)=>`OD${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(i,4)}`;
    const numsSucc=Array.from({length:success},(_,k)=> type==='运单号'? mkWB() : mkOD(k+1));
    const numsFail=Array.from({length:fail},(_,k)=> type==='运单号'? mkWB() : mkOD(k+2001));
    out.push({ id:i, time:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      file:`upload_${pad(d.getMonth()+1)}${pad(d.getDate())}_${String(Math.floor(Math.random()*9999)).padStart(4,'0')}.${type==='面单文件'?'xlsx':'txt'}`,
      type, total, success, fail, operator:ops[Math.floor(Math.random()*ops.length)], successNos:numsSucc, failNos:numsFail });
  } return out.sort((a,b)=>a.time<b.time?1:-1);
}

function applyFilters(){
  const timeField=document.getElementById('timeField')?.value||'created';
  const startVal=document.getElementById('startTime').value, endVal=document.getElementById('endTime').value;
  const statusSel=document.getElementById('statusSel').value.trim(), shipSel=document.getElementById('shipSel').value.trim();
  const kw=document.getElementById('kw').value.trim(); const picks=kw?kw.split(/\s+/).filter(Boolean).map(s=>s.toLowerCase()):[];
  const getDate=r=> timeField==='printed'? r.printedAt : r.createdAt;
  const startTs = startVal ? new Date(startVal).getTime() : null; const endTs   = endVal ? new Date(endVal).getTime() : null;
  viewRows=masterRows.filter(r=>{
    const d=getDate(r); const ts = d instanceof Date && !isNaN(d) ? +d : null;
    if(startTs!==null){ if(ts===null || ts<startTs) return false; }
    if(endTs!==null){   if(ts===null || ts>endTs)   return false; }
    if(statusSel){ if(statusSel==='已作废'){ if(!r.voided) return false; } else { if(r.status!==statusSel) return false; } }
    if(shipSel && r.ship!==shipSel) return false;
    if(picks.length){ const hay=(r.orderNo+' '+r.waybill+' '+r.transNo).toLowerCase(); let hit=false; for(let i=0;i<picks.length;i++){ if(hay.includes(picks[i])){ hit=true; break; } } if(!hit) return false; }
    return true; });
  sortRows(); pageIndex=1; renderTable();
}
function sortRows(){
  const tf = document.getElementById('timeField')?.value || 'created';
  viewRows.sort((a,b)=>{
    if(sortKey==='status'){ const av = STATUS_ORDER.hasOwnProperty(a.status)? STATUS_ORDER[a.status] : 99; const bv = STATUS_ORDER.hasOwnProperty(b.status)? STATUS_ORDER[b.status] : 99; return (av - bv) * (sortDir==='asc'?1:-1); }
    else if(sortKey==='time'){ const va = tf==='printed' ? a.printedAt : a.createdAt; const vb = tf==='printed' ? b.printedAt : b.createdAt;
      const na = va instanceof Date && !isNaN(va) ? +va : (sortDir==='asc' ? Infinity : -Infinity);
      const nb = vb instanceof Date && !isNaN(vb) ? +vb : (sortDir==='asc' ? Infinity : -Infinity); return (na - nb) * (sortDir==='asc'?1:-1); }
    return 0;
  });
}
function totalPages(){ return Math.max(1, Math.ceil(viewRows.length/pageSize)); }
function getCurrentPageRows(){ const start=(pageIndex-1)*pageSize; return viewRows.slice(start, start+pageSize); }
function updateSortBtnsUI(){
  const bs=document.getElementById('sortStatus'), bt=document.getElementById('sortTime');
  if(bs){ bs.classList.toggle('active', sortKey==='status'); bs.querySelector('.ind').textContent = sortKey==='status' ? (sortDir==='asc'?'↑':'↓') : '⇅'; bs.setAttribute('aria-label', sortKey==='status' ? `按状态${sortDir==='asc'?'升序':'降序'}` : '按状态排序'); }
  if(bt){ bt.classList.toggle('active', sortKey==='time'  ); bt.querySelector('.ind').textContent = sortKey==='time'   ? (sortDir==='asc'?'↑':'↓') : '⇅'; bt.setAttribute('aria-label', sortKey==='时间' ? `按时间${sortDir==='asc'?'升序':'降序'}` : '按时间排序'); }
}

function renderTable(){
  const start=(pageIndex-1)*pageSize, slice=viewRows.slice(start,start+pageSize);
  const tbody = tbodyEl; tbody.innerHTML=''; let i=0;
  function renderRow(r){
    const tr = document.createElement('tr'); tr.setAttribute('data-id', String(r.id));
    if(selectedIds.has(r.id)) tr.classList.add('selected'); if(r.voided) tr.classList.add('voided');
    tr.innerHTML = `
      <td class="col-chk"><input type="checkbox" class="chk rowchk" data-id="${r.id}" ${selectedIds.has(r.id)?'checked':''}></td>
      <td class="col-order">${h(r.orderNo)}</td>
      <td class="col-waybill">${h(r.waybill)}</td>
      <td class="col-trans">${h(r.transNo)}</td>
      <td class="col-ship">${h(r.ship||'-')}</td>
      <td class="col-file">${h(r.file||'-')}</td>
      <td class="col-status">${h(r.status)}${r.voided?'｜已作废':''}</td>
      <td class="col-created"><div class="time2"><div>创建时间：${h(formatDateTime(r.createdAt))}</div><div>打印时间：${h(formatDateTime(r.printedAt))}</div></div></td>
      <td class="col-op"><button type="button" class="btn-link preview" ${r.file?'':'disabled'}>预览</button><button type="button" class="btn-link toggle-void" data-id="${r.id}">${r.voided?'激活':'作废'}</button></td>`;
    return tr;
  }
  chunkRender(tbody, slice, renderRow, 50);

  pageInfo.textContent=`共 ${viewRows.length} 条 ${pageIndex}/${totalPages()} 页`;
  jumpTo.value=pageIndex;
  const pages=totalPages(); const nums=[]; const s=Math.max(1,pageIndex-2), e=Math.min(pages,pageIndex+2);
  for(let i=s;i<=e;i++){ nums.push(`<a href="#" data-p="${i}" style="${i===pageIndex?'font-weight:700;text-decoration:underline':''}">${i}</a>`); }
  pageNums.innerHTML=nums.join('');
  pageNums.querySelectorAll('a').forEach(a=>a.addEventListener('click',(e)=>{ e.preventDefault(); pageIndex=+a.dataset.p; renderTable(); fitTableHeight(); }));
  syncHeaderCheckbox(); fitTableHeight(); updateSelCounter();
}
function updateSelCounter(){ if(selCounter) selCounter.textContent = `已选择 ${selectedIds.size} 条`; }
function syncHeaderCheckbox(){
  const head=document.getElementById('chkAll'); const slice=getCurrentPageRows(); const total=slice.length;
  const sel = slice.filter(r=>selectedIds.has(r.id)).length;
  head.indeterminate = sel>0 && sel<total; head.checked = total>0 && sel===total;
}
function updateCurrentPageSelectionUI(){
  const slice=getCurrentPageRows(); const ids=new Set(slice.map(r=>r.id));
  tbodyEl.querySelectorAll('tr').forEach(tr=>{ const id=Number(tr.getAttribute('data-id')); if(!ids.has(id)) return;
    const checked=selectedIds.has(id); const cb=tr.querySelector('input.rowchk'); if(cb) cb.checked=checked; tr.classList.toggle('selected', checked); });
  syncHeaderCheckbox(); updateSelCounter();
}
function totalPagesLogs(){ return Math.max(1, Math.ceil((window.logsViewRows||[]).length/pageSize)); }
function fitTableHeight(){
  requestAnimationFrame(()=>{
    const wrap = document.querySelector('.table-wrap:not(.hidden)'); if(!wrap) return;
    const scroller = wrap.querySelector('.table-scroll'); if(!scroller) return;
    const top = scroller.getBoundingClientRect().top;
    const footerTop = footerBar.classList.contains('hidden') ? window.innerHeight : footerBar.getBoundingClientRect().top;
    const h = Math.max(120, Math.floor(footerTop - top - 12)); scroller.style.maxHeight = h + 'px'; scroller.style.height = h + 'px';
  });
}
function toggleFooterSelectionControls(show){ [selAll, selInvert, selCounter].forEach(el=>{ if(el) el.classList.toggle('hidden', !show); }); }

// 事件绑定
let _bound=false, currentAction='';
function bindLabelUploadEvents(){
  const bulkDrop=document.getElementById('bulkDrop'), bulkBtn=document.getElementById('bulkBtn');
  const startTime=document.getElementById('startTime'), endTime=document.getElementById('endTime');
  const statusSel=document.getElementById('statusSel'), shipSel=document.getElementById('shipSel');
  const kw=document.getElementById('kw'), searchBtn=document.getElementById('searchBtn');
  const quickDrop=document.getElementById('quickDrop'), quickBtn=document.getElementById('quickBtn');
  const timeField=document.getElementById('timeField'); const resetBtn=document.getElementById('resetBtn');

  upgradeSelectToMenu(timeField); upgradeSelectToMenu(statusSel); upgradeSelectToMenu(shipSel);
  enhanceDateInputs([startTime,endTime]);

  if(bulkBtn && bulkDrop){
    bulkBtn.addEventListener('click',(e)=>{ e.stopPropagation(); const willOpen = !bulkDrop.classList.contains('open'); closeAllMenus(willOpen?bulkDrop:null); bulkDrop.classList.toggle('open', willOpen); });
    bulkDrop.querySelectorAll('.menu a').forEach(a=>{ a.addEventListener('click',(e)=>{ e.preventDefault(); openOpModal(a.dataset.act || '', bulkBtn); closeAllMenus(null); }); });
  }
  if(quickBtn && quickDrop){
    quickBtn.addEventListener('click',(e)=>{ e.stopPropagation(); const willOpen = !quickDrop.classList.contains('open'); closeAllMenus(willOpen?quickDrop:null); quickDrop.classList.toggle('open', willOpen); });
    quickDrop.querySelectorAll('.menu a').forEach(a=>{ a.addEventListener('click',(e)=>{ e.preventDefault(); const days=parseInt(a.dataset.days||'',10);
      if(Number.isFinite(days)){ const to=new Date(); const from=new Date(to.getTime()-days*86400000); startTime.value=toLocal(from); endTime.value=toLocal(to); }
      closeAllMenus(null); applyFilters(); }); });
  }
  if(searchBtn) searchBtn.addEventListener('click',()=>{ applyFilters(); fitTableHeight(); });
  if(kw){ kw.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ applyFilters(); fitTableHeight(); } }); kw.addEventListener('dblclick', ()=>{ bulkText.value=''; openModal(bulkModal); bulkText.focus(); }); }
  if(bulkCancel) bulkCancel.addEventListener('click', ()=> closeModal(bulkModal));
  if(bulkApply)  bulkApply.addEventListener('click', ()=>{ const ids = bulkText.value.split(/\s+/).map(s=>s.trim()).filter(Boolean); if(ids.length){ kw.value = ids.join(' '); applyFilters(); fitTableHeight(); } closeModal(bulkModal); });
  if(timeField) timeField.addEventListener('change', ()=>{ applyFilters(); });
  if(resetBtn)  resetBtn.addEventListener('click', ()=>{ startTime.value=''; endTime.value=''; kw.value=''; timeField.value='created'; statusSel.value=''; shipSel.value=''; applyFilters(); });

  if(_bound) return; _bound=true;

  const chkAll=document.getElementById('chkAll'); if(chkAll) chkAll.addEventListener('change',()=>{ if(currentTabContext!=='labelList') return; const slice=getCurrentPageRows(); if(chkAll.checked){ slice.forEach(r=>selectedIds.add(r.id)); } else { slice.forEach(r=>selectedIds.delete(r.id)); } updateCurrentPageSelectionUI(); });
  tbodyEl.addEventListener('click', (e)=>{
    if(currentTabContext!=='labelList') return;
    const toggleBtn = e.target.closest('button.toggle-void'); if(toggleBtn){ e.preventDefault(); const id = Number(toggleBtn.dataset.id); const row = masterRows.find(r=>r.id===id); if(!row) return; row.voided = !row.voided; updateCurrentPageSelectionUI(); renderTable(); }
  });
  tbodyEl.addEventListener('change', (e)=>{ if(currentTabContext!=='labelList') return; if(e.target && e.target.matches('input.rowchk')){ const id = +e.target.getAttribute('data-id'); if(e.target.checked) selectedIds.add(id); else selectedIds.delete(id); syncHeaderCheckbox(); updateSelCounter(); const tr=e.target.closest('tr'); if(tr) tr.classList.toggle('selected', e.target.checked); }});

  pageSizeSel.addEventListener('change',()=>{ pageSize=parseInt(pageSizeSel.value,10)||50; if(currentTabContext==='logs'){ window.logsPageIndex=1; renderLogsTable(); } else { pageIndex=1; renderTable(); } fitTableHeight(); });
  firstPage.addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext==='logs'){ window.logsPageIndex=1; renderLogsTable(); } else { pageIndex=1; renderTable(); } fitTableHeight(); });
  prevPage .addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext==='logs'){ window.logsPageIndex=Math.max(1,window.logsPageIndex-1); renderLogsTable(); } else { pageIndex=Math.max(1,pageIndex-1); renderTable(); } fitTableHeight(); });
  nextPage .addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext==='logs'){ window.logsPageIndex=Math.min(totalPagesLogs(),window.logsPageIndex+1); renderLogsTable(); } else { pageIndex=Math.min(totalPages(),pageIndex+1); renderTable(); } fitTableHeight(); });
  lastPage .addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext==='logs'){ window.logsPageIndex=totalPagesLogs(); renderLogsTable(); } else { pageIndex=totalPages(); renderTable(); } fitTableHeight(); });
  jumpTo   .addEventListener('change',()=>{ const p=+jumpTo.value||1; if(currentTabContext==='logs'){ window.logsPageIndex=Math.min(Math.max(1,p),totalPagesLogs()); renderLogsTable(); } else { pageIndex=Math.min(Math.max(1,p),totalPages()); renderTable(); } fitTableHeight(); });
  selAll   .addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext!=='labelList') return; const slice=getCurrentPageRows(); slice.forEach(r=>selectedIds.add(r.id)); updateCurrentPageSelectionUI(); });
  selInvert.addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext!=='labelList') return; const slice=getCurrentPageRows(); slice.forEach(r=>{ if(selectedIds.has(r.id)) selectedIds.delete(r.id); else selectedIds.add(r.id); }); updateCurrentPageSelectionUI(); });
  goTop    .addEventListener('click',(e)=>{ e.preventDefault(); const sc=document.querySelector('.table-wrap:not(.hidden) .table-scroll'); if(sc) sc.scrollTo({top:0, behavior:'smooth'}); });

  const bs=document.getElementById('sortStatus'), bt=document.getElementById('sortTime');
  if(bs) bs.addEventListener('click', ()=>{ if(currentTabContext!=='labelList') return; if(sortKey==='status'){ sortDir = (sortDir==='asc'?'desc':'asc'); } else { sortKey='status'; sortDir='asc'; } sortRows(); pageIndex=1; renderTable(); updateSortBtnsUI(); });
  if(bt) bt.addEventListener('click', ()=>{ if(currentTabContext!=='labelList') return; if(sortKey==='time'){ sortDir = (sortDir==='asc'?'desc':'asc'); } else { sortKey='time'; sortDir='desc'; } sortRows(); pageIndex=1; renderTable(); updateSortBtnsUI(); });

  // 二级点击切换
  subInner.addEventListener('click',(e)=>{
    const a=e.target.closest('a.sub'); if(!a) return; e.preventDefault();
    lockedPath=a.getAttribute('data-owner'); lockedSubHref=a.getAttribute('href')||'';
    if(TABMAP[lockedSubHref]){ if(!lockedTabHref || !TABMAP[lockedSubHref].some(t=>t.href===lockedTabHref)) lockedTabHref=DEFAULT_TAB_BY_SUB[lockedSubHref]||TABMAP[lockedSubHref][0].href; } else lockedTabHref='';
    localStorage.setItem(STORAGE_KEY_NEW, JSON.stringify({v:SCHEMA_VERSION,lockedPath,lockedSubHref,lockedTabHref,ts:Date.now()}));
    renderSub(lockedPath);
  });
}
function updateRowsVoidedUI(ids, voided){
  const idSet = new Set(ids);
  tbodyEl.querySelectorAll('tr').forEach(tr=>{
    const id = Number(tr.getAttribute('data-id')); if(!idSet.has(id)) return;
    tr.classList.toggle('voided', voided);
    const toggleBtn = tr.querySelector('button.toggle-void');
    if(toggleBtn) toggleBtn.textContent = voided ? '激活' : '作废';
  });
}

function bindLogsEvents(){
  const s=document.getElementById('logsStart'), e=document.getElementById('logsEnd');
  const quickDrop=document.getElementById('logsQuickDrop'), quickBtn=document.getElementById('logsQuickBtn');
  const resetBtn=document.getElementById('logsResetBtn');
  enhanceDateInputs([s,e]);
  if(quickBtn && quickDrop){
    quickBtn.addEventListener('click',(ev)=>{ ev.stopPropagation(); const willOpen = !quickDrop.classList.contains('open'); closeAllMenus(willOpen?quickDrop:null); quickDrop.classList.toggle('open', willOpen); });
    quickDrop.querySelectorAll('.menu a').forEach(a=>{ a.addEventListener('click',(e2)=>{ e2.preventDefault(); const days=parseInt(a.dataset.days||'',10); if(Number.isFinite(days)){ const to=new Date(); const from=new Date(to.getTime()-days*86400000); s.value=toLocal(from); e.value=toLocal(to); } closeAllMenus(null); applyLogsFilters(); }); });
  }
  if(resetBtn) resetBtn.addEventListener('click', ()=>{ s.value=''; e.value=''; applyLogsFilters(); });
  logsTbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('button.log-view'); if(!btn) return;
    const id = Number(btn.dataset.id); const row = window.logsMasterRows.find(x=>x.id===id); if(row) openUploadLogModal(row, 'fail');
  });
}
function applyLogsFilters(){
  const s=document.getElementById('logsStart').value; const e=document.getElementById('logsEnd').value;
  const st = s ? new Date(s).getTime() : null; const et = e ? new Date(e).getTime() : null;
  window.logsViewRows = (window.logsMasterRows||[]).filter(r=>{ const ts = new Date(r.time.replace(/-/g,'/')).getTime(); if(st!==null && ts<st) return false; if(et!==null && ts>et) return false; return true; });
  window.logsPageIndex=1; renderLogsTable();
}
function renderLogsTable(){
  const start=(window.logsPageIndex-1)*pageSize, slice=(window.logsViewRows||[]).slice(start, start+pageSize);
  logsTbody.innerHTML = slice.map(r=>`<tr data-id="${r.id}"><td>${h(r.time)}</td><td>${h(r.file)}</td><td>${h(r.type)}</td><td>${r.total}</td><td>${r.success}</td><td>${r.fail}</td><td>${h(r.operator)}</td><td><button class="btn-link log-view" data-id="${r.id}" title="查看上传日志">查看</button></td></tr>`).join('');
  pageInfo.textContent=`共 ${(window.logsViewRows||[]).length} 条 ${window.logsPageIndex}/${totalPagesLogs()} 页`; jumpTo.value=window.logsPageIndex;
  const pages=totalPagesLogs(); const nums=[]; const sIdx=Math.max(1,window.logsPageIndex-2), eIdx=Math.min(pages,window.logsPageIndex+2);
  for(let i=sIdx;i<=eIdx;i++){ nums.push(`<a href="#" data-p="${i}" style="${i===window.logsPageIndex?'font-weight:700;text-decoration:underline':''}">${i}</a>`); }
  pageNums.innerHTML=nums.join(''); pageNums.querySelectorAll('a').forEach(a=>a.addEventListener('click',(e)=>{ e.preventDefault(); window.logsPageIndex=+a.dataset.p; renderLogsTable(); fitTableHeight(); }));
  fitTableHeight();
}
let currentLogsNos=[], currentLogsMode='fail', currentAction='';
function openUploadLogModal(row, mode='fail'){
  currentLogsMode = mode; currentLogsNos = mode==='fail' ? row.failNos : row.successNos;
  opTitle.textContent = `上传日志（${row.type}｜${row.file}）`;
  opContent.innerHTML = `<div style="display:flex;gap:8px;margin:6px 0 10px;">
    <button type="button" class="btn ${mode==='success'?'btn--black':''}" data-logtab="success">成功（${row.success}）</button>
    <button type="button" class="btn ${mode==='fail'?'btn--black':''}" data-logtab="fail">失败（${row.fail}）</button>
    <span style="margin-left:auto;color:#64748b;">点击“确认”复制当前列表</span></div>
    <textarea id="logListBox" readonly>${h(currentLogsNos.join('\n'))}</textarea>`;
  currentAction = 'copy-upload-logs'; openModal(opModal);
  opContent.querySelectorAll('[data-logtab]').forEach(b=>{ b.addEventListener('click', ()=>{ const m=b.dataset.logtab; currentLogsMode=m; currentLogsNos = m==='fail' ? row.failNos : row.successNos; const box=document.getElementById('logListBox'); if(box) box.value=currentLogsNos.join('\n'); opContent.querySelectorAll('[data-logtab]').forEach(x=>x.classList.toggle('btn--black', x.dataset.logtab===m)); }); });
}

opCancel.addEventListener('click', ()=> closeModal(opModal));
opConfirm.addEventListener('click', async ()=>{
  if(currentAction==='copy-upload-logs'){
    const txt = (currentLogsNos||[]).join('\n'); if(!txt){ alert('当前列表为空。'); return; }
    const ok = await copyToClipboard(txt); closeModal(opModal); alert(ok ? `已复制 ${currentLogsNos.length} 条${currentLogsMode==='fail'?'失败':'成功'}记录到剪贴板。` : '复制失败：请手动全选并复制。'); return;
  }
});

// 默认进入 面单上传 / 列表
lockedSubHref = '/orders/label-upload'; lockedTabHref = '/orders/label-upload/list'; renderSub(lockedPath);
