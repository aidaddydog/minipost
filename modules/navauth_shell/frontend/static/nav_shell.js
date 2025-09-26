/* ===== 壳层交互（像素/动效与原稿一致） ===== */
const SCHEMA_VERSION = 11;
const STORAGE_KEY_NEW = 'NAV_STATE_V11';
const STORAGE_KEY_OLD = 'NAV_STATE_V10';
const USE_REAL_NAV = (document.body.getAttribute('data-use-real-nav') === 'true'); // 可由 / 环境控制
const GRACE_MS = 220; // 宽容时间窗

// DOM 引用
const track=document.getElementById('navTrack'), pill=document.getElementById('pill');
const links=[...track.querySelectorAll('.link')];
const subRow=document.getElementById('subRow'), subInner=document.getElementById('subInner');
const tabsEl=document.getElementById('tabs'), tabCard=document.getElementById('tabCard'), tabPanel=document.getElementById('tabPanel');

// 兜底映射（不包含任何 *upload* 项，符合交付约束）
let SUBMAP={
  '/orders':[
    {text:'预报',href:'/orders/prealert'},
    {text:'订单列表',href:'/orders/list'},
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
let TABMAP={
  '/orders/prealert':[
    {key:'pickup',text:'预约取件',href:'/orders/prealert/pickup'},
    {key:'scan', text:'扫码发货',href:'/orders/prealert/scan'},
    {key:'list', text:'预报列表',href:'/orders/prealert/list'},
  ],
};
const DEFAULT_TAB_BY_SUB={
  '/orders/prealert':'/orders/prealert/list',
};

// 工具
const _escMap = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' };
const h = (s)=>String(s==null?'':s).replace(/[&<>"']/g, m=>_escMap[m]);
const cssVarNum = (name, fallback=0)=>{
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if(!v) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/* 一级胶囊位移（优化 RAF） */
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

/* 三级页签：横线（点击才滑动） */
function ensureTabInk(){
  let ink=document.getElementById('tabInk');
  if(!ink){
    ink=document.createElement('span');
    ink.id='tabInk';
    ink.className='tab-ink';
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
    void ink.offsetWidth;
    ink.style.transition = prev || '';
  }else{
    ink.style.width = width + 'px';
    ink.style.transform = `translateX(${left}px)`;
  }
}

// 状态
let lockedPath=links[0].dataset.path||'/orders';
let lockedSubHref=''; // 二级
let lockedTabHref=''; // 三级
let hoverPath=lockedPath, inSubRow=false, leaveTimer=null;

function renderSub(path){
  const list=SUBMAP[path]||[];
  subInner.innerHTML=list.map(i=>`<a class="sub" data-owner="${path}" href="${i.href}">${i.text}</a>`).join('');
  if(lockedSubHref){
    const t=[...subInner.querySelectorAll('.sub')].find(a=>a.getAttribute('href')===lockedSubHref);
    if(t) t.classList.add('active');
  }
  updateSubRowMinHeight();

  if(TABMAP[lockedSubHref]){
    renderTabs(lockedSubHref);
  }else{
    tabsEl.innerHTML='';
    ensureTabInk();
    tabCard.classList.add('no-tabs');
    tabPanel.innerHTML='该二级暂无页签内容。';
  }
}

function renderTabs(subHref){
  const tabsData=TABMAP[subHref]||[];
  if(!tabsData.length){ tabsEl.innerHTML=''; tabPanel.innerHTML=''; return; }

  if(!lockedTabHref || !tabsData.some(t=>t.href===lockedTabHref)){
    lockedTabHref=DEFAULT_TAB_BY_SUB[subHref]||tabsData[0].href;
  }
  tabsEl.innerHTML = tabsData.map(t=>
    `<a class="tab ${t.href===lockedTabHref?'active':''}" data-sub="${subHref}" data-key="${t.key}" href="${t.href}">
       <span class="tab__text">${t.text}</span>
     </a>`
  ).join('');
  ensureTabInk();

  // 内容占位
  tabCard.classList.remove('no-tabs');
  tabPanel.innerHTML='此处为业务模块内容占位。';

  // 初始定位（无动画）
  requestAnimationFrame(()=>positionTabInk(tabsEl.querySelector('.tab.active'), false));
}

function updateSubRowMinHeight(){
  const textH=subInner.getBoundingClientRect().height||0;
  const extra=5;
  subRow.style.minHeight=(textH+extra)+'px';
}

function highlightActive(){ links.forEach(a=>a.classList.toggle('active',a.dataset.path===lockedPath)); }

/* 初始化 */
(async function init(){
  // 真实聚合开关：从 /api/nav 载入（仅当 USE_REAL_NAV=true）
  if(USE_REAL_NAV){
    try{
      const res = await fetch('/api/nav');
      if(res.ok){
        const data = await res.json();
        const items = (data && data.data) || [];
        // 构造 L1/L2/L3（仅可见项）
        if(Array.isArray(items) && items.length){
          // 重建一级链接
          const l1 = items.filter(it=>it.level===1).sort((a,b)=>a.order-b.order);
          track.innerHTML = '<div class="pill" id="pill" aria-hidden="true"></div>' + l1.map(it=>`<a class="link" data-path="${it.path}" href="${it.path}">${it.title}</a>`).join('');
        }
      }
    }catch(e){ /* 失败则继续用兜底映射 */ }
  }

  // 重新抓取 DOM（若上面替换了）
  const _pill = document.getElementById('pill'); if(_pill) { pill.replaceWith(_pill); }
  window.pill = document.getElementById('pill');
  window.links = [...document.querySelectorAll('.link')];

  // 读状态（带兼容）
  try{
    let raw=localStorage.getItem(STORAGE_KEY_NEW);
    if(!raw){
      const old = localStorage.getItem(STORAGE_KEY_OLD);
      if(old){ localStorage.setItem(STORAGE_KEY_NEW, old); localStorage.removeItem(STORAGE_KEY_OLD); raw = old; }
    }
    if(raw){
      const obj=JSON.parse(raw);
      if(obj && obj.v===SCHEMA_VERSION && obj.lockedPath && (SUBMAP[obj.lockedPath]||true)){
        lockedPath=obj.lockedPath;
        // 二级
        const allSubs = Object.values(SUBMAP).flat();
        const okSub = allSubs.some(s=>s.href===obj.lockedSubHref);
        lockedSubHref=okSub?obj.lockedSubHref:'';
        // 三级
        if(lockedSubHref && TABMAP[lockedSubHref]){
          const okTab=(TABMAP[lockedSubHref]||[]).some(t=>t.href===obj.lockedTabHref);
          lockedTabHref=okTab?obj.lockedTabHref:(DEFAULT_TAB_BY_SUB[lockedSubHref]||'');
        }else lockedTabHref='';
      }
    }
  }catch(e){}

  if(!lockedSubHref){ const firstSub=(SUBMAP[lockedPath]||[])[0]; lockedSubHref=firstSub?firstSub.href:''; }
  hoverPath=lockedPath;

  movePillToEl((window.links||[]).find(a=>a.dataset.path===lockedPath)||window.links[0]);
  renderSub(lockedPath);
  highlightActive();

  const ro=new ResizeObserver(()=>{ updateSubRowMinHeight(); });
  ro.observe(subInner); updateSubRowMinHeight();

  window.addEventListener('resize', ()=>{ positionTabInk(tabsEl.querySelector('.tab.active'), false); });

  // 顶部导航交互
  (window.links||[]).forEach(a=>{
    a.addEventListener('pointerenter',()=>{ if(inSubRow) return; hoverPath=a.dataset.path; movePillToEl(a); renderSubPreview(hoverPath); });
  });
  function renderSubPreview(path){
    const list=SUBMAP[path]||[];
    subInner.innerHTML=list.map(i=>`<a class="sub" data-owner="${path}" href="${i.href}">${i.text}</a>`).join('');
  }
  track.addEventListener('pointerleave',()=>{
    clearTimeout(leaveTimer);
    leaveTimer=setTimeout(()=>{ if(!inSubRow){ hoverPath=lockedPath; movePillToEl((window.links||[]).find(x=>x.dataset.path===lockedPath)||window.links[0]); renderSub(lockedPath); } }, GRACE_MS);
  });
  subRow.addEventListener('pointerenter',()=>{ inSubRow=true; clearTimeout(leaveTimer); });
  subRow.addEventListener('pointerleave',()=>{ inSubRow=false; hoverPath=lockedPath; movePillToEl((window.links||[]).find(x=>x.dataset.path===lockedPath)||window.links[0]); renderSub(lockedPath); });
  subInner.addEventListener('pointerover',(e)=>{
    const s=e.target.closest('a.sub'); if(!s) return;
    const ownerEl=(window.links||[]).find(a=>a.dataset.path===s.getAttribute('data-owner'));
    if(ownerEl) movePillToEl(ownerEl);
  });
  (window.links||[]).forEach(a=>{
    a.addEventListener('click',(e)=>{
      if(!USE_REAL_NAV) e.preventDefault();
      lockedPath=a.dataset.path;
      const firstSub=(SUBMAP[lockedPath]||[])[0];
      lockedSubHref=firstSub?firstSub.href:'';
      lockedTabHref=TABMAP[lockedSubHref] ? (DEFAULT_TAB_BY_SUB[lockedSubHref]||'') : '';
      try{ localStorage.setItem(STORAGE_KEY_NEW, JSON.stringify({v:SCHEMA_VERSION,lockedPath,lockedSubHref,lockedTabHref,ts:Date.now()})); }catch(e){}
      hoverPath=lockedPath; highlightActive(); renderSub(lockedPath);
      if(USE_REAL_NAV && lockedSubHref) window.location.href=lockedSubHref;
    });
  });
  subInner.addEventListener('click',(e)=>{
    const a=e.target.closest('a.sub'); if(!a) return;
    if(!USE_REAL_NAV) e.preventDefault();
    lockedPath=a.getAttribute('data-owner'); lockedSubHref=a.getAttribute('href')||'';
    if(TABMAP[lockedSubHref]){
      if(!lockedTabHref || !TABMAP[lockedSubHref].some(t=>t.href===lockedTabHref)) lockedTabHref=DEFAULT_TAB_BY_SUB[lockedSubHref]||TABMAP[lockedSubHref][0].href;
    }else lockedTabHref='';
    try{ localStorage.setItem(STORAGE_KEY_NEW, JSON.stringify({v:SCHEMA_VERSION,lockedPath,lockedSubHref,lockedTabHref,ts:Date.now()})); }catch(e){}
    hoverPath=lockedPath; highlightActive();
    subInner.querySelectorAll('.sub').forEach(s=>s.classList.remove('active')); a.classList.add('active');
    renderSub(lockedPath);
    if(USE_REAL_NAV && lockedSubHref) window.location.href=lockedSubHref;
  });

  // 三级页签点击
  tabsEl.addEventListener('click',(e)=>{
    const t=e.target.closest('a.tab'); if(!t) return;
    if(!USE_REAL_NAV) e.preventDefault();

    tabsEl.querySelectorAll('.tab').forEach(a=>a.classList.remove('active'));
    t.classList.add('active');

    lockedTabHref=t.getAttribute('href')||'';
    try{ localStorage.setItem(STORAGE_KEY_NEW, JSON.stringify({v:SCHEMA_VERSION,lockedPath,lockedSubHref,lockedTabHref,ts:Date.now()})); }catch(e){}
    positionTabInk(t, true); // 点击时动画

    tabCard.classList.remove('no-tabs');
    tabPanel.innerHTML='此处为业务模块内容占位。';

    if(USE_REAL_NAV && lockedTabHref) window.location.href=lockedTabHref;
  });

  function currentVisualPath(){ return inSubRow?hoverPath:(hoverPath||lockedPath); }
  track.addEventListener('scroll',()=>{ movePillToEl((window.links||[]).find(x=>x.dataset.path===currentVisualPath())||window.links[0]); });
})();
