/* modules/navauth_shell/frontend/static/nav_shell.js
 * 壳层交互（L1/L2/L3） + “页签下方加载业务页面” 的最小实现
 * 目标：
 *  1) 从 /api/nav 获取 L1/L2/L3（含 default 字段）
 *  2) 依据 YAML 的 default 与本地记忆自动定位默认 L2 与默认 L3
 *  3) 点击 L3 时，把对应 href 以 <iframe> 的方式嵌入到 #tabPanel（页签下面）
 *  4) 移除“占位”文本，不再闪现“此处为业务模块内容占位。”
 *  5) 胶囊滑块（L1）最小动效
 */
(function(){
  const body    = document.body;
  const USE_REAL_NAV = (body.getAttribute('data-use-real-nav') === 'true');

  // DOM
  const track   = document.getElementById('navTrack');
  const pill    = document.getElementById('pill');
  const subInner= document.getElementById('subInner');
  const tabsEl  = document.getElementById('tabs');
  const tabCard = document.getElementById('tabCard');
  const tabPanel= document.getElementById('tabPanel');

  // 状态持久化
  const SCHEMA_VERSION = 2;
  const STORAGE_KEY    = 'NAV_STATE_V2';

  let items = [];   // L1 数组
  let lockedPath = '/';         // L1 当前 path（如 /logistics）
  let lockedSubHref = '';       // L2 当前 href（如 /logistics/channel）
  let lockedTabHref = '';       // L3 当前 href（如 /logistics/channel/custom）

  // =============== 工具 ===============
  const $ = (s, el=document)=> el.querySelector(s);
  function saveState(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v:SCHEMA_VERSION, lockedPath, lockedSubHref, lockedTabHref, ts: Date.now() }));
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
  function cssVarNum(name, fallback=0){
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if(!v) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  // 胶囊滑块（L1）
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
  track.addEventListener('scroll', ()=> movePillToL1Path(lockedPath));

  // =============== 渲染 ===============
  function renderL1(){
    // 清空旧项目（保留 pill）
    [...track.querySelectorAll('a.link')].forEach(x=>x.remove());

    items.forEach(it=>{
      const a=document.createElement('a');
      a.className='link' + (it.path===lockedPath?' active':'');
      a.dataset.path = it.path;
      a.href = it.path;
      a.textContent = it.title || it.path;
      a.addEventListener('click', (e)=>{
        if(USE_REAL_NAV) return; // 真实导航时允许整页跳转
        e.preventDefault();
        lockedPath = it.path;
        const l1 = getCurrentL1();
        const sub = pickDefaultL2(l1);
        lockedSubHref = sub ? sub.path : '';
        const tab = pickDefaultL3(sub);
        lockedTabHref = tab ? tab.path : '';
        saveState();
        renderL1(); renderSub(); renderTabs(); loadTabContent(lockedTabHref);
        movePillToEl(a);
      });
      track.appendChild(a);
    });

    // 首次定位
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
        if(USE_REAL_NAV) return;
        e.preventDefault();
        lockedSubHref = a.dataset.href || '';
        const sub = getCurrentL2();
        const tab = pickDefaultL3(sub);
        lockedTabHref = tab ? tab.path : '';
        saveState();
        // 视觉
        subInner.querySelectorAll('a.sub').forEach(x=>x.classList.remove('active')); a.classList.add('active');
        renderTabs(); loadTabContent(lockedTabHref);
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
    tabsEl.querySelectorAll('a.tab').forEach(a=>{
      a.addEventListener('click', (e)=>{
        if(USE_REAL_NAV) return;
        e.preventDefault();
        lockedTabHref = a.dataset.href || '';
        tabsEl.querySelectorAll('a.tab').forEach(x=>x.classList.remove('active')); a.classList.add('active');
        saveState();
        loadTabContent(lockedTabHref);
      });
    });
    // 有页签 → 卡片上移到 tabs 下方
    tabCard.classList.remove('no-tabs');
  }

  function updateSubRowMinHeight(){
    const textH=subInner.getBoundingClientRect().height||0;
    const extra=5;
    const subRow = document.getElementById('subRow');
    if(subRow) subRow.style.minHeight=(textH+extra)+'px';
  }

  // =============== 选择器 ===============
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

  // =============== 加载内容（关键改动） ===============
  function loadTabContent(href){
    if(!href){ tabPanel.innerHTML=''; return; }
    // 不再显示任何“占位”文本，直接加载 iframe
    tabPanel.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = href;
    iframe.setAttribute('title', '业务模块');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'auto');
    iframe.style.width = '100%';
    iframe.style.border = '0';
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

  // =============== 初始化：拉取导航，然后定位默认/记忆并渲染 ===============
  function initAfterNav(){
    restoreState();

    // 缺省 L1/L2/L3（优先 YAML 的 default）
    const l1 = items.find(x=>x.path===lockedPath) || items[0] || null;
    if(!l1){ items=[]; renderL1(); return; }
    lockedPath = l1.path;

    const sub = (lockedSubHref && (l1.children||[]).find(s=>s.path===lockedSubHref)) || pickDefaultL2(l1);
    lockedSubHref = sub ? sub.path : '';

    const tab = (sub && lockedTabHref && (sub.children||[]).find(t=>t.path===lockedTabHref)) || pickDefaultL3(sub);
    lockedTabHref = tab ? tab.path : '';

    renderL1(); renderSub(); renderTabs();
    loadTabContent(lockedTabHref);
    movePillToL1Path(lockedPath);
    saveState();
  }

  async function bootstrap(){
    if(!USE_REAL_NAV){
      // 演示/降级：仅保留一条可运行路径，方便前端联调
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
      // 极端情况下用降级导航
      items = [];
    }
    initAfterNav();
  }

  bootstrap();
})();
