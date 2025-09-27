/* 壳层交互与动效（仅导航壳，不含业务） */
(function(){
  const body = document.body;
  const USE_REAL_NAV = (body.getAttribute('data-use-real-nav') === 'true');

  // DOM 引用
  const track = document.getElementById('navTrack');
  const pill  = document.getElementById('pill');
  const subRow   = document.getElementById('subRow');
  const subInner = document.getElementById('subInner');
  
// ==== 自动读取 /api/nav，基于 tabs.register.yaml 生成 SUBMAP / TABMAP + 内嵌渲染规范 ====
let __NAV_CACHE = null;
let SUBMAP = {};   // { '/l1': [ {text, href}, ... ] }
let TABMAP = {};   // { '/l1/l2': [ {key,text,href,order?, mount? ...}, ... ] }
let DEFAULT_TAB_BY_SUB = {}; // { '/l1/l2': '/l1/l2/xxx' }
let __TAB_SPECS = {}; // { href: { js:[], css:[], call:'', container:'', host:'#tabPanel', mode:'inline'|'iframe' } }

function __hashId(s){ try{ return 'h'+Array.from(new TextEncoder().encode(s)).reduce((a,b)=>((a*131)+b)>>>0, 0).toString(16); }catch(e){ return 'h'+Math.abs(s.split('').reduce((a,c)=>a*31+c.charCodeAt(0),7)).toString(16); } }
function ensureCSS(href, id){
  id = id || ('css-'+__hashId(href));
  if(document.getElementById(id)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = href; link.id = id;
  document.head.appendChild(link);
}
function ensureScript(src, id, cb){
  id = id || ('js-'+__hashId(src));
  if(document.getElementById(id)){ cb && cb(); return; }
  const s = document.createElement('script');
  s.src = src; s.id = id;
  s.onload = ()=> cb && cb();
  s.onerror = ()=> cb && cb(); // 出错也继续，避免卡死
  document.head.appendChild(s);
}

// 从 YAML 衍生“猜测规范”：根据 href 推断模块路径和函数名（例如 /logistics/channel/custom）
function deriveSpecFromHref(href){
  const parts = href.replace(/^\/+/,'').split('/'); // ['logistics','channel','custom']
  if(parts.length < 3) return null;
  const [l1,l2,l3] = parts;
  const candidates = [];
  // 常见目录规则：modules/{l1}_{l2}/{l1}_{l3}/frontend/static/{l1}_{l3}.{js,css}
  candidates.push({
    js:  [`/modules/${l1}_${l2}/${l1}_${l3}/frontend/static/${l1}_${l3}.js`,
          `/modules/${l1}_${l2}/${l3}/frontend/static/${l3}.js`,
          `/modules/${l1}_${l2}/${l1}_${l3}/frontend/static/index.js`,
          `/modules/${l1}_${l2}/${l3}/frontend/static/index.js`],
    css: [`/modules/${l1}_${l2}/${l1}_${l3}/frontend/static/${l1}_${l3}.css`,
          `/modules/${l1}_${l2}/${l1}_${l3}/frontend/static/${l1}_${l3}..css`,
          `/modules/${l1}_${l2}/${l3}/frontend/static/${l3}.css`,
          `/modules/${l1}_${l2}/${l3}/frontend/static/${l3}..css`],
    callCandidates: [
      `__minipost_mount_${l1}_${l3}`,
      `__minipost_mount_${l3}`,
      `MinipostMount_${l1}_${l3}`,
      `MinipostMount_${l3}`,
      `init`,
    ],
    container: `<div id="${l1}-${l3}-app"></div>`,
    host: '#tabPanel',
    mode: 'inline',
  });
  // 返回第一个候选（加载时逐一尝试）
  return candidates[0];
}

function buildMapsFromNav(nav){
  SUBMAP = {}; TABMAP = {}; DEFAULT_TAB_BY_SUB = {};
  const items = Array.isArray(nav?.items) ? nav.items : [];
  const tabsObj = nav?.tabs || {};
  // L1/L2 -> SUBMAP
  for(const L1 of items){
    const l1path = L1?.path || '';
    const l2list = Array.isArray(L1?.children) ? L1.children : [];
    if(!l1path) continue;
    SUBMAP[l1path] = l2list.map(l2 => ({ text: l2?.title || '', href: l2?.path || '' }));
  }
  // L2/L3 -> TABMAP
  for(const base in tabsObj){
    if(!tabsObj.hasOwnProperty(base)) continue;
    const list = Array.isArray(tabsObj[base]) ? tabsObj[base] : [];
    TABMAP[base] = list.map(t => ({ key:t.key, text:t.text, href:t.href, order:t.order, mount: t.mount||null, template: t.template||null }));
    if(list.length) DEFAULT_TAB_BY_SUB[base] = list[0].href;
  }
}

function buildSpecsFromTabs(nav){
  __TAB_SPECS = {};
  const tabsObj = nav?.tabs || {};
  for(const base in tabsObj){
    const list = tabsObj[base] || [];
    for(const t of list){
      const href = t?.href || '';
      if(!href) continue;
      let spec = null;
      if(t.mount){ // YAML 中显式声明
        const m = t.mount;
        spec = {
          js:  Array.isArray(m.js)  ? m.js  : (m.js ? [m.js] : []),
          css: Array.isArray(m.css) ? m.css : (m.css? [m.css]: []),
          call: m.call || '',
          container: m.container || '',
          host: m.host || '#tabPanel',
          mode: (m.mode || 'inline')
        };
      }else{
        spec = deriveSpecFromHref(href);
      }
      __TAB_SPECS[href] = spec || { mode:'iframe' };
    }
  }
}

function mountFromYaml(href){
  if(!href) return false;
  const spec = __TAB_SPECS[href] || deriveSpecFromHref(href);
  if(!spec) return false;

  // 内嵌模式
  if(spec.mode !== 'iframe'){
    tabCard.classList.remove('no-tabs');
    if(spec.container){
      tabPanel.innerHTML = spec.container;
    }else{
      tabPanel.innerHTML = '<div class="panel-host"></div>';
    }
    // 样式
    (spec.css || []).forEach((c, idx)=> ensureCSS(c, 'css-'+__hashId(href+'#'+idx)));
    // 脚本：全部加载后再尝试调用（多脚本串行保障依赖）
    const jsList = spec.js || [];
    let i = 0;
    const done = ()=>{
      // 按优先级寻找可调用函数
      const calls = [];
      if(spec.call) calls.push(spec.call);
      const derived = deriveSpecFromHref(href);
      if(derived && Array.isArray(derived.callCandidates)) calls.push(...derived.callCandidates);
      let called = false;
      for(const name of calls){
        const fn = name && window[name];
        if(typeof fn === 'function'){
          try{ fn(); called = true; break; }catch(e){ console.error(e); }
        }
      }
      if(!called){
        // 没有可调用函数：给出占位
        if(tabPanel && !tabPanel.querySelector('.panel-host')){
          tabPanel.innerHTML = '<div style="color:#64748b;">该页签未提供挂载函数，已加载资源但未渲染内容。</div>';
        }
      }
    };
    const loadNext = ()=>{
      if(i >= jsList.length){ done(); return; }
      const src = jsList[i++];
      ensureScript(src, 'js-'+__hashId(href+'#'+i), loadNext);
    };
    if(jsList.length) loadNext(); else done();
    return true;
  }

  // 兜底：iframe（仍在页签下方显示，不整页跳转）
  if(!tabPanel.querySelector('iframe.tabpanel__frame')){
    const frame = document.createElement('iframe');
    frame.className = 'tabpanel__frame';
    frame.setAttribute('frameborder', '0');
    frame.setAttribute('referrerpolicy','no-referrer-when-downgrade');
    frame.style.width='100%'; frame.style.border='0';
    frame.style.minHeight='calc(100vh - 220px)';
    tabPanel.innerHTML=''; tabPanel.appendChild(frame);
  }
  const f = tabPanel.querySelector('iframe.tabpanel__frame');
  if(f && f.getAttribute('src') !== href){ f.setAttribute('src', href); }
  return true;
}

// 拉取导航并初始化交互（替代硬编码 SUBMAP/TABMAP）
async function bootstrapNav(){
  try{
    const resp = await fetch('/api/nav', { credentials:'include' });
    __NAV_CACHE = await resp.json();
    buildMapsFromNav(__NAV_CACHE);
    buildSpecsFromTabs(__NAV_CACHE);
  }catch(e){
    console.warn('读取 /api/nav 失败，回退为静态 SUBMAP/TABMAP（若存在）', e);
  }
}

const tabsEl   = document.getElementById('tabs');
  const tabCard  = document.getElementById('tabCard');
  const tabPanel = document.getElementById('tabPanel');

  /* ====== Inline L3 渲染（参考 minipost-ui.html 的“面单列表/上传记录”交互） ====== */

  function renderInlineForPath(href){
    if(!href){ tabCard.classList.remove('no-tabs'); tabPanel.textContent=''; return; }
    // 自定义物流（参考“面单列表”布局：筛选卡片 + 表格）
    if(href === '/logistics/channel/custom'){ 
      return renderLogisticsCustomPanel(); 
    }
    // 其它：占位（不跳离壳层）
    tabCard.classList.remove('no-tabs');
    tabPanel.innerHTML = '<div style="color:#64748b">该页签暂无内嵌内容，等待模块接入。</div>';
  }

  // ===== 自定义物流：卡片 + 表格（内嵌渲染） =====
  let lc_master=[], lc_view=[], lc_page=1, lc_page_size=20, lc_kw='';
  async function fetchLogisticsCustom(){
    const p = new URLSearchParams({ page:String(lc_page), page_size:String(lc_page_size), kw:lc_kw });
    const res = await fetch('/api/logistics/custom?'+p.toString(), { credentials: 'same-origin' });
    if(!res.ok) throw new Error('接口错误：'+res.status);
    const json = await res.json();
    lc_master = Array.isArray(json?.data) ? json.data : [];
    const pg = json?.pagination || {}; 
    lc_page = Number(pg.page)||1; lc_page_size = Number(pg.page_size)||20;
    return { total: Number(pg.total)||lc_master.length };
  }
  function renderLogisticsCustomPanel(){
    tabCard.classList.remove('no-tabs');
    tabPanel.innerHTML = `
      <div class="toolbar" id="lcToolbar">
        <div class="toolbar-left">
          <input id="lcKw" class="input input--search" placeholder="搜索物流名称 / 渠道名称（kw）">
          <button id="lcSearch" class="btn btn--black">搜索</button>
        </div>
        <div class="toolbar-actions">
          <button id="lcNew" class="btn">新增自定义物流</button>
        </div>
      </div>
      <div class="table-wrap">
        <div class="table-scroll">
          <table class="table" id="lcTable">
            <thead>
              <tr>
                <th style="width:36px;">&nbsp;</th>
                <th>物流名称</th>
                <th>渠道数</th>
                <th>创建时间</th>
                <th style="width: var(--col-w-op, 140px);">操作</th>
              </tr>
            </thead>
            <tbody id="lcTbody"></tbody>
          </table>
        </div>
      </div>
    `;
    const kw = tabPanel.querySelector('#lcKw');
    const btn = tabPanel.querySelector('#lcSearch');
    const tbody = tabPanel.querySelector('#lcTbody');
    const btnNew = tabPanel.querySelector('#lcNew');

    lc_kw = kw.value.trim();
    lc_page = 1; lc_page_size = 20;

    btn.addEventListener('click', ()=>{ lc_kw = kw.value.trim(); lc_page=1; updateLC(); });
    kw.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ lc_kw = kw.value.trim(); lc_page=1; updateLC(); }});
    btnNew.addEventListener('click', ()=>{ alert('“新增自定义物流”弹窗占位。可对接 /api/logistics/custom POST。'); });

    // 事件代理：展开子渠道
    tbody.addEventListener('click', (e)=>{
      const t = e.target.closest('button.lc-expand, button.lc-refresh'); if(!t) return;
      e.preventDefault();
      const tr = t.closest('tr'); if(!tr) return;
      const idx = Number(tr.dataset.idx||'-1');
      const row = lc_view[idx]; if(!row) return;
      if(t.classList.contains('lc-refresh')){ renderLCRow(tr, row, true); return; }
      const exp = tr.nextElementSibling;
      if(exp && exp.classList.contains('lc-expand-row')){
        exp.classList.toggle('hidden');
        t.textContent = exp.classList.contains('hidden') ? '展开' : '收起';
      }
    });

    updateLC();
  }

  function toLocal(dt){
    try{ const d = new Date(dt); if(isNaN(d)) return '-'; const p=n=>String(n).padStart(2,'0'); 
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; 
    }catch(e){ return '-'; }
  }

  async function updateLC(){
    try{
      const pg = await fetchLogisticsCustom();
      lc_view = lc_master.slice();  // 此处可加本地二次过滤
      const tbody = tabPanel.querySelector('#lcTbody');
      tbody.innerHTML = '';
      lc_view.forEach((row, i)=>{
        const tr = document.createElement('tr');
        tr.dataset.idx = String(i);
        renderLCRow(tr, row, false);
        tbody.appendChild(tr);

        // 展开区（初始隐藏）
        const exp = document.createElement('tr');
        exp.className='lc-expand-row hidden';
        const td = document.createElement('td'); td.setAttribute('colspan','5');
        td.innerHTML = renderLCChannels(row);
        exp.appendChild(td);
        tbody.appendChild(exp);
      });
    }catch(e){
      tabPanel.querySelector('#lcTbody').innerHTML = `<tr><td colspan="5" style="color:#ef4444;">加载失败：${(e&&e.message)||e}</td></tr>`;
    }
  }

  function renderLCRow(tr, row, refresh=false){
    const chCount = Array.isArray(row.channels) ? row.channels.length : 0;
    tr.innerHTML = `
      <td><button class="btn-link lc-expand">${refresh?'收起':'展开'}</button></td>
      <td>${escapeHtml(row.provider_name || row.name || '-')}</td>
      <td>${chCount}</td>
      <td>${escapeHtml(toLocal(row.created_at || row.createdAt || row.created || ''))}</td>
      <td>
        <button class="btn-link lc-refresh">刷新</button>
        <button class="btn-link" disabled>编辑</button>
      </td>
    `;
  }
  function escapeHtml(s){ const map={'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}; return String(s==null?'':s).replace(/[&<>\"']/g, m=>map[m]); }

  function renderLCChannels(row){
    const chs = Array.isArray(row.channels) ? row.channels : [];
    if(!chs.length) return '<div style="color:#64748b;padding:8px 6px;">暂无渠道</div>';
    const rows = chs.map(c=>`
      <tr>
        <td>${escapeHtml(c.channel_name||'-')}</td>
        <td>${escapeHtml(c.transport_mode||'-')}</td>
        <td>${escapeHtml(c.platform_mapping||'-')}</td>
        <td>${c.is_selectable? '是':'否'}</td>
        <td>${escapeHtml(String(c.usage_count||0))}</td>
        <td>${escapeHtml(c.status||'-')}</td>
      </tr>`).join('');
    return `
      <div style="padding:10px 8px 6px 8px; background:#fafafa; border:1px solid #eee; border-radius:10px;">
        <div style="font-weight:600; margin-bottom:8px; color:#374151;">渠道列表</div>
        <div class="table-wrap" style="margin:0">
          <div class="table-scroll">
            <table class="table">
              <thead>
                <tr>
                  <th>渠道名称</th>
                  <th>运输方式</th>
                  <th>平台映射</th>
                  <th>可选</th>
                  <th>使用次数</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

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
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        lockedPath = a.dataset.path;
        const firstSub = ((item.children||[]).find(s=>s.visible!==false)) || null;
        lockedSubHref = firstSub ? (firstSub.path||'') : '';
        let L3 = [];
        if(firstSub){ L3 = (firstSub.children||[]).filter(t=>t.visible!==false); }
        lockedTabHref = (L3[0] && L3[0].path) || '';
        try{ localStorage.setItem('NAV_STATE_V11', JSON.stringify({v:11, lockedPath, lockedSubHref, lockedTabHref, ts:Date.now()})); }catch(e){}
        hoverPath = lockedPath;
        highlightActive();
        renderSub(lockedPath);
        // 根据 tabs.register.yaml 自动加载该 L2 的第一个 L3
        try{
          const subs = SUBMAP[lockedPath]||[];
          const firstSub = subs[0] || null;
          const l3 = firstSub ? (TABMAP[firstSub.href]||[]) : [];
          const first = (l3[0] && l3[0].href) || '';
          if(first){ mountFromYaml(first); }
        }catch(err){ console.warn(err); }

      try{
        const l1 = (Object.values(__NAV_CACHE?.items||[]).find? null : null);
      }catch(err){}

        if(lockedTabHref){ renderInlineForPath(lockedTabHref); }
      });
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
    renderInlineForPath(lockedTabHref);
    // 自动加载当前激活的 L3 内容
    
    // 初次或刷新时载入当前激活 tab 的内容
    
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
        // 根据 tabs.register.yaml 自动加载该 L2 的第一个 L3
        try{
          const subs = SUBMAP[lockedPath]||[];
          const firstSub = subs[0] || null;
          const l3 = firstSub ? (TABMAP[firstSub.href]||[]) : [];
          const first = (l3[0] && l3[0].href) || '';
          if(first){ mountFromYaml(first); }
        }catch(err){ console.warn(err); }

      try{
        const l1 = (Object.values(__NAV_CACHE?.items||[]).find? null : null);
      }catch(err){}

      }
    }, grace);
  });
  subRow.addEventListener('pointerenter', ()=>{ inSubRow = true; clearTimeout(leaveTimer); });
  subRow.addEventListener('pointerleave', ()=>{ inSubRow = false; hoverPath = lockedPath; movePillToEl(track.querySelector(`.link[data-path="${lockedPath}"]`) || track.querySelector('.link')); renderSub(lockedPath);
        // 根据 tabs.register.yaml 自动加载该 L2 的第一个 L3
        try{
          const subs = SUBMAP[lockedPath]||[];
          const firstSub = subs[0] || null;
          const l3 = firstSub ? (TABMAP[firstSub.href]||[]) : [];
          const first = (l3[0] && l3[0].href) || '';
          if(first){ mountFromYaml(first); }
        }catch(err){ console.warn(err); }

      try{
        const l1 = (Object.values(__NAV_CACHE?.items||[]).find? null : null);
      }catch(err){}
 });

  subInner.addEventListener('pointerover', (e)=>{
    const s = e.target.closest('a.sub'); if(!s) return;
    const ownerEl = track.querySelector(`.link[data-path="${s.getAttribute('data-owner')}"]`);
    if(ownerEl) movePillToEl(ownerEl);
  });

  subInner.addEventListener('click', (e)=>{ const a = e.target.closest('a.sub'); if(!a) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
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
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    tabsEl.querySelectorAll('.tab').forEach(a=>a.classList.remove('active'));
    t.classList.add('active');
    lockedTabHref = t.getAttribute('href') || '';
    try{ localStorage.setItem('NAV_STATE_V11', JSON.stringify({v:11, lockedPath, lockedSubHref, lockedTabHref, ts:Date.now()})); }catch(e){}
    positionTabInk(t, true);
    // 内嵌渲染
    renderInlineForPath(lockedTabHref);
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
        L1 = items.filter(it => (it && it.visible !== false))
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
        // 根据 tabs.register.yaml 自动加载该 L2 的第一个 L3
        try{
          const subs = SUBMAP[lockedPath]||[];
          const firstSub = subs[0] || null;
          const l3 = firstSub ? (TABMAP[firstSub.href]||[]) : [];
          const first = (l3[0] && l3[0].href) || '';
          if(first){ mountFromYaml(first); }
        }catch(err){ console.warn(err); }

      try{
        const l1 = (Object.values(__NAV_CACHE?.items||[]).find? null : null);
      }catch(err){}

  }

  loadNav();
})();
