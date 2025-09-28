/* Build: sys-upgrade patched v3 (async fix) | 2025-09-28 */
console.info('[SysUpgrade] patched build v2 loaded');
/* --- PATCH: fixed HTML-escape helper h() to avoid syntax error --- */
/* modules/system_settings/system_upgrade/frontend/static/system_upgrade.js
 * 简约 UI，复用壳层 Token：toolbar / btn / input / select / table-wrap / footer-bar / cselect / modal
 * API 约定（模拟优先，容器具备 git 时自动走真实模式）
 *   GET  /api/settings/system_settings/system_upgrade/branches
 *   POST /api/settings/system_settings/system_upgrade/check    {branch}
 *   POST /api/settings/system_settings/system_upgrade/execute  {branch, options?}
 *   GET  /api/settings/system_settings/system_upgrade/history  ?page=&page_size=
 *   POST /api/settings/system_settings/system_upgrade/history/{id}/rollback
 *   DELETE /api/settings/system_settings/system_upgrade/history/{id}
 *   GET  /api/settings/system_settings/system_upgrade/history/{id}/log
 */
(function(){
  const ROOT = document.getElementById('system-upgrade-app');
  const API_BASE = '/api/settings/system_settings/system_upgrade';

  // 工具
  const $ = (sel, el=document) => el.querySelector(sel);
  const h = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, m => (m=='&'?'&amp;': m=='<'?'&lt;': m=='>'?'&gt;': m=='"'?'&quot;':'&#39;'));
  function fmt(ts){
    const d = new Date(ts);
    const p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  async function jget(url){ const r=await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
  async function jpost(url, data){ const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data||{})}); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
  async function jdel(url){ const r=await fetch(url,{method:'DELETE'}); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
  function toast(msg){ alert(msg); }

  const state = {
    branches: [],
    branch: '',
    check: null,
    page: 1,
    page_size: 20,
    total: 0,
    rows: [],
  };

  // 自定义选择器（简化版）
  function mkCSelect(select){
    if(!select || select.dataset.enhanced==='1') return;
    const wrap = document.createElement('div'); wrap.className='cselect'; select.parentNode.insertBefore(wrap, select);
    const btn = document.createElement('button'); btn.type='button'; btn.className='cs-toggle'; btn.innerHTML='<span class="cs-text"></span><span class="caret">▾</span>';
    const menu = document.createElement('div'); menu.className='menu'; menu.setAttribute('role','listbox'); wrap.appendChild(select); wrap.appendChild(btn); wrap.appendChild(menu);
    select.classList.add('sr-select'); select.dataset.enhanced='1';
    function sync(){
      const cur = select.options[select.selectedIndex]; $('.cs-text',wrap).textContent = cur?cur.text:'';
      menu.innerHTML = Array.from(select.options).map((opt,i)=>`<a href="#" data-v="${h(opt.value)}" ${i===select.selectedIndex?'aria-selected="true"':''}>${h(opt.text)}</a>`).join('');
      menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault(); const v=a.dataset.v; select.value=v; sync(); select.dispatchEvent(new Event('change',{bubbles:true})); wrap.classList.remove('open'); btn.setAttribute('aria-expanded','false');}));
    }
    sync();
    btn.addEventListener('click',(e)=>{ e.stopPropagation(); const willOpen=!wrap.classList.contains('open'); document.querySelectorAll('.cselect.open').forEach(x=>x.classList.remove('open')); wrap.classList.toggle('open',willOpen); btn.setAttribute('aria-expanded',willOpen?'true':'false'); });
    document.addEventListener('click',()=>wrap.classList.remove('open'));
  }

  function render(){
    ROOT.innerHTML = `
      <div class="up-toolbar">
        <div class="left">
          <label>分支
            <select id="branchSel" class="select">
              ${state.branches.length?state.branches.map(b=>`<option value="${h(b)}" ${b===state.branch?'selected':''}>${h(b)}</option>`).join(''):`<option value="">加载中…</option>`}
            </select>
          </label>
          <button class="btn btn--black" id="btnSettings">更新设置</button>
        </div>
        <div class="right">
          <span id="verTip" style="color:#334155;">${state.check && state.check.update_available ? `检测到更新：${h(state.check.version)}` : '已是最新'}</span>
          <button class="btn btn--black" id="btnCheck">检查更新</button>
          <button class="btn btn--black" id="btnUpgrade" ${state.check && state.check.update_available ? '' : 'disabled'}>执行更新</button>
        </div>
      </div>

      <div class="table-wrap" id="tableWrap">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>快照时间</th>
                <th>更新版本号</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="tbody">
              ${state.rows.map(r=>`
                <tr data-id="${h(r.id)}">
                  <td>${h(fmt(r.created_at))}</td>
                  <td>${h(r.version)}</td>
                  <td>
                    <button class="btn-link act-rollback">回滚</button>
                    <button class="btn-link act-log">日志</button>
                    <button class="btn-link act-del">删除</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="footer-bar" id="footerBar">
        <div class="inner">
          <label>每页
            <select id="pageSize" class="size">
              <option value="20" ${state.page_size==20?'selected':''}>20 条</option>
              <option value="50" ${state.page_size==50?'selected':''}>50 条</option>
              <option value="100" ${state.page_size==100?'selected':''}>100 条</option>
            </select>
          </label>
          <span id="pageInfo">共 ${state.total} 条 ${state.page}/${Math.max(1, Math.ceil(state.total/state.page_size))} 页</span>
          <span class="pager">
            <a href="#" id="firstPage">&laquo;</a>
            <a href="#" id="prevPage">&lsaquo;</a>
            <span id="pageNums"></span>
            <a href="#" id="nextPage">&rsaquo;</a>
            <a href="#" id="lastPage">&raquo;</a>
          </span>
          <span>跳转 <input type="number" id="jumpTo" min="1" value="${state.page}"> 页</span>
          <span class="flex-1"></span>
          <a class="link-top" href="#" id="goTop">回到顶部 ↑</a>
        </div>
      </div>

      <div class="modal" id="settingsModal" role="dialog" aria-modal="true">
        <div class="box" tabindex="-1">
          <h3 style="margin:0 0 10px;">更新设置</h3>
          <div style="color:#374151;">
            <label style="display:block;margin-bottom:8px;"><input type="checkbox" id="optBackup" checked> 执行前创建备份快照</label>
            <label style="display:block;margin-bottom:8px;"><input type="checkbox" id="optOnlyChanged" checked> 仅更新有变动的文件</label>
            <label style="display:block;margin-bottom:8px;"><input type="checkbox" id="optKeepDB" checked disabled> 不清数据库（固定）</label>
          </div>
          <div class="row">
            <button class="btn" id="btnCloseSettings">关闭</button>
            <button class="btn btn--black" id="btnSaveSettings">保存</button>
          </div>
        </div>
      </div>

      <div class="modal" id="logModal" role="dialog" aria-modal="true">
        <div class="box" tabindex="-1">
          <h3 style="margin:0 0 10px;">更新日志</h3>
          <textarea id="logText" readonly style="height:240px;"></textarea>
          <div class="row">
            <button class="btn" id="btnCloseLog">关闭</button>
          </div>
        </div>
      </div>
    `;

    mkCSelect($('#branchSel'));
    mkCSelect($('#pageSize'));
    fitTableHeight();
    bindEvents();
    renderPager();
  }

  function fitTableHeight(){
    const wrap = $('#tableWrap'); if(!wrap) return;
    const scroller = wrap.querySelector('.table-scroll'); if(!scroller) return;
    const top = scroller.getBoundingClientRect().top;
    const footer = $('#footerBar'); const footerTop = footer ? footer.getBoundingClientRect().top : window.innerHeight;
    const h = Math.max(120, Math.floor(footerTop - top - 12));
    scroller.style.maxHeight = h+'px'; scroller.style.height = h+'px';
  }

  function renderPager(){
    const totalPages = Math.max(1, Math.ceil(state.total/state.page_size));
    const nums = [];
    const s = Math.max(1, state.page-2), e = Math.min(totalPages, state.page+2);
    for(let i=s; i<=e; i++) nums.push(`<a href="#" data-p="${i}" style="${i===state.page?'font-weight:700;text-decoration:underline':''}">${i}</a>`);
    $('#pageNums').innerHTML = nums.join('');
    $('#pageNums').querySelectorAll('a').forEach(a=>a.addEventListener('click',(e)=>{ e.preventDefault(); state.page=+a.dataset.p; loadHistory(); }));
  }

  function bindEvents(){
    if(!window.__sysUpgResizeBound){ window.addEventListener('resize', fitTableHeight); window.__sysUpgResizeBound=true; }

    $('#branchSel').addEventListener('change', ()=>{ state.branch=$('#branchSel').value; saveSettings(); });
    $('#btnSettings').addEventListener('click', ()=> openModal($('#settingsModal')) );
    $('#btnCloseSettings').addEventListener('click', ()=> closeModal($('#settingsModal')) );
    $('#btnSaveSettings').addEventListener('click', ()=> { saveSettings(); closeModal($('#settingsModal')); });

    $('#btnCheck').addEventListener('click', async ()=>{
      try{
        const r = await jpost(API_BASE + '/check', { branch: state.branch });
        state.check = r.data || r;
        render();
      }catch(e){ toast('检查失败：'+e.message); }
    });

    $('#btnUpgrade').addEventListener('click', async ()=>{
      try{
        const options = { backup: $('#optBackup').checked, only_changed: $('#optOnlyChanged').checked };
        const r = await jpost(API_BASE + '/execute', { branch: state.branch, options });
        toast('执行完成：' + (r.message || '已生成快照'));
        state.check = null;
        await loadHistory();
      }catch(e){ toast('执行失败：'+e.message); }
    });

    $('#pageSize').addEventListener('change', ()=>{ state.page_size=+$('#pageSize').value||20; state.page=1; loadHistory(); });
    $('#firstPage').addEventListener('click',(e)=>{ e.preventDefault(); state.page=1; loadHistory(); });
    $('#prevPage').addEventListener('click',(e)=>{ e.preventDefault(); state.page=Math.max(1,state.page-1); loadHistory(); });
    $('#nextPage').addEventListener('click',(e)=>{ e.preventDefault(); const tp=Math.max(1,Math.ceil(state.total/state.page_size)); state.page=Math.min(tp,state.page+1); loadHistory(); });
    $('#lastPage').addEventListener('click',(e)=>{ e.preventDefault(); state.page=Math.max(1,Math.ceil(state.total/state.page_size)); loadHistory(); });
    $('#jumpTo').addEventListener('change', ()=>{ const p=+$('#jumpTo').value||1; const tp=Math.max(1,Math.ceil(state.total/state.page_size)); state.page=Math.min(Math.max(1,p),tp); loadHistory(); });
    $('#goTop').addEventListener('click',(e)=>{ e.preventDefault(); const sc=$('#tableWrap .table-scroll'); sc && sc.scrollTo({top:0,behavior:'smooth'}); });

    $('#tbody').addEventListener('click', async (e)=>{
      const tr = e.target.closest('tr'); if(!tr) return;
      const id = tr.dataset.id;
      if(e.target.classList.contains('act-rollback')){
        if(!confirm('确认回滚到该快照？')) return;
        try{ await jpost(`${API_BASE}/history/${encodeURIComponent(id)}/rollback`, {}); toast('已执行回滚（模拟/或后台真实执行）。'); await loadHistory(); }catch(err){ toast('回滚失败：'+err.message); }
      }else if(e.target.classList.contains('act-del')){
        if(!confirm('确认删除该记录？')) return;
        try{ await jdel(`${API_BASE}/history/${encodeURIComponent(id)}`); await loadHistory(); }catch(err){ toast('删除失败：'+err.message); }
      }else if(e.target.classList.contains('act-log')){
        try{ const r = await jget(`${API_BASE}/history/${encodeURIComponent(id)}/log`); $('#logText').value = (r.data && r.data.log) || r.log || ''; openModal($('#logModal')); }catch(err){ toast('加载日志失败：'+err.message); }
      }
    });
  }

  // 弹窗 & 壳层模糊联动（由 mask_bridge.js 接管整页灰层；此处仅开关自身可交互）
  function openModal(m){ m.style.display='flex'; document.documentElement.style.overflow='hidden'; }
  function closeModal(m){ m.style.display='none'; document.documentElement.style.overflow=''; }

  // 用户偏好
  function saveSettings(){
    try{
      const obj = { branch: $('#branchSel').value, optBackup: $('#optBackup')?.checked, optOnlyChanged: $('#optOnlyChanged')?.checked };
      localStorage.setItem('SYS_UPGRADE_PREF', JSON.stringify(obj));
    }catch(_){}
  }
  function loadPref(){
    try{
      const raw = localStorage.getItem('SYS_UPGRADE_PREF'); if(!raw) return;
      const o = JSON.parse(raw)||{};
      state.branch = o.branch || state.branch;
      setTimeout(()=>{
        if($('#optBackup')) $('#optBackup').checked = !!o.optBackup;
        if($('#optOnlyChanged')) $('#optOnlyChanged').checked = !!o.optOnlyChanged;
      },0);
    }catch(_){}
  }

  async function loadBranches(){
    try{
      const r = await jget(API_BASE + '/branches');
      state.branches = r.data?.branches || r.branches || [];
      state.branch = r.data?.current || r.current || state.branches[0] || 'main';
    }catch(e){
      state.branches = ['main']; state.branch = 'main';
    }
  }

  async function loadHistory(){
    try{
      const r = await jget(`${API_BASE}/history?page=${state.page}&page_size=${state.page_size}`);
      state.rows = r.data?.rows || r.rows || []; state.total = r.data?.total || r.total || state.rows.length;
      render(); // 渲染分页 UI
    }catch(e){
      state.rows = []; state.total = 0; render();
    }
  }

  (async function init(){
    // 先渲染骨架，避免白屏
    render();
    try { await loadBranches(); } catch(_){}
    render();
    loadPref();
    await loadHistory();
  })();
})();
