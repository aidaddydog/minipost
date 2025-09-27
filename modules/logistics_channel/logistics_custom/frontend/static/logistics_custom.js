/* logistics_custom.js
 * 说明：
 * - 仅前端行为与数据交互；视觉完全复用既有 Token 与基元类名（toolbar/btn/input/select/table-wrap/modal/cselect/footer-bar）
 * - 不耦合聚合逻辑，页面可通过 YAML 注册到 L1/L2/L3 后被壳层载入
 * - 搜索仅命中 provider_name / channel_name；分页；主从展开；软停用/软删除遵循接口契约
 * - transport_mode / status_common 枚举与 SSoT 对齐（express/postal/air/sea/rail/truck/multimodal/pickup/local_courier；draft/active/inactive/archived）。参见 SSoT。*/ // SSoT 引用：minipost_Field V1.1.yaml
// 视觉 Token 与类名对齐壳层（如 --filter-card-* / --btn-* 等）。参见 nav_shell 壳层样式。 // 壳层引用：nav_shell.html

(function(){
  const ROOT_ID = 'logistics-custom-app';
  const API = {
    list:   (params)=> `/api/logistics/custom?${new URLSearchParams(params)}`,
    create: () => `/api/logistics/custom`,
    update: (id)=> `/api/logistics/custom/${encodeURIComponent(id)}`,
    chStatus:(id)=> `/api/logistics/custom/channels/${encodeURIComponent(id)}/status`,
    chDelete:(id)=> `/api/logistics/custom/channels/${encodeURIComponent(id)}`,
    addr:   () => `/api/logistics/custom/addresses`,
    labels: () => `/api/logistics/custom/label-templates`
  };

  // 与 SSoT 保持一致的枚举（前端兜底；后端可返回也可覆盖）
  const TRANSPORT_MODES = ['express','postal','air','sea','rail','truck','multimodal','pickup','local_courier']; // SSoT enums.transport_mode
  const STATUS_COMMON   = ['draft','active','inactive','archived']; // SSoT enums.status_common

  const state = {
    kw: '',
    page: 1,
    page_size: 20,
    total: 0,
    list: [],
    addresses: [],
    labelTemplates: []
  };

  // 工具
  const $ = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
  const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
  const esc = (s)=> String(s==null?'':s).replace(/[&<>"']/g, m=>({ '&': '&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));

  async function fetchJSON(url, opt={}){
    const res = await fetch(url, Object.assign({headers:{'Content-Type':'application/json'}}, opt));
    const text = await res.text();
    let data;
    try{ data = text ? JSON.parse(text) : {}; }catch(e){ data = { errors:[{message:'Invalid JSON'}] }; }
    if(!res.ok){
      const msg = data?.errors?.map(e=>e.message).join('; ') || res.status+' '+res.statusText;
      throw new Error(msg);
    }
    return data;
  }

  function toast(msg, ok=true){
    let t = $('#lgx-toast'); if(!t){ t = document.createElement('div'); t.id='lgx-toast'; document.body.appendChild(t); }
    Object.assign(t.style, {
      position:'fixed', right:'14px', bottom:'14px', padding:'10px 12px', borderRadius:'10px',
      background: ok ? '#0a0a0a' : '#b91c1c', color:'#fff', zIndex:1100, fontSize:'12px'
    });
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(()=>{ t.style.transition='opacity .3s'; t.style.opacity='0'; }, 1400);
  }

  function ensureRoot(){
    let root = document.getElementById(ROOT_ID);
    if(root) return root;
    // 若模板未提供，JS 自动构建页面骨架（不改全局）
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
          <button id="btnNew" class="btn btn--black" aria-haspopup="dialog" aria-controls="dlgNew">新增自定义物流</button>
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
              <th style="width: var(--col-w-op);">操作</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
        <div id="empty" class="empty" style="display:none;">暂无数据</div>
      </div>

      <div class="footer-bar">
        <div class="pager">
          <button class="btn" id="prevPage" aria-label="上一页">«</button>
          <span><span id="curPage">1</span> / <span id="totalPage">1</span></span>
          <button class="btn" id="nextPage" aria-label="下一页">»</button>
        </div>
        <div class="helper">仅搜索 provider_name / channel_name；最新创建在前</div>
      </div>

      <div id="dlgNew" class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgTitle" aria-hidden="true">
        <div class="modal__dialog">
          <h3 id="dlgTitle" class="modal__title">新增自定义物流</h3>
          <div class="form">
            <div class="form-row">
              <label for="inpProvider">物流名称*</label>
              <div class="input"><input id="inpProvider" type="text" placeholder="请输入物流名称"></div>
            </div>

            <div class="channels-head">
              <div><strong>物流渠道</strong><span class="helper">（可多行增减；同一物流内名称唯一）</span></div>
              <div><button class="btn" id="btnAddCh">+ 新增渠道行</button></div>
            </div>
            <div id="channels" class="channels"></div>

            <div class="form-row">
              <label>发货地址</label>
              <div class="cselect" id="selAddr" role="combobox" aria-expanded="false" aria-haspopup="listbox">
                <span class="cselect__text" data-value="">请选择地址（或手动填写）</span>
                <div class="cselect__menu" role="listbox" id="addrMenu"></div>
              </div>
              <button class="btn" id="btnManualAddr">手动填写</button>
            </div>

            <div id="manualAddr" style="display:none; margin-left:100px;">
              <div class="form-row"><label>国家*</label><div class="input"><input data-k="country_code" type="text" placeholder="如 CN/US"></div></div>
              <div class="form-row"><label>州/省*</label><div class="input"><input data-k="state" type="text" placeholder=""></div></div>
              <div class="form-row"><label>城市*</label><div class="input"><input data-k="city" type="text" placeholder=""></div></div>
              <div class="form-row"><label>街道1*</label><div class="input"><input data-k="street1" type="text" placeholder=""></div></div>
              <div class="form-row"><label>邮编*</label><div class="input"><input data-k="postcode" type="text" placeholder=""></div></div>
              <div class="form-row"><label>联系人/公司*</label><div class="input"><input data-k="contact_name" type="text" placeholder="联系人或公司至少一个"></div></div>
            </div>

            <div class="form-row">
              <label>标签模板</label>
              <div class="cselect" id="selTpl" role="combobox" aria-expanded="false" aria-haspopup="listbox">
                <span class="cselect__text" data-value="">可选</span>
                <div class="cselect__menu" role="listbox" id="tplMenu"></div>
              </div>
            </div>
          </div>

          <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
            <button class="btn" id="btnCancel">取消</button>
            <button class="btn btn--black" id="btnSubmit">保存</button>
          </div>
        </div>
      </div>
    `;
    var __host = document.getElementById('tabPanel') || document.body; __host.appendChild(root);
    return root;
  }

  // 构造一行渠道编辑控件
  function makeChannelLine(i=0){
    const line = document.createElement('div');
    line.className = 'channel-line';
    line.innerHTML = `
      <div class="input"><input data-k="channel_name" type="text" placeholder="渠道名称*"></div>
      <div class="input"><input data-k="platform_name" type="text" placeholder="平台名称"></div>
      <div class="input"><input data-k="platform_carrier_name" type="text" placeholder="平台承运商"></div>
      <div class="input"><input data-k="platform_channel_name" type="text" placeholder="平台渠道名"></div>
      <div class="channel-op">
        <div class="cselect" role="combobox" aria-expanded="false" aria-haspopup="listbox">
          <span class="cselect__text" data-value="${TRANSPORT_MODES[0]}">${TRANSPORT_MODES[0]}</span>
          <div class="cselect__menu" role="listbox">
            ${TRANSPORT_MODES.map(m=>`<div class="cselect__item" role="option" data-v="${m}">${m}</div>`).join('')}
          </div>
        </div>
        <button class="btn" data-op="add">+</button>
        <button class="btn" data-op="del">−</button>
      </div>
    `;
    return line;
  }

  function bindCSelect(root){
    root.addEventListener('click', (e)=>{
      const cs = e.target.closest('.cselect');
      if(!cs) return;
      // 切换菜单
      const opened = cs.classList.contains('open');
      $$('.cselect.open', root).forEach(x=>{ if(x!==cs){ x.classList.remove('open'); x.setAttribute('aria-expanded','false'); } });
      cs.classList.toggle('open', !opened);
      cs.setAttribute('aria-expanded', String(!opened));
      const item = e.target.closest('.cselect__item');
      if(item){
        const v = item.getAttribute('data-v') ?? item.getAttribute('data-value') ?? '';
        const t = item.textContent.trim();
        const textEl = $('.cselect__text', cs);
        textEl.dataset.value = v;
        textEl.textContent = t;
        cs.classList.remove('open');
        cs.setAttribute('aria-expanded','false');
      }
    });
    document.addEventListener('click', (e)=>{ if(!e.target.closest('.cselect')) $$('.cselect.open').forEach(x=>{ x.classList.remove('open'); x.setAttribute('aria-expanded','false'); }); });
  }

  function validAddress(obj){
    // 关键字段：国家/州/市/街道1/邮编 + 联系人或公司
    if(!obj) return false;
    const required = ['country_code','state','city','street1','postcode'];
    for(const k of required) if(!obj[k]) return false;
    if(!obj.contact_name && !obj.company) return false;
    return true;
  }

  function getManualAddress(){
    const m = {};
    $$('#manualAddr [data-k]').forEach(inp=> m[inp.dataset.k] = inp.value.trim());
    return m;
  }

  // ========== 数据流 ==========
  async function loadList(){
    const params = { kw: state.kw, page: state.page, page_size: state.page_size };
    const { data, pagination } = await fetchJSON(API.list(params));
    state.list = Array.isArray(data) ? data : [];
    state.total = pagination?.total || 0;
  }

  function renderList(){
    const tbody = $('#tbody');
    const empty = $('#empty');
    tbody.innerHTML = '';
    if(!state.list.length){
      empty.style.display = '';
      $('#curPage').textContent = state.page;
      $('#totalPage').textContent = Math.max(1, Math.ceil(state.total/state.page_size) || 1);
      return;
    }
    empty.style.display = 'none';

    state.list.forEach(row=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="row-toggle" role="button" aria-expanded="false" aria-controls="sub-${esc(row.id)}">▶</span></td>
        <td>${esc(row.provider_name||'')}</td>
        <td>${esc(row.created_at||'')}</td>
        <td>
          <button class="btn" data-act="rename" data-id="${esc(row.id)}">重命名</button>
          <button class="btn" data-act="delete" data-id="${esc(row.id)}">删除</button>
        </td>
      `;
      const trSub = document.createElement('tr');
      trSub.innerHTML = `
        <td></td>
        <td colspan="3">
          <div id="sub-${esc(row.id)}" class="subwrap" hidden>
            ${renderSubtable(row)}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
      tbody.appendChild(trSub);
    });

    // 交互：展开/收起
    tbody.addEventListener('click', async (e)=>{
      const tog = e.target.closest('.row-toggle');
      if(tog){
        const id = tog.getAttribute('aria-controls');
        const wrap = document.getElementById(id);
        const expanded = tog.getAttribute('aria-expanded') === 'true';
        tog.setAttribute('aria-expanded', String(!expanded));
        if(expanded){ wrap.hidden = true; }
        else{
          // 可在此处刷新子表（如需要二次拉取）
          wrap.hidden = false;
        }
        return;
      }

      // 行内操作
      const btn = e.target.closest('button[data-act]');
      if(btn){
        const act = btn.dataset.act, id = btn.dataset.id;
        if(act==='rename'){
          const row = state.list.find(x=>String(x.id)===String(id));
          const name = prompt('新的物流名称', row?.provider_name||'');
          if(name && name!==row?.provider_name){
            await fetchJSON(API.update(id), { method:'PUT', body: JSON.stringify({ provider_name: name }) });
            toast('已重命名');
            await refresh();
          }
        }else if(act==='delete'){
          if(!confirm('确认删除该物流及其子渠道？\n（如被引用，后端将执行软删）')) return;
          await fetchJSON(API.update(id), { method:'PUT', body: JSON.stringify({ deleted: true }) });
          toast('已提交删除');
          await refresh();
        }
      }
    });

    // 分页信息
    $('#curPage').textContent = state.page;
    $('#totalPage').textContent = Math.max(1, Math.ceil(state.total/state.page_size) || 1);
  }

  function renderSubtable(row){
    const chs = Array.isArray(row.channels) ? row.channels : [];
    if(!chs.length) return `<div class="empty">暂无渠道</div>`;
    const head = `
      <table class="subtable" aria-label="渠道列表">
        <thead><tr>
          <th>物流渠道</th><th>平台映射</th><th>运输方式</th><th>操作</th>
        </tr></thead><tbody>
    `;
    const body = chs.map(ch=>{
      const map = ch.platform_mapping||{};
      const mapBrief = [map.platform_name, map.platform_carrier_name, map.platform_channel_name]
        .filter(Boolean).join(' / ') || '-';
      const statusBtn = ch.status==='active' ? '停用' : '启用';
      return `<tr>
        <td>${esc(ch.channel_name||'')}</td>
        <td>${esc(mapBrief)}</td>
        <td>${esc(ch.transport_mode||'-')}</td>
        <td>
          <button class="btn" data-chact="edit" data-id="${esc(ch.id)}">设置</button>
          <button class="btn" data-chact="toggle" data-id="${esc(ch.id)}">${statusBtn}</button>
          <button class="btn" data-chact="del" data-id="${esc(ch.id)}">删除</button>
        </td>
      </tr>`;
    }).join('');
    const foot = `</tbody></table>`;
    return head + body + foot;
  }

  function bindToolbar(){
    const kwInput = $('#kwInput');
    $('#btnSearch').addEventListener('click', ()=>{ state.kw = kwInput.value.trim(); state.page=1; refresh(); });
    $('#btnReset').addEventListener('click', ()=>{ kwInput.value=''; state.kw=''; state.page=1; refresh(); });
    kwInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ state.kw = kwInput.value.trim(); state.page=1; refresh(); } });

    $('#prevPage').addEventListener('click', ()=>{ if(state.page>1){ state.page--; refresh(); } });
    $('#nextPage').addEventListener('click', ()=>{
      const totalPage = Math.max(1, Math.ceil(state.total/state.page_size) || 1);
      if(state.page < totalPage){ state.page++; refresh(); }
    });

    $('#btnNew').addEventListener('click', openNewDialog);
  }

  async function openNewDialog(){
    const dlg = $('#dlgNew');
    dlg.classList.add('open'); dlg.setAttribute('aria-hidden','false');

    // 初始一行渠道
    const box = $('#channels'); box.innerHTML='';
    box.appendChild(makeChannelLine());

    // 地址/模板下拉数据
    try{
      const [addrRes, tplRes] = await Promise.allSettled([ fetchJSON(API.addr()), fetchJSON(API.labels()) ]);
      if(addrRes.status==='fulfilled') state.addresses = Array.isArray(addrRes.value?.data)?addrRes.value.data:[];
      if(tplRes.status==='fulfilled')  state.labelTemplates = Array.isArray(tplRes.value?.data)?tplRes.value.data:[];
    }catch(_){}

    // 填充地址菜单
    const addrMenu = $('#addrMenu'); addrMenu.innerHTML = (state.addresses.length?state.addresses:[{label:'无可用地址', value:''}])
      .map(a=>`<div class="cselect__item" role="option" data-value="${esc(a.value||'')}">${esc(a.label||'')}</div>`).join('');

    // 填充模板菜单
    const tplMenu = $('#tplMenu'); tplMenu.innerHTML = (state.labelTemplates.length?state.labelTemplates:[{code:'', name:'无'}])
      .map(t=>`<div class="cselect__item" role="option" data-value="${esc(t.code||'')}">${esc(t.name||'')}</div>`).join('');

    bindCSelect(dlg);

    // 增删渠道行
    box.addEventListener('click', (e)=>{
      const b = e.target.closest('button[data-op]'); if(!b) return;
      if(b.dataset.op==='add') box.appendChild(makeChannelLine());
      else if(b.dataset.op==='del'){
        const line = b.closest('.channel-line');
        if($$('.channel-line').length>1) line.remove();
      }
    });

    // 手动地址
    $('#btnManualAddr').addEventListener('click', ()=>{
      const sec = $('#manualAddr');
      sec.style.display = (sec.style.display==='none'?'':'none')==='none' ? '' : 'none';
    });

    // 关闭/提交
    $('#btnCancel').onclick = ()=>{ closeDialog(); };
    $('#btnSubmit').onclick = submitNew;
  }

  function closeDialog(){
    const dlg = $('#dlgNew');
    dlg.classList.remove('open'); dlg.setAttribute('aria-hidden','true');
  }

  async function submitNew(){
    const provider = $('#inpProvider').value.trim();
    if(!provider){ toast('请填写物流名称', false); return; }

    // 渠道行收集与校验
    const channels = $$('.channel-line').map(line=>{
      const kv = (k)=> $('input[data-k="'+k+'"]', line)?.value.trim() || '';
      const transport_mode = $('.cselect__text', line)?.dataset.value || TRANSPORT_MODES[0];
      return {
        channel_name: kv('channel_name'),
        transport_mode,
        platform_mapping: {
          platform_name: kv('platform_name'),
          platform_carrier_name: kv('platform_carrier_name'),
          platform_channel_name: kv('platform_channel_name'),
        }
      };
    }).filter(c=>c.channel_name);

    if(!channels.length){ toast('至少新增一行渠道', false); return; }

    // 地址选择或手填
    const addrValue = $('#selAddr .cselect__text').dataset.value || '';
    let ship_from = null;
    if(addrValue){
      // 后端返回的地址对象（或ID），此处假定接口直接回传标准 address 对象或 value 即对象 ID
      const item = state.addresses.find(a=>String(a.value)===String(addrValue));
      ship_from = item?.address || item || null;
    }
    if(!ship_from){
      const m = getManualAddress();
      if(Object.values(m).some(Boolean)){
        if(!validAddress(m)){ toast('手动地址信息不完整', false); return; }
        ship_from = m;
      }
    }

    const label_template_code = $('#selTpl .cselect__text').dataset.value || '';

    const payload = {
      provider_name: provider,
      label_template_code,
      ship_from,
      channels
    };

    try{
      await fetchJSON(API.create(), { method:'POST', body: JSON.stringify(payload) });
      toast('已保存');
      closeDialog();
      await refresh();
    }catch(e){
      toast(e.message||'保存失败', false);
    }
  }

  async function refresh(){
    await loadList();
    renderList();
  }

  // 初始化
  function init(){
    const root = ensureRoot();
    bindToolbar();
    bindCSelect(root);
    refresh().catch(err=>toast(err.message||'加载失败', false));
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
  try{ window.__minipost_mount_logistics_custom = init; }catch(e){}

})();
