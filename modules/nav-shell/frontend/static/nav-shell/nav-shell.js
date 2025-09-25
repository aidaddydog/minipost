// 动态加载导航：从 /api/v1/shell/nav 获取 l1/l2/l3，并渲染到提供的 UI 结构中
(function(){
  const GRACE_MS = 220;

  const track=document.getElementById('navTrack'),
        pill=document.getElementById('pill'),
        subRow=document.getElementById('subRow'),
        subInner=document.getElementById('subInner'),
        tabsEl=document.getElementById('tabs'),
        tabCard=document.getElementById('tabCard'),
        avatar=document.querySelector('.avatar');

  if(!track || !pill){ return; }

  let navData = { l1:[], l2:{}, l3:{} };
  let lockedPath = '', lockedSubHref = '', lockedTabHref = '';
  let hoverPath = '', inSubRow=false, leaveTimer=null;

  // 胶囊动画
  let _raf = 0, _next = null;
  function movePillToEl(el){
    if(!el) return;
    const left = el.offsetLeft - track.scrollLeft;
    const minw=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pill-minw'))||60;
    const width = Math.max(minw, el.offsetWidth);
    _next = {left,width};
    if(_raf) return;
    _raf = requestAnimationFrame(()=>{
      _raf = 0;
      if(!_next) return;
      pill.style.width = _next.width + 'px';
      pill.style.transform = `translate(${_next.left}px,-50%)`;
      pill.style.opacity = 1;
      _next = null;
    });
  }

  function renderL1(){
    const links = navData.l1.slice().sort((a,b)=>{
      const oa=(a.order??999)-(b.order??999);
      return oa || String(a.text||'').localeCompare(String(b.text||''));
    }).map(item=>{
      return `<a class="link" data-path="${item.href}" href="${item.href}">${item.text||item.key||''}</a>`
    }).join('');
    track.innerHTML = `<div class="pill" id="pill" aria-hidden="true"></div>` + links;
  }

  function renderSub(path){
    const list = (navData.l2 && navData.l2[path]) || [];
    subInner.innerHTML = list.map(i=>`<a class="sub" data-owner="${path}" href="${i.href}">${i.text||i.key||''}</a>`).join('');
    // 激活态
    if(lockedSubHref){
      const t=[...subInner.querySelectorAll('.sub')].find(a=>a.getAttribute('href')===lockedSubHref);
      if(t) t.classList.add('active');
    }
    renderTabs(lockedSubHref);
  }

  function ensureTabInk(){
    let ink=document.getElementById('tabInk');
    if(!ink){
      ink=document.createElement('span');
      ink.id='tabInk'; ink.className='tab-ink';
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
    const padX  = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tab-ink-pad-x'))||0;
    const ml    = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tab-ink-ml'))||0;
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

  function renderTabs(subHref){
    tabsEl.innerHTML = '';
    const tabs = (navData.l3 && navData.l3[subHref]) || [];
    if(!tabs.length){
      tabCard && tabCard.classList.add('no-tabs');
      ensureTabInk();
      return;
    }
    if(!lockedTabHref || !tabs.some(t=>t.href===lockedTabHref)){
      lockedTabHref = tabs[0].href;
    }
    tabsEl.innerHTML = tabs.map(t=>`<a class="tab ${t.href===lockedTabHref?'active':''}" data-sub="${subHref}" href="${t.href}"><span class="tab__text">${t.text||t.key||''}</span></a>`).join('');
    tabCard && tabCard.classList.remove('no-tabs');
    requestAnimationFrame(()=>positionTabInk(tabsEl.querySelector('.tab.active'), false));
  }

  function highlightActive(){
    const links = [...track.querySelectorAll('.link')];
    links.forEach(a=>a.classList.toggle('active', a.dataset.path===lockedPath));
  }

  function saveState(){
    try{
      const obj = { v: 11, lockedPath, lockedSubHref, lockedTabHref, ts: Date.now() };
      localStorage.setItem('NAV_STATE_V11', JSON.stringify(obj));
    }catch(e){}
  }
  function readState(){
    try{
      const raw = localStorage.getItem('NAV_STATE_V11');
      if(!raw) return;
      const o = JSON.parse(raw);
      if(o && o.v === 11){
        lockedPath = o.lockedPath || lockedPath;
        lockedSubHref = o.lockedSubHref || lockedSubHref;
        lockedTabHref = o.lockedTabHref || lockedTabHref;
      }
    }catch(e){}
  }

  async function loadProfile(){
    try{
      const res = await fetch('/api/v1/shell/profile');
      const j = await res.json();
      if(!j.authenticated){
        // 未登录：头像区域显示“登录”
        if(avatar){
          avatar.innerHTML = '';
          const a=document.createElement('a');
          a.href='/login'; a.textContent='登录';
          a.className='link-top';
          avatar.style.display='flex';
          avatar.style.alignItems='center';
          avatar.style.justifyContent='center';
          avatar.appendChild(a);
        }
      }else{
        // 可扩展显示用户名、退出等
      }
    }catch(e){}
  }

  async function loadNav(){
    const res = await fetch('/api/v1/shell/nav');
    navData = await res.json();
    renderL1();
    const links = [...track.querySelectorAll('.link')];
    readState();
    if(!lockedPath || !navData.l1.some(it=>it.href===lockedPath)){ lockedPath = (navData.l1[0] && navData.l1[0].href) || ''; }
    hoverPath = lockedPath;
    movePillToEl(links.find(a=>a.dataset.path===lockedPath)||links[0]);
    renderSub(lockedPath);
    highlightActive();

    // 交互
    links.forEach(a=>{
      a.addEventListener('pointerenter',()=>{
        if(inSubRow) return;
        hoverPath = a.dataset.path;
        movePillToEl(a);
        const list = (navData.l2 && navData.l2[hoverPath]) || [];
        subInner.innerHTML = list.map(i=>`<a class="sub" data-owner="${hoverPath}" href="${i.href}">${i.text||i.key||''}</a>`).join('');
      });
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        lockedPath = a.dataset.path || '';
        const list = (navData.l2 && navData.l2[lockedPath]) || [];
        lockedSubHref = list[0] ? list[0].href : '';
        lockedTabHref = '';
        saveState();
        hoverPath = lockedPath;
        highlightActive();
        renderSub(lockedPath);
      });
    });

    track.addEventListener('pointerleave', ()=>{
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(()=>{
        if(!inSubRow){
          hoverPath = lockedPath;
          movePillToEl(links.find(x=>x.dataset.path===lockedPath)||links[0]);
          renderSub(lockedPath);
        }
      }, GRACE_MS);
    });

    subRow.addEventListener('pointerenter',()=>{ inSubRow=true; clearTimeout(leaveTimer); });
    subRow.addEventListener('pointerleave',()=>{ inSubRow=false; hoverPath=lockedPath; movePillToEl(links.find(x=>x.dataset.path===lockedPath)||links[0]); renderSub(lockedPath); });

    subInner.addEventListener('pointerover',(e)=>{
      const s=e.target.closest('a.sub'); if(!s) return;
      const ownerEl=[...track.querySelectorAll('.link')].find(a=>a.dataset.path===s.getAttribute('data-owner'));
      if(ownerEl) movePillToEl(ownerEl);
    });

    subInner.addEventListener('click', (e)=>{
      const a = e.target.closest('a.sub'); if(!a) return;
      e.preventDefault();
      lockedPath = a.getAttribute('data-owner') || lockedPath;
      lockedSubHref = a.getAttribute('href') || '';
      const tabs = (navData.l3 && navData.l3[lockedSubHref]) || [];
      lockedTabHref = tabs[0] ? tabs[0].href : '';
      saveState();
      renderSub(lockedPath);
    });

    tabsEl.addEventListener('click', (e)=>{
      const t=e.target.closest('a.tab'); if(!t) return;
      e.preventDefault();
      tabsEl.querySelectorAll('.tab').forEach(a=>a.classList.remove('active'));
      t.classList.add('active');
      lockedTabHref=t.getAttribute('href')||'';
      saveState();
      positionTabInk(t, true);
    });

    track.addEventListener('scroll',()=>{
      const links=[...track.querySelectorAll('.link')];
      const current = links.find(x=>x.dataset.path===hoverPath)||links[0];
      movePillToEl(current);
    });
  }

  loadProfile();
  loadNav();

  // 自适应：窗口变动时定位 ink
  window.addEventListener('resize', ()=>{
    positionTabInk(tabsEl.querySelector('.tab.active'), false);
  });
})();
