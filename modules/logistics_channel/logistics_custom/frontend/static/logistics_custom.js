/* modules/logistics_channel/logistics_custom/frontend/static/logistics_custom.js
 * 自定义物流 · 前端（稳定实现 + API 前缀自动回退）
 * - 构建页面骨架（toolbar/table/pager）
 * - 调用后端 API 渲染列表、分页（支持 /api /api/v1 /v1/api 回退）
 * - “新增/重命名/删除”走壳层统一弹窗（ShellAPI）
 */
(function(){
  const ROOT_ID = 'logistics-custom-app';

  /* ---------- API 前缀自动回退 ---------- */
  const API_BASES = Array.isArray(window.__API_BASES__) && window.__API_BASES__.length
    ? window.__API_BASES__
    : (window.__API_BASE__ ? [String(window.__API_BASE__)] : ['/api','/api/v1','/v1/api']);

  function buildURL(base, path, params){
    const q = params ? '?' + new URLSearchParams(params) : '';
    return (base.replace(/\/+$/,'') + '/' + path.replace(/^\/+/, '') + q);
  }

  async function request(method, path, { params=null, json=null }={}){
    let lastErr = null;
    for(const base of API_BASES){
      const url = buildURL(base, path, params);
      try{
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type':'application/json' },
          body: json ? JSON.stringify(json) : null
        });
        const txt = await res.text();
        let data = {};
        try{ data = txt ? JSON.parse(txt) : {}; }catch(e){ data = { errors:[{ message:'Invalid JSON' }] }; }

        if(res.status === 404){
          // 尝试下一个前缀
          lastErr = new Error(`[404] ${url}`);
          continue;
        }
        if(!res.ok){
          const msg = (data && data.errors ? data.errors.map(e=>e.message).join('; ') : '') || (res.status+' '+res.statusText);
          throw new Error(msg);
        }
        return data;
      }catch(err){
        lastErr = err;
      }
    }
    throw lastErr || new Error('All API bases failed');
  }

  const API = {
    list:   (params)=> request('GET',  '/logistics/custom', { params }),
    create: (body)=>   request('POST', '/logistics/custom', { json: body }),
    update: (id,body)=>request('PUT',  `/logistics/custom/${encodeURIComponent(id)}`, { json: body }),
    history:(id)=>     request('GET',  `/logistics/custom/${encodeURIComponent(id)}/history`)
  };

  /* ---------- 状态 & 工具 ---------- */
  const state = { kw:'', page:1, page_size:10, total:0, list:[] };
  const $  = (sel, el=document)=> el.querySelector(sel);
  const $$ = (sel, el=document)=> Array.from(el.querySelectorAll(sel));
  const esc = (s)=> String(s==null? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function toast(msg, ok=true){
    let t = $('#lgx-toast');
    if(!t){ t = document.createElement('div'); t.id='lgx-toast'; document.body.appendChild(t); }
    Object.assign(t.style, { position:'fixed', left:'50%', top:'12px', transform:'translateX(-50%)', padding:'8px 12px',
      background: ok?'#0a0a0a':'#b30000', color:'#fff', borderRadius:'6px', fontSize:'12px', zIndex:2147483000 });
    t.textContent = String(msg||''); clearTimeout(t._tid); t.style.opacity='1';
    t._tid = setTimeout(()=>{ t.style.opacity='0'; }, 1800);
  }

  /* ---------- DOM 构建 ---------- */
  function ensureRoot(){
    let root = document.getElementById(ROOT_ID);
    if(root) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="toolbar" role="region" aria-label="筛选工具栏">
        <div class="toolbar-left">
          <div class="input"><input id="kwInput" type="text" placeholder="搜索物流名称/渠道名称"></div>
          <button id="btnSearch" class="btn btn--black" aria-label="搜索">搜索</button>
          <button id="btnReset" class="btn" aria-label="重置条件">重置</button>
        </div>
        <div class="toolbar-right">
          <button id="btnNew" class="btn btn--black">新增自定义物流</button>
        </div>
      </div>

      <div id="tableWrap" class="table-wrap" role="region" aria-label="自定义物流列表">
        <table class="table" aria-describedby="tableDesc">
          <caption id="tableDesc" class="sr-only">自定义物流 主列表，支持展开查看渠道</caption>
          <thead>
            <tr>
              <th style="width:36px;">&nbsp;</th>
              <th>物流名称</th>
              <th>创建时间</th>
              <th style="width: 200px;">操作</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
        <div id="empty" class="empty" style="display:none; padding:24px; text-align:center; color:rgba(0,0,0,.45);">暂无数据</div>
      </div>

      <div class="footer-bar">
        <div class="pager">
          <button id="prevPage" class="btn" aria-label="上一页">上一页</button>
          <span>第 <b id="curPage">1</b> / <b id="totalPage">1</b> 页</span>
          <button id="nextPage" class="btn" aria-label="下一页">下一页</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    return root;
  }

  /* ---------- 渲染 ---------- */
  function renderList(){
    const tbody = $('#tbody');
    const empty = $('#empty');
    tbody.innerHTML = '';
    if(!state.list.length){
      empty.style.display = '';
      $('#curPage').textContent = state.page;
      $('#totalPage').textContent = '1';
      return;
    }
    empty.style.display = 'none';
    const rows = state.list.map(row=>{
      const id = row.id;
      const name = esc(row.provider_name || '');
      const ctime = esc(row.created_at || row.created_at_str || '');
      return `
        <tr data-id="${id}">
          <td><button class="btn btn--small" data-act="expand">＋</button></td>
          <td>${name}</td>
          <td>${ctime}</td>
          <td>
            <button class="btn btn--small" data-act="rename" data-id="${id}">重命名</button>
            <button class="btn btn--small" data-act="delete" data-id="${id}">删除</button>
          </td>
        </tr>
        <tr class="subrow" data-parent="${id}" style="display:none;"><td colspan="4">
          <div class="subtable-wrap" style="padding:8px 12px; background:rgba(0,0,0,.02); border-radius:8px;">加载中…</div>
        </td></tr>
      `;
    }).join('');
    tbody.innerHTML = rows;
    $('#curPage').textContent = state.page;
    const totalPage = Math.max(1, Math.ceil((state.total||0) / state.page_size) || 1);
    $('#totalPage').textContent = totalPage;
  }

  async function loadList(){
    const data = await API.list({ kw: state.kw, page: state.page, page_size: state.page_size });
    const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    const pagination = data?.pagination || {};
    state.list = list;
    state.total = pagination.total || list.length || 0;
  }

  async function loadSubtable(tr){
    const id = tr?.getAttribute('data-parent');
    if(!id) return;
    const row = state.list.find(x=> String(x.id) === String(id));
    const chs = Array.isArray(row?.channels) ? row.channels : [];
    const wrap = tr.querySelector('.subtable-wrap');
    if(!chs.length){
      wrap.innerHTML = `<div class="empty">暂无渠道</div>`;
      return;
    }
    const body = chs.map(ch=>{
      const map = ch.platform_mapping||{};
      const mapBrief = [map.platform_name, map.platform_carrier_name, map.platform_channel_name].filter(Boolean).join(' / ') || '-';
      return `<tr>
        <td>${esc(ch.channel_name||'')}</td>
        <td>${esc(mapBrief)}</td>
        <td>${esc(ch.transport_mode||'')}</td>
      </tr>`;
    }).join('');
    wrap.innerHTML = `
      <table class="subtable" aria-label="渠道列表">
        <thead><tr><th>物流渠道</th><th>平台映射</th><th>运输方式</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  /* ---------- 事件 ---------- */
  function bindToolbar(){
    const kwInput = $('#kwInput');
    $('#btnSearch').addEventListener('click', ()=>{ state.kw = kwInput.value.trim(); state.page=1; refresh(); });
    $('#btnReset').addEventListener('click', ()=>{ kwInput.value=''; state.kw=''; state.page=1; refresh(); });
    kwInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ state.kw=kwInput.value.trim(); state.page=1; refresh(); } });
    $('#prevPage').addEventListener('click', ()=>{ if(state.page>1){ state.page--; refresh(); } });
    $('#nextPage').addEventListener('click', ()=>{
      const totalPage = Math.max(1, Math.ceil((state.total||0)/state.page_size) || 1);
      if(state.page < totalPage){ state.page++; refresh(); }
    });
    $('#btnNew').addEventListener('click', ()=>{
      ShellAPI.openModal({
        title:'新增自定义物流',
        size:'md',
        url:'/modules_static/logistics_channel/logistics_custom/frontend/templates/modals/new.html'
      });
    });
  }

  function bindTable(){
    $('#tbody').addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-act]'); if(!btn) return;
      const act = btn.dataset.act;
      const id  = btn.dataset.id || btn.closest('tr')?.dataset?.id || '';
      if(act==='expand'){
        const sub = document.querySelector(`tr.subrow[data-parent="${id}"]`);
        if(sub){ const show = sub.style.display==='none'; sub.style.display = show ? '' : 'none'; if(show) loadSubtable(sub); }
      }else if(act==='rename'){
        const row = state.list.find(x=> String(x.id)===String(id));
        const url = `/modules_static/logistics_channel/logistics_custom/frontend/templates/modals/rename.html?id=${id}&name=${encodeURIComponent(row?.provider_name||'')}`;
        ShellAPI.openModal({ title:'重命名物流', size:'sm', url });
      }else if(act==='delete'){
        const url = `/modules_static/logistics_channel/logistics_custom/frontend/templates/modals/delete.html?id=${id}`;
        ShellAPI.openModal({ title:'删除确认', size:'sm', url });
      }
    });
  }

  /* ---------- 刷新 ---------- */
  async function refresh(){
    try{
      await loadList();
      renderList();
    }catch(err){
      toast(err.message||'加载失败', false);
      // 便于排障：在控制台打印当前使用的 API_BASES
      console.warn('[logistics_custom] API_BASES =', API_BASES);
    }
  }

  /* ---------- 初始化 ---------- */
  function init(){
    ensureRoot();
    bindToolbar();
    bindTable();
    refresh();
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init, { once:true }); } else { init(); }

  /* ---------- 弹窗结果回传：刷新列表 ---------- */
  window.addEventListener('message', (e)=>{
    const msg = e?.data || {};
    if(msg.type==='shell-modal-result' && msg.scope==='logistics_custom'){
      if(msg.action==='created' || msg.action==='renamed' || msg.action==='deleted'){ refresh(); }
    }
  });
})();
