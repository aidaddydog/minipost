/* ===== 行为与状态 ===== */
    const SCHEMA_VERSION = 11;
    const STORAGE_KEY_NEW = 'NAV_STATE_V11';
    const STORAGE_KEY_OLD = 'NAV_STATE_V10';

    const USE_REAL_NAV = true;
    const GRACE_MS = 220;

    // DOM 引用
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
    const jumpTo=document.getElementById('jumpTo');
    const goTop=document.getElementById('goTop');
    const selAll=document.getElementById('selAll'), selInvert=document.getElementById('selInvert');
    const selCounter=document.getElementById('selCounter');

    // 弹窗引用
    const bulkModal=document.getElementById('bulkModal'), bulkText=document.getElementById('bulkText');
    const bulkCancel=document.getElementById('bulkCancel'), bulkApply=document.getElementById('bulkApply');
    const opModal=document.getElementById('opModal'), opTitle=document.getElementById('opTitle'), opContent=document.getElementById('opContent');
    const opCancel=document.getElementById('opCancel'), opConfirm=document.getElementById('opConfirm');

    // 页面交互状态
    let lockedPath=links[0].dataset.path||'/orders';
    let lockedSubHref='';  // 二级
    let lockedTabHref='';  // 三级
    let hoverPath=lockedPath, inSubRow=false, leaveTimer=null;

    // 当前页签上下文：'labelList' | 'logs'
    let currentTabContext='labelList';

    // 列表页：勾选状态
    let selectedIds = new Set();

    /* 工具 */
    const _escMap = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' };
    const h = (s)=>String(s==null?'':s).replace(/[&<>"']/g, m=>_escMap[m]);
    const cssVarNum = (name, fallback=0)=>{
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if(!v) return fallback;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : fallback;
    };

    /* 一级胶囊位移 */
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

    /* 统一关闭所有下拉 */
    function closeAllMenus(exceptEl=null){
      document.querySelectorAll('.dropdown.open').forEach(el=>{
        if(el!==exceptEl) el.classList.remove('open');
      });
      document.querySelectorAll('.cselect.open').forEach(el=>{
        if(el!==exceptEl){
          el.classList.remove('open');
          const btn=el.querySelector('.cs-toggle');
          if(btn) btn.setAttribute('aria-expanded','false');
        }
      });
    }
    document.addEventListener('click',(e)=>{
      if(!e.target.closest('.dropdown') && !e.target.closest('.cselect')) closeAllMenus(null);
    });
    document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeAllMenus(null); });

    /* 自定义选择框升级（ARIA+键盘） */
    function upgradeSelectToMenu(selectEl, opts={ sizeLike:false, dropUp:false }){
      if(!selectEl || selectEl.dataset.enhanced === '1') return;

      const wrapper = document.createElement('div');
      wrapper.className = 'cselect' + (opts.sizeLike ? ' size-like' : '') + (opts.dropUp ? ' dropup' : '');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cs-toggle';
      btn.setAttribute('aria-haspopup','listbox');
      btn.setAttribute('aria-expanded','false');

      const txtSpan = document.createElement('span'); txtSpan.className = 'cs-text';
      const curOpt = selectEl.options[selectEl.selectedIndex] || null;
      txtSpan.textContent = curOpt ? curOpt.text : '';
      const caret = document.createElement('span'); caret.className = 'caret'; caret.textContent = '▾';
      btn.appendChild(txtSpan); btn.appendChild(caret);

      const menu = document.createElement('div'); menu.className = 'menu'; menu.setAttribute('role','listbox'); menu.tabIndex = -1;

      const aEls = [];
      [...selectEl.options].forEach((opt, idx)=>{
        const a = document.createElement('a');
        a.href = '#';
        a.dataset.value = opt.value;
        a.textContent = opt.text;
        a.setAttribute('role','option');
        if(idx===selectEl.selectedIndex) a.setAttribute('aria-selected','true');
        a.addEventListener('click', (e)=>{
          e.preventDefault();
          selectEl.value = opt.value;
          txtSpan.textContent = opt.text;
          menu.querySelectorAll('[aria-selected]').forEach(x=>x.removeAttribute('aria-selected'));
          a.setAttribute('aria-selected','true');
          selectEl.dispatchEvent(new Event('change', { bubbles:true }));
          closeAllMenus(null);
          btn.focus();
        });
        menu.appendChild(a); aEls.push(a);
      });

      selectEl.classList.add('sr-select'); selectEl.dataset.enhanced = '1';
      selectEl.parentNode.insertBefore(wrapper, selectEl);
      wrapper.appendChild(selectEl); wrapper.appendChild(btn); wrapper.appendChild(menu);

      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        const willOpen = !wrapper.classList.contains('open');
        closeAllMenus(willOpen?wrapper:null);
        wrapper.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', willOpen?'true':'false');
        if(willOpen){
          const cur = aEls.find(a=>a.getAttribute('aria-selected')==='true') || aEls[0];
          if(cur) { menu.focus({preventScroll:true}); setTimeout(()=>cur.scrollIntoView({block:'nearest'}),0); }
        }
      });

      btn.addEventListener('keydown', (e)=>{
        if(e.key==='ArrowDown' || e.key==='Enter' || e.key===' '){
          e.preventDefault(); btn.click();
        }
      });

      menu.addEventListener('keydown', (e)=>{
        const curIdx = aEls.findIndex(a=>a.getAttribute('aria-selected')==='true');
        if(e.key==='Escape'){ e.preventDefault(); closeAllMenus(null); btn.focus(); return; }
        let next = curIdx;
        if(e.key==='ArrowDown'){ next = Math.min(aEls.length-1, curIdx+1); }
        else if(e.key==='ArrowUp'){ next = Math.max(0, curIdx-1); }
        else if(e.key==='Home'){ next = 0; }
        else if(e.key==='End'){ next = aEls.length-1; }
        else if(e.key==='Enter' || e.key===' '){
          e.preventDefault(); const cur = aEls[curIdx>=0?curIdx:0]; if(cur) cur.click(); return;
        }else{ return; }
        e.preventDefault();
        if(next!==curIdx && aEls[next]){
          menu.querySelectorAll('[aria-selected]').forEach(x=>x.removeAttribute('aria-selected'));
          aEls[next].setAttribute('aria-selected','true');
          aEls[next].scrollIntoView({block:'nearest'});
        }
      });
    }

    /* 二级菜单映射 */
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

    /* 三级页签映射：新增“面单上传”的两个子页签 */
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
    const DEFAULT_TAB_BY_SUB={
      '/orders/prealert':'/orders/prealert/list',
      '/orders/label-upload':'/orders/label-upload/list'
    };

    /* ===== 三级页签：横线（点击才滑动） ===== */
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

    /* 渲染二级 & 三级 */
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
        tableWrap.classList.add('hidden');
        logsTableWrap.classList.add('hidden');
        footerBar.classList.add('hidden');
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

      // 内容
      updatePanelForActiveTab(subHref);

      // 初始定位（无动画）
      requestAnimationFrame(()=>positionTabInk(tabsEl.querySelector('.tab.active'), false));
    }

    function updateSubRowMinHeight(){
      const textH=subInner.getBoundingClientRect().height||0;
      const extra=5;
      subRow.style.minHeight=(textH+extra)+'px';
    }

    function highlightActive(){ links.forEach(a=>a.classList.toggle('active',a.dataset.path===lockedPath)); }

    /* ========= 面单列表（原有逻辑保持） ========= */
    let masterRows=[], viewRows=[], pageSize=50, pageIndex=1;
    let sortKey='status', sortDir='asc';
    const STATUS_ORDER = { '已预报':0, '待换单':1, '待导入面单':2, '待映射订单号':3, '已换单':4 };

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
        </div>
      `;

      tableWrap.classList.remove('hidden');
      logsTableWrap.classList.add('hidden');
      footerBar.classList.remove('hidden');

      if(!masterRows.length){ masterRows = genDemoRows(120); }
      pageSize=parseInt(pageSizeSel.value,10)||50;
      pageIndex=1;

      bindLabelUploadEvents();
      applyFilters();
      fitTableHeight();
      updateSortBtnsUI();
    }

    function genDemoRows(n=100){
      const statuses=['已预报','待映射订单号','待导入面单','待换单','已换单'];
      const ships=['USPS','JC',''];
      const now=Date.now(); const rows=[];
      for(let i=1;i<=n;i++){
        const created=new Date(now - Math.floor(Math.random()*60)*86400000 - Math.floor(Math.random()*86400000));
        const printed=Math.random()<0.6 ? new Date(created.getTime()+Math.floor(Math.random()*3)*86400000 + Math.floor(Math.random()*86400000)) : null;
        const pad=(x,len)=>String(x).padStart(len,'0');
        rows.push({
          id:i,
          orderNo:`OD${created.getFullYear()}${pad(created.getMonth()+1,2)}${pad(created.getDate(),2)}${pad(i,4)}`,
          waybill:`1Z${Math.random().toString(36).slice(2,10).toUpperCase()}${Math.floor(Math.random()*1e6)}`,
          transNo:`TR${pad(i,6)}`,
          ship:ships[Math.floor(Math.random()*ships.length)],
          file: Math.random() < 0.12 ? '' : `label_${pad(i,4)}.pdf`,
          status:statuses[Math.floor(Math.random()*statuses.length)],
          createdAt:created, printedAt:printed, voided:false
        });
      }
      return rows;
    }

    function toLocal(d){ const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
    function formatDateTime(d){ if(!(d instanceof Date) || isNaN(d)) return '-'; const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }
    function enhanceDateInputs(inputs){
      inputs.forEach(inp=>{
        if(!inp) return;
        if(typeof inp.showPicker === 'function'){
          inp.addEventListener('click', (e)=>{ e.preventDefault(); inp.showPicker(); });
          inp.addEventListener('keydown', (e)=>{ if(e.key!=='Tab') e.preventDefault(); });
        }
      });
    }

    /* ========= 上传记录（新增） ========= */
    let logsMasterRows=[], logsViewRows=[], logsPageIndex=1;
    let currentLogsNos=[], currentLogsMode='fail';

    function renderLabelUploadLogsPanel(){
      currentTabContext='logs';
      toggleFooterSelectionControls(false);

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
        </div>
      `;

      tableWrap.classList.add('hidden');
      logsTableWrap.classList.remove('hidden');
      footerBar.classList.remove('hidden');

      if(!logsMasterRows.length){ logsMasterRows = genUploadLogs(36); }
      pageSize=parseInt(pageSizeSel.value,10)||50;
      logsPageIndex=1;

      bindLogsEvents();
      applyLogsFilters();
      fitTableHeight();
    }

    function genUploadLogs(n=20){
      // 生成演示“上传记录”：含成功/失败单号，类型/操作人
      const ops = ['系统','王涛','Emma','Jack','Lucy','运营A'];
      const types = ['面单文件','运单号'];
      const out=[];
      for(let i=1;i<=n;i++){
        const d=new Date(Date.now()-Math.floor(Math.random()*45)*86400000 - Math.floor(Math.random()*10)*3600000);
        const pad = (x,len=2)=>String(x).padStart(len,'0');
        const type = types[Math.random()<0.6?0:1];
        const total = 50 + Math.floor(Math.random()*150);
        const success = 30 + Math.floor(Math.random()*(total-30));
        const fail = Math.max(0,total-success);
        const mkWB = ()=>`1Z${Math.random().toString(36).slice(2,10).toUpperCase()}${Math.floor(Math.random()*1e5)}`;
        const mkOD = (i)=>`OD${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(i,4)}`;
        const numsSucc = Array.from({length:success},(_,k)=> type==='运单号'? mkWB() : mkOD(k+1));
        const numsFail = Array.from({length:fail},(_,k)=> type==='运单号'? mkWB() : mkOD(k+2001));
        out.push({
          id:i,
          time:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
          file:`upload_${pad(d.getMonth()+1)}${pad(d.getDate())}_${String(Math.floor(Math.random()*9999)).padStart(4,'0')}.${type==='面单文件'?'xlsx':'txt'}`,
          type, total, success, fail, operator:ops[Math.floor(Math.random()*ops.length)],
          successNos:numsSucc, failNos:numsFail
        });
      }
      return out.sort((a,b)=>a.time<b.time?1:-1);
    }

    function bindLogsEvents(){
      const s=document.getElementById('logsStart'), e=document.getElementById('logsEnd');
      const quickDrop=document.getElementById('logsQuickDrop'), quickBtn=document.getElementById('logsQuickBtn');
      const resetBtn=document.getElementById('logsResetBtn');

      enhanceDateInputs([s,e]);

      if(quickBtn && quickDrop){
        quickBtn.addEventListener('click',(ev)=>{
          ev.stopPropagation();
          const willOpen = !quickDrop.classList.contains('open');
          closeAllMenus(willOpen?quickDrop:null);
          quickDrop.classList.toggle('open', willOpen);
        });
        quickDrop.querySelectorAll('.menu a').forEach(a=>{
          a.addEventListener('click',(e2)=>{
            e2.preventDefault();
            const days=parseInt(a.dataset.days||'',10);
            if(Number.isFinite(days)){
              const to=new Date(); const from=new Date(to.getTime()-days*86400000);
              s.value=toLocal(from); e.value=toLocal(to);
            }
            closeAllMenus(null); applyLogsFilters();
          });
        });
      }

      if(resetBtn) resetBtn.addEventListener('click', ()=>{ s.value=''; e.value=''; applyLogsFilters(); });

      // 日志图标点击（事件代理）
      logsTbody.addEventListener('click', (e)=>{
        const btn = e.target.closest('button.log-view');
        if(!btn) return;
        const id = Number(btn.dataset.id);
        const row = logsMasterRows.find(x=>x.id===id);
        if(row) openUploadLogModal(row, 'fail'); // 默认先显示失败
      });
    }

    function applyLogsFilters(){
      const s=document.getElementById('logsStart').value;
      const e=document.getElementById('logsEnd').value;
      const st = s ? new Date(s).getTime() : null;
      const et = e ? new Date(e).getTime() : null;

      logsViewRows = logsMasterRows.filter(r=>{
        const ts = new Date(r.time.replace(/-/g,'/')).getTime();
        if(st!==null && ts<st) return false;
        if(et!==null && ts>et) return false;
        return true;
      });
      logsPageIndex=1;
      renderLogsTable();
    }

    function renderLogsTable(){
      const start=(logsPageIndex-1)*pageSize, slice=logsViewRows.slice(start, start+pageSize);
      logsTbody.innerHTML = slice.map(r=>`
        <tr data-id="${r.id}">
          <td>${h(r.time)}</td>
          <td>${h(r.file)}</td>
          <td>${h(r.type)}</td>
          <td>${r.total}</td>
          <td>${r.success}</td>
          <td>${r.fail}</td>
          <td>${h(r.operator)}</td>
          <td>
            <button class="btn-link log-view" data-id="${r.id}" title="查看上传日志">
              <svg width="24" height="24" viewBox="0 0 48 48" fill="none"><path d="M42.354 40.854L36.01 34.51m0 0a9 9 0 01-15.364-6.364c0-5 4-9 9-9s9 4 9 9a8.972 8.972 0 01-2.636 6.364zm5.636-26.365h-36m10 16h-10m10 16h-10" stroke="#4E5969" stroke-width="2"/></svg>
            </button>
          </td>
        </tr>
      `).join('');

      // 底栏
      pageInfo.textContent=`共 ${logsViewRows.length} 条 ${logsPageIndex}/${totalPagesLogs()} 页`;
      jumpTo.value=logsPageIndex;

      const pages=totalPagesLogs(); const nums=[];
      const sIdx=Math.max(1,logsPageIndex-2), eIdx=Math.min(pages,logsPageIndex+2);
      for(let i=sIdx;i<=eIdx;i++){ nums.push(`<a href="#" data-p="${i}" style="${i===logsPageIndex?'font-weight:700;text-decoration:underline':''}">${i}</a>`); }
      pageNums.innerHTML=nums.join('');
      pageNums.querySelectorAll('a').forEach(a=>a.addEventListener('click',(e)=>{ e.preventDefault(); logsPageIndex=+a.dataset.p; renderLogsTable(); fitTableHeight(); }));

      fitTableHeight();
    }
    function totalPagesLogs(){ return Math.max(1, Math.ceil(logsViewRows.length/pageSize)); }

    function openUploadLogModal(row, mode='fail'){
      currentLogsMode = mode;
      currentLogsNos = mode==='fail' ? row.failNos : row.successNos;

      opTitle.textContent = `上传日志（${row.type}｜${row.file}）`;
      opContent.innerHTML = `
        <div style="display:flex;gap:8px;margin:6px 0 10px;">
          <button type="button" class="btn ${mode==='success'?'btn--black':''}" data-logtab="success">成功（${row.success}）</button>
          <button type="button" class="btn ${mode==='fail'?'btn--black':''}" data-logtab="fail">失败（${row.fail}）</button>
          <span style="margin-left:auto;color:#64748b;">点击“确认”复制当前列表</span>
        </div>
        <textarea id="logListBox" readonly>${h(currentLogsNos.join('\n'))}</textarea>
      `;
      currentAction = 'copy-upload-logs';
      openModal(opModal);

      const switchTab = (m)=>{
        currentLogsMode = m;
        currentLogsNos = m==='fail' ? row.failNos : row.successNos;
        const box = document.getElementById('logListBox');
        if(box) box.value = currentLogsNos.join('\n');
        opContent.querySelectorAll('[data-logtab]').forEach(b=>b.classList.toggle('btn--black', b.dataset.logtab===m));
      };
      opContent.querySelectorAll('[data-logtab]').forEach(b=>{
        b.addEventListener('click', ()=> switchTab(b.dataset.logtab));
      });
    }

    /* ========= 共有函数 ========= */
    function fitTableHeight(){
      requestAnimationFrame(()=>{
        const wrap = document.querySelector('.table-wrap:not(.hidden)');
        if(!wrap) return;
        const scroller = wrap.querySelector('.table-scroll');
        if(!scroller) return;
        const top = scroller.getBoundingClientRect().top;
        const footerTop = footerBar.classList.contains('hidden') ? window.innerHeight : footerBar.getBoundingClientRect().top;
        const h = Math.max(120, Math.floor(footerTop - top - 12));
        scroller.style.maxHeight = h + 'px';
        scroller.style.height    = h + 'px';
      });
    }

    function getCurrentPageRows(){ const start=(pageIndex-1)*pageSize; return viewRows.slice(start, start+pageSize); }
    function getSelectedRows(){ return masterRows.filter(r=>selectedIds.has(r.id)); }

    async function copyToClipboard(text){
      try{ await navigator.clipboard.writeText(text); return true; }
      catch(e){
        try{ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); return true; }
        catch(e2){ return false; }
      }
    }
    function updateSelCounter(){ if(selCounter) selCounter.textContent = `已选择 ${selectedIds.size} 条`; }

    // 列表页：排序
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

    // 底栏在记录页隐藏“选择类”元素
    function toggleFooterSelectionControls(show){
      [selAll, selInvert, selCounter].forEach(el=>{ if(el) el.classList.toggle('hidden', !show); });
    }

    /* ===== 列表页：事件绑定（含底栏事件统一路由到当前视图） ===== */
    let _globalEventsBound = false, currentAction = '';
    function bindLabelUploadEvents(){
      const bulkDrop=document.getElementById('bulkDrop'), bulkBtn=document.getElementById('bulkBtn');
      const startTime=document.getElementById('startTime'), endTime=document.getElementById('endTime');
      const statusSel=document.getElementById('statusSel'), shipSel=document.getElementById('shipSel');
      const kw=document.getElementById('kw'), searchBtn=document.getElementById('searchBtn');
      const quickDrop=document.getElementById('quickDrop'), quickBtn=document.getElementById('quickBtn');
      const timeField=document.getElementById('timeField');
      const resetBtn=document.getElementById('resetBtn');

      // 升级 select（ARIA+键盘）
      upgradeSelectToMenu(timeField);
      upgradeSelectToMenu(statusSel);
      upgradeSelectToMenu(shipSel);

      // 日期输入增强
      enhanceDateInputs([startTime,endTime]);

      // 批量操作
      if(bulkBtn && bulkDrop){
        bulkBtn.addEventListener('click',(e)=>{
          e.stopPropagation();
          const willOpen = !bulkDrop.classList.contains('open');
          closeAllMenus(willOpen?bulkDrop:null);
          bulkDrop.classList.toggle('open', willOpen);
        });
        bulkDrop.querySelectorAll('.menu a').forEach(a=>{
          a.addEventListener('click',(e)=>{
            e.preventDefault();
            openOpModal(a.dataset.act || '', bulkBtn);
            closeAllMenus(null);
          });
        });
      }

      // 快捷时间
      if(quickBtn && quickDrop){
        quickBtn.addEventListener('click',(e)=>{
          e.stopPropagation();
          const willOpen = !quickDrop.classList.contains('open');
          closeAllMenus(willOpen?quickDrop:null);
          quickDrop.classList.toggle('open', willOpen);
        });
        quickDrop.querySelectorAll('.menu a').forEach(a=>{
          a.addEventListener('click',(e)=>{
            e.preventDefault();
            const days=parseInt(a.dataset.days||'',10);
            if(Number.isFinite(days)){
              const to=new Date(); const from=new Date(to.getTime()-days*86400000);
              startTime.value=toLocal(from); endTime.value=toLocal(to);
            }
            closeAllMenus(null); applyFilters();
          });
        });
      }

      // 搜索与批量粘贴
      if(searchBtn) searchBtn.addEventListener('click',()=>{ applyFilters(); fitTableHeight(); });
      if(kw){
        kw.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ applyFilters(); fitTableHeight(); } });
        kw.addEventListener('dblclick', ()=>{ bulkText.value=''; openModal(bulkModal, kw); bulkText.focus(); });
      }

      // 批量粘贴弹窗
      if(bulkCancel) bulkCancel.addEventListener('click', ()=> closeModal(bulkModal));
      if(bulkApply) bulkApply.addEventListener('click', ()=>{
        const ids = bulkText.value.split(/\s+/).map(s=>s.trim()).filter(Boolean);
        if(ids.length){ kw.value = ids.join(' '); applyFilters(); fitTableHeight(); }
        closeModal(bulkModal);
      });

      // 切换时间字段
      if(timeField) timeField.addEventListener('change', ()=>{ applyFilters(); });

      // 重置筛选
      if(resetBtn) resetBtn.addEventListener('click', ()=>{
        document.getElementById('startTime').value='';
        document.getElementById('endTime').value='';
        document.getElementById('kw').value='';
        timeField.value='created';
        statusSel.value='';
        shipSel.value='';
        [timeField,statusSel,shipSel].forEach(sel=>{
          const wrap=sel?.closest?.('.cselect'); if(!wrap) return;
          const txt=wrap.querySelector('.cs-text'); const cur=sel.options[sel.selectedIndex]||null;
          if(txt) txt.textContent = cur ? cur.text : '';
        });
        applyFilters();
      });

      // ===== 持久节点（只绑定一次） =====
      if(_globalEventsBound) return;
      _globalEventsBound = true;

      const chkAll=document.getElementById('chkAll');
      const sortStatusBtn=document.getElementById('sortStatus'), sortTimeBtn=document.getElementById('sortTime');

      // 表头复选框（列表页）
      if(chkAll) chkAll.addEventListener('change',()=>{
        if(currentTabContext!=='labelList') return;
        const slice=getCurrentPageRows();
        if(chkAll.checked){ slice.forEach(r=>selectedIds.add(r.id)); }
        else{ slice.forEach(r=>selectedIds.delete(r.id)); }
        updateCurrentPageSelectionUI();
      });

      // 表体按钮（列表页）
      tbodyEl.addEventListener('click', (e)=>{
        if(currentTabContext!=='labelList') return;
        const prevBtn = e.target.closest('button.preview');
        if(prevBtn){
          e.preventDefault();
          if(prevBtn.disabled) return;
          alert('这里是“预览”占位：接入你的文件预览逻辑即可。');
          return;
        }
        const toggleBtn = e.target.closest('button.toggle-void');
        if(toggleBtn){
          e.preventDefault();
          const id = Number(toggleBtn.dataset.id);
          const row = masterRows.find(r=>r.id===id);
          if(!row) return;
          row.voided = !row.voided;
          const tr = tbodyEl.querySelector(`tr[data-id="${id}"]`);
          if(tr){
            tr.classList.toggle('voided', row.voided);
            const statusCell = tr.querySelector('.col-status');
            if(statusCell) statusCell.textContent = `${row.status}${row.voided ? '｜已作废' : ''}`;
            toggleBtn.textContent = row.voided ? '激活' : '作废';
          }
        }
      });

      // 单行勾选（列表页）
      tbodyEl.addEventListener('change', (e)=>{
        if(currentTabContext!=='labelList') return;
        if(e.target && e.target.matches('input.rowchk')){
          const id = +e.target.getAttribute('data-id');
          if(e.target.checked) selectedIds.add(id); else selectedIds.delete(id);
          syncHeaderCheckbox(); updateSelCounter();
          const tr=e.target.closest('tr'); if(tr) tr.classList.toggle('selected', e.target.checked);
        }
      });

      // 页脚分页（根据当前视图路由）
      pageSizeSel.addEventListener('change',()=>{
        pageSize=parseInt(pageSizeSel.value,10)||50;
        if(currentTabContext==='logs'){ logsPageIndex=1; renderLogsTable(); }
        else{ pageIndex=1; renderTable(); }
        fitTableHeight();
      });
      firstPage.addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext==='logs'){ logsPageIndex=1; renderLogsTable(); } else { pageIndex=1; renderTable(); } fitTableHeight(); });
      prevPage .addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext==='logs'){ logsPageIndex=Math.max(1,logsPageIndex-1); renderLogsTable(); } else { pageIndex=Math.max(1,pageIndex-1); renderTable(); } fitTableHeight(); });
      nextPage .addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext==='logs'){ logsPageIndex=Math.min(totalPagesLogs(),logsPageIndex+1); renderLogsTable(); } else { pageIndex=Math.min(totalPages(),pageIndex+1); renderTable(); } fitTableHeight(); });
      lastPage .addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext==='logs'){ logsPageIndex=totalPagesLogs(); renderLogsTable(); } else { pageIndex=totalPages(); renderTable(); } fitTableHeight(); });
      jumpTo   .addEventListener('change',()=>{ const p=+jumpTo.value||1; if(currentTabContext==='logs'){ logsPageIndex=Math.min(Math.max(1,p),totalPagesLogs()); renderLogsTable(); } else { pageIndex=Math.min(Math.max(1,p),totalPages()); renderTable(); } fitTableHeight(); });

      // 全选 / 反选（仅列表页）
      selAll.addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext!=='labelList') return; const slice=getCurrentPageRows(); slice.forEach(r=>selectedIds.add(r.id)); updateCurrentPageSelectionUI(); });
      selInvert.addEventListener('click',(e)=>{ e.preventDefault(); if(currentTabContext!=='labelList') return; const slice=getCurrentPageRows(); slice.forEach(r=>{ if(selectedIds.has(r.id)) selectedIds.delete(r.id); else selectedIds.add(r.id); }); updateCurrentPageSelectionUI(); });

      // 回到顶部：滚动当前可见表格
      goTop.addEventListener('click',(e)=>{
        e.preventDefault();
        const sc=document.querySelector('.table-wrap:not(.hidden) .table-scroll');
        if(sc) sc.scrollTo({top:0, behavior:'smooth'});
      });

      // 列头排序（列表页）
      const bs=document.getElementById('sortStatus'), bt=document.getElementById('sortTime');
      if(bs) bs.addEventListener('click', ()=>{
        if(currentTabContext!=='labelList') return;
        if(sortKey==='status'){ sortDir = (sortDir==='asc'?'desc':'asc'); } else { sortKey='status'; sortDir='asc'; }
        sortRows(); pageIndex=1; renderTable(); updateSortBtnsUI();
      });
      if(bt) bt.addEventListener('click', ()=>{
        if(currentTabContext!=='labelList') return;
        if(sortKey==='time'){ sortDir = (sortDir==='asc'?'desc':'asc'); } else { sortKey='time'; sortDir='desc'; }
        sortRows(); pageIndex=1; renderTable(); updateSortBtnsUI();
      });

      // 页脚“每页”选择器升级
      upgradeSelectToMenu(pageSizeSel, { sizeLike:true, dropUp:true });
    }

    function updateCurrentPageSelectionUI(){
      const slice = getCurrentPageRows();
      const ids = new Set(slice.map(r=>r.id));
      tbodyEl.querySelectorAll('tr').forEach(tr=>{
        const id = Number(tr.getAttribute('data-id'));
        if(!ids.has(id)) return;
        const checked = selectedIds.has(id);
        const cb = tr.querySelector('input.rowchk');
        if(cb) cb.checked = checked;
        tr.classList.toggle('selected', checked);
      });
      syncHeaderCheckbox(); updateSelCounter();
    }

    function syncHeaderCheckbox(){
      const head=document.getElementById('chkAll');
      const slice=getCurrentPageRows();
      const total=slice.length;
      const sel = slice.filter(r=>selectedIds.has(r.id)).length;
      head.indeterminate = sel>0 && sel<total;
      head.checked = total>0 && sel===total;
    }

    /* 列表页过滤 + 渲染 */
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

      sortRows();
      pageIndex=1; renderTable();
    }

    function totalPages(){ return Math.max(1, Math.ceil(viewRows.length/pageSize)); }

    function renderTable(){
      const start=(pageIndex-1)*pageSize, slice=viewRows.slice(start,start+pageSize);
      tbodyEl.innerHTML='';
      let i = 0;
      function chunk(){
        const frag = document.createDocumentFragment();
        for(let c=0;c<50 && i<slice.length;c++,i++){
          const r = slice[i];
          const tr = document.createElement('tr');
          tr.setAttribute('data-id', String(r.id));
          if(selectedIds.has(r.id)) tr.classList.add('selected');
          if(r.voided) tr.classList.add('voided');

          const tdChk = document.createElement('td'); tdChk.className='col-chk';
          tdChk.innerHTML = `<input type="checkbox" class="chk rowchk" data-id="${r.id}" ${selectedIds.has(r.id)?'checked':''}>`;
          const tdOrder = document.createElement('td'); tdOrder.className='col-order';   tdOrder.textContent = r.orderNo;
          const tdWay   = document.createElement('td'); tdWay.className  ='col-waybill'; tdWay.textContent   = r.waybill;
          const tdTrans = document.createElement('td'); tdTrans.className='col-trans';   tdTrans.textContent = r.transNo;
          const tdShip  = document.createElement('td'); tdShip.className ='col-ship';    tdShip.textContent  = r.ship||'-';
          const tdFile  = document.createElement('td'); tdFile.className ='col-file';    tdFile.textContent  = r.file || '-';
          const tdStat  = document.createElement('td'); tdStat.className ='col-status';  tdStat.textContent  = `${r.status}${r.voided ? '｜已作废' : ''}`;

          const tdTime  = document.createElement('td'); tdTime.className ='col-created';
          tdTime.innerHTML = `
            <div class="time2">
              <div>创建时间：${h(formatDateTime(r.createdAt))}</div>
              <div>打印时间：${h(formatDateTime(r.printedAt))}</div>
            </div>`;

          const tdOp    = document.createElement('td'); tdOp.className='col-op';
          const hasFile = !!(r.file && r.file !== '-' && r.file.trim() !== '');
          const prevBtn = document.createElement('button');
          prevBtn.type='button'; prevBtn.className='btn-link preview'; prevBtn.textContent='预览';
          if(!hasFile){ prevBtn.disabled=true; }
          const toggleBtn = document.createElement('button');
          toggleBtn.type='button'; toggleBtn.className='btn-link toggle-void'; toggleBtn.dataset.id = String(r.id);
          toggleBtn.textContent = r.voided ? '激活' : '作废';
          tdOp.appendChild(prevBtn); tdOp.appendChild(toggleBtn);

          tr.appendChild(tdChk); tr.appendChild(tdOrder); tr.appendChild(tdWay); tr.appendChild(tdTrans);
          tr.appendChild(tdShip); tr.appendChild(tdFile); tr.appendChild(tdStat); tr.appendChild(tdTime); tr.appendChild(tdOp);
          frag.appendChild(tr);
        }
        tbodyEl.appendChild(frag);
        if(i<slice.length){ requestAnimationFrame(chunk); }
      }
      requestAnimationFrame(chunk);

      pageInfo.textContent=`共 ${viewRows.length} 条 ${pageIndex}/${totalPages()} 页`;
      jumpTo.value=pageIndex;

      const pages=totalPages(); const nums=[];
      const s=Math.max(1,pageIndex-2), e=Math.min(pages,pageIndex+2);
      for(let i=s;i<=e;i++){ nums.push(`<a href="#" data-p="${i}" style="${i===pageIndex?'font-weight:700;text-decoration:underline':''}">${i}</a>`); }
      pageNums.innerHTML=nums.join('');
      pageNums.querySelectorAll('a').forEach(a=>a.addEventListener('click',(e)=>{ e.preventDefault(); pageIndex=+a.dataset.p; renderTable(); fitTableHeight(); }));

      syncHeaderCheckbox();
      fitTableHeight();
      updateSelCounter();
    }

    /* 操作弹窗 */
    let lastTrigger = null;
    function queryFocusable(container){
      return [...container.querySelectorAll('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled && el.offsetParent!==null);
    }
    function setPageInert(inertOn){
      const nodes = [document.querySelector('.shell'), document.querySelector('.subrow'), document.querySelector('.tabrow'), document.getElementById('footerBar')].filter(Boolean);
      nodes.forEach(el=>{ if(inertOn){ el.setAttribute('inert',''); } else { el.removeAttribute('inert'); }});
      document.documentElement.style.overflow = inertOn ? 'hidden' : '';
    }
    function openModal(modal, opener=null){
      lastTrigger = opener || document.activeElement;
      modal.style.display = 'flex';
      setPageInert(true);
      const box = modal.querySelector('.box'); box && box.focus();
      function trap(e){
        if(e.key!=='Tab') return;
        const focusables = queryFocusable(modal);
        if(!focusables.length) return;
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

    function openOpModal(act, opener){
      currentAction = act;
      const count = getSelectedRows().length;

      if(act==='import-label'){
        opTitle.textContent = '导入面单';
        opContent.innerHTML = `<div>导入面单文件：</div>
          <div style="margin-top:8px"><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg"></div>`;
      }else if(act==='import-map'){
        opTitle.textContent = '导入单号映射';
        opContent.innerHTML = `<div>导入单号映射文件：</div>
          <div style="margin-top:8px"><input type="file" accept=".csv,.xlsx"></div>`;
      }else if(act==='delete'){
        opTitle.textContent = '批量删除';
        opContent.innerHTML = `<div>将删除已选 <strong>${count}</strong> 条记录。此操作不可恢复，请确认。</div>`;
      }else if(act==='export-orders'){
        opTitle.textContent = '订单导出';
        opContent.innerHTML = `<div>将导出当前筛选结果（或已选 <strong>${count}</strong> 条）。此为占位弹窗。</div>`;
      }else if(act==='copy-waybill'){
        const rows = getSelectedRows();
        const txt = rows.map(r=>r.waybill).filter(Boolean).join('\\n');
        opTitle.textContent = '批量复制单号';
        opContent.innerHTML = rows.length
          ? `<div style="color:#374151; margin-bottom:8px;">将复制 <strong>${rows.length}</strong> 个运单号到剪贴板。</div>
             <textarea readonly>${h(txt)}</textarea>
             <div style="margin-top:8px;color:#64748b;">（预览，可直接确认复制）</div>`
          : `<div style="color:#ef4444;">当前未选择任何记录，请先勾选需要复制的行。</div>`;
      }else if(act==='batch-print'){
        opTitle.textContent = '批量打印';
        opContent.innerHTML = `<div>将对已选 <strong>${count}</strong> 条记录执行批量打印（模拟）。确认开始打印？</div>`;
      }else if(act==='batch-activate'){
        opTitle.textContent = '批量激活';
        opContent.innerHTML = `<div>将把已选 <strong>${count}</strong> 条记录标记为激活（取消作废）。确认执行？</div>`;
      }else if(act==='batch-void'){
        opTitle.textContent = '批量作废';
        opContent.innerHTML = `<div>将把已选 <strong>${count}</strong> 条记录标记为作废（显示删除线）。确认执行？</div>`;
      }else{
        opTitle.textContent = '操作';
        opContent.textContent = '占位内容';
      }
      openModal(opModal, opener);
    }

    // 弹窗确定：在这里处理“上传记录复制”
    opCancel.addEventListener('click', ()=> closeModal(opModal));
    opConfirm.addEventListener('click', async ()=>{
      if(currentAction==='copy-upload-logs'){
        const txt = (currentLogsNos||[]).join('\n');
        if(!txt){ alert('当前列表为空。'); return; }
        const ok = await copyToClipboard(txt);
        closeModal(opModal);
        alert(ok ? `已复制 ${currentLogsNos.length} 条${currentLogsMode==='fail'?'失败':'成功'}记录到剪贴板。` : '复制失败：请手动全选并复制。');
        return;
      }

      if(currentAction==='copy-waybill'){
        const rows = getSelectedRows();
        const txt = rows.map(r=>r.waybill).filter(Boolean).join('\\n');
        if(!txt){ alert('没有可复制的运单号。'); return; }
        const ok = await copyToClipboard(txt);
        closeModal(opModal);
        alert(ok ? `已复制 ${rows.length} 个运单号到剪贴板。` : '复制失败：请在弹窗文本框中手动全选并复制。');
        return;
      }
      if(currentAction==='batch-print'){
        const rows = getSelectedRows();
        closeModal(opModal);
        alert(`已模拟将 ${rows.length} 条记录发送至打印队列。`);
        return;
      }
      if(currentAction==='batch-activate'){
        const rows = getSelectedRows();
        if(rows.length){ rows.forEach(r=>{ r.voided = false; }); updateRowsVoidedUI(rows.map(r=>r.id), false); }
        closeModal(opModal);
        alert(`已将 ${rows.length} 条记录标记为激活。`);
        return;
      }
      if(currentAction==='batch-void'){
        const rows = getSelectedRows();
        if(rows.length){ rows.forEach(r=>{ r.voided = true; }); updateRowsVoidedUI(rows.map(r=>r.id), true); }
        closeModal(opModal);
        alert(`已将 ${rows.length} 条记录标记为作废。`);
        return;
      }
      if(currentAction==='delete'){
        const sel = Array.from(selectedIds);
        if(sel.length){
          masterRows = masterRows.filter(r => !selectedIds.has(r.id));
          selectedIds.clear();
          applyFilters();
        }
        closeModal(opModal);
        alert('已模拟批量删除（已从演示数据中移除选中项）。');
        return;
      }
      closeModal(opModal);
      alert('已模拟执行操作（占位）');
    });

    function updateRowsVoidedUI(ids, voided){
      const idSet = new Set(ids);
      tbodyEl.querySelectorAll('tr').forEach(tr=>{
        const id = Number(tr.getAttribute('data-id')); if(!idSet.has(id)) return;
        tr.classList.toggle('voided', voided);
        const statusCell = tr.querySelector('.col-status');
        if(statusCell){
          const r = masterRows.find(x=>x.id===id);
          statusCell.textContent = `${r ? r.status : ''}${voided ? '｜已作废' : ''}`;
        }
        const toggleBtn = tr.querySelector('button.toggle-void');
        if(toggleBtn) toggleBtn.textContent = voided ? '激活' : '作废';
      });
    }

    /* 初始化 */
    (function init(){
      // 读状态（带兼容）
      try{
        let raw=localStorage.getItem(STORAGE_KEY_NEW);
        if(!raw){
          const old = localStorage.getItem(STORAGE_KEY_OLD);
          if(old){ localStorage.setItem(STORAGE_KEY_NEW, old); localStorage.removeItem(STORAGE_KEY_OLD); raw = old; }
        }
        if(raw){
          const obj=JSON.parse(raw);
          if(obj && obj.v===SCHEMA_VERSION && obj.lockedPath && SUBMAP[obj.lockedPath]){
            lockedPath=obj.lockedPath;
            const okSub=Object.values(SUBMAP).flat().some(s=>s.href===obj.lockedSubHref);
            lockedSubHref=okSub?obj.lockedSubHref:'';
            if(lockedSubHref&&TABMAP[lockedSubHref]){
              const okTab=(TABMAP[lockedSubHref]||[]).some(t=>t.href===obj.lockedTabHref);
              lockedTabHref=okTab?obj.lockedTabHref:(DEFAULT_TAB_BY_SUB[lockedSubHref]||'');
            }else lockedTabHref='';
          }
        }
      }catch(e){}

      if(!lockedSubHref){ const firstSub=(SUBMAP[lockedPath]||[])[0]; lockedSubHref=firstSub?firstSub.href:''; }
      hoverPath=lockedPath;

      movePillToEl(links.find(a=>a.dataset.path===lockedPath)||links[0]);
      renderSub(lockedPath);
      highlightActive();

      const ro=new ResizeObserver(()=>{ updateSubRowMinHeight(); fitTableHeight(); });
      ro.observe(subInner); updateSubRowMinHeight();

      window.addEventListener('resize', ()=>{
        fitTableHeight();
        positionTabInk(tabsEl.querySelector('.tab.active'), false);
      });
    })();

    // 顶部导航交互
    links.forEach(a=>{
      a.addEventListener('pointerenter',()=>{ if(inSubRow) return; hoverPath=a.dataset.path; movePillToEl(a); renderSubPreview(hoverPath); });
    });
    function renderSubPreview(path){
      const list=SUBMAP[path]||[];
      subInner.innerHTML=list.map(i=>`<a class="sub" data-owner="${path}" href="${i.href}">${i.text}</a>`).join('');
    }
    track.addEventListener('pointerleave',()=>{
      clearTimeout(leaveTimer);
      leaveTimer=setTimeout(()=>{ if(!inSubRow){ hoverPath=lockedPath; movePillToEl(links.find(x=>x.dataset.path===lockedPath)||links[0]); renderSub(lockedPath); fitTableHeight(); } }, GRACE_MS);
    });
    subRow.addEventListener('pointerenter',()=>{ inSubRow=true; clearTimeout(leaveTimer); });
    subRow.addEventListener('pointerleave',()=>{
      inSubRow=false; hoverPath=lockedPath;
      movePillToEl(links.find(x=>x.dataset.path===lockedPath)||links[0]); renderSub(lockedPath); fitTableHeight();
    });
    subInner.addEventListener('pointerover',(e)=>{
      const s=e.target.closest('a.sub'); if(!s) return;
      const ownerEl=links.find(a=>a.dataset.path===s.getAttribute('data-owner'));
      if(ownerEl) movePillToEl(ownerEl);
    });
    links.forEach(a=>{
      a.addEventListener('click',(e)=>{
        if(!USE_REAL_NAV) e.preventDefault();
        lockedPath=a.dataset.path;
        const firstSub=(SUBMAP[lockedPath]||[])[0];
        lockedSubHref=firstSub?firstSub.href:'';
        lockedTabHref=TABMAP[lockedSubHref] ? (DEFAULT_TAB_BY_SUB[lockedSubHref]||'') : '';
        try{ localStorage.setItem(STORAGE_KEY_NEW, JSON.stringify({v:SCHEMA_VERSION,lockedPath,lockedSubHref,lockedTabHref,ts:Date.now()})); }catch(e){}
        hoverPath=lockedPath; highlightActive(); renderSub(lockedPath);
        if(USE_REAL_NAV && lockedSubHref) window.location.href=lockedSubHref;
        fitTableHeight();
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
      fitTableHeight();
    });

    // 三级页签点击：仅点击时动画滑动
    tabsEl.addEventListener('click',(e)=>{
      const t=e.target.closest('a.tab'); if(!t) return;
      if(!USE_REAL_NAV) e.preventDefault();

      tabsEl.querySelectorAll('.tab').forEach(a=>a.classList.remove('active'));
      t.classList.add('active');

      lockedTabHref=t.getAttribute('href')||'';
      try{ localStorage.setItem(STORAGE_KEY_NEW, JSON.stringify({v:SCHEMA_VERSION,lockedPath,lockedSubHref,lockedTabHref,ts:Date.now()})); }catch(e){}
      positionTabInk(t, true);   // 点击时动画

      const subHref = t.getAttribute('data-sub') || lockedSubHref;
      // 切换内容
      if(lockedTabHref.endsWith('/list')) renderLabelUploadListCardAndTable();
      else if(lockedTabHref.endsWith('/logs')) renderLabelUploadLogsPanel();
      else {
        // 其它二级（占位）
        tabCard.classList.remove('no-tabs');
        tableWrap.classList.add('hidden');
        logsTableWrap.classList.add('hidden');
        footerBar.classList.add('hidden');
        tabPanel.innerHTML='该页签暂无内容。';
      }

      if(USE_REAL_NAV && lockedTabHref) window.location.href=lockedTabHref;
      fitTableHeight();
    });

    function currentVisualPath(){ return inSubRow?hoverPath:(hoverPath||lockedPath); }
    track.addEventListener('scroll',()=>{ movePillToEl(links.find(x=>x.dataset.path===currentVisualPath())||links[0]); });

    /* ===== 首屏：默认进入当前状态对应的内容 ===== */
    function updatePanelForActiveTab(subHref){
      if(subHref==='/orders/label-upload'){
        if(lockedTabHref.endsWith('/logs')) renderLabelUploadLogsPanel();
        else renderLabelUploadListCardAndTable();
        return;
      }
      // 其它二级占位
      tabCard.classList.remove('no-tabs');
      tableWrap.classList.add('hidden');
      logsTableWrap.classList.add('hidden');
      footerBar.classList.add('hidden');
      const tabsData=TABMAP[subHref]||[];
      const activeTab=tabsData.find(t=>t.href===lockedTabHref);
      tabPanel.innerHTML=`
        <div>当前：<strong>${(SUBMAP[lockedPath]||[]).find(s=>s.href===subHref)?.text||''}</strong>
        &nbsp;&rsaquo;&nbsp;<strong>${activeTab?.text||''}</strong></div>
        <div style="margin-top:12px;color:#64748b;">（此处为 <em>${activeTab?.text||''}</em> 的内容占位）</div>
      `;
    }

// 扩展：允许外部钩子使用远程 /api/nav 渲染（已将 USE_REAL_NAV 设置为 true）


/* ======== 适配钩子（仅替换数据获取/绑定） ======== */
window.setActiveNav = function(l1, l2, l3){
  try{
    if(l1) lockedPath = l1;
    if(l2) lockedSubHref = l2;
    if(l3) lockedTabHref = l3;
    highlightActive();
    renderSub(lockedPath);
    if(lockedSubHref) renderTabs(lockedSubHref);
    positionTabInk(tabsEl.querySelector('.tab.active'), false);
    fitTableHeight();
  }catch(e){ console.error('setActiveNav error:', e); }
};

async function _fetchJSON(url){
  const r = await fetch(url, {credentials:'include'});
  if(!r.ok) throw new Error('HTTP '+r.status);
  return await r.json();
}
window.hydrateList = async function(params){
  try{
    params = params || {};
    const q = new URLSearchParams({page: String(params.page||1), page_size:String(params.page_size||50)});
    if(params.q) q.set('q', params.q);
    if(params.status) q.set('status', params.status);
    if(params.transport_mode) q.set('transport_mode', params.transport_mode);
    const data = await _fetchJSON('/api/v1/label-upload/list?' + q.toString());
    masterRows = (data.items||[]).map((r,i)=>({
      id: r.id || i+1,
      orderNo: r.order_no, waybill: r.waybill, transNo: r.transfer_no,
      ship: r.transport_mode, file: r.file_name, status: r.status.replace(/｜已作废$/,''),
      createdAt: r.created_at ? new Date(r.created_at) : null,
      printedAt: r.printed_at ? new Date(r.printed_at) : null,
      voided: /已作废$/.test(r.status)
    }));
    applyFilters();
  }catch(e){ console.error('hydrateList failed:', e); }
};
window.hydrateLogs = async function(params){
  try{
    params = params || {};
    const q = new URLSearchParams({page:String(params.page||1), page_size:String(params.page_size||50)});
    const data = await _fetchJSON('/api/v1/label-upload/logs?' + q.toString());
    logsMasterRows = (data.items||[]).map((r,i)=>({ id:i+1, time:r.time?.replace('T',' ').slice(0,16), file:r.file, type:r.type, total:r.total, success:r.success, fail:r.fail, operator:r.operator, successNos:[], failNos:[] }));
    applyLogsFilters();
  }catch(e){ console.error('hydrateLogs failed:', e); }
};
window.hydrateZips = async function(params){
  try{
    params = params || {};
    const q = new URLSearchParams({page:String(params.page||1), page_size:String(params.page_size||50)});
    const data = await _fetchJSON('/api/v1/label-upload/zips?' + q.toString());
    // 该 UI 的 Zips 页为新增（无原稿），前端可根据 data.items 渲染表格
    console.log('Zips data:', data.items);
  }catch(e){ console.error('hydrateZips failed:', e); }
};
