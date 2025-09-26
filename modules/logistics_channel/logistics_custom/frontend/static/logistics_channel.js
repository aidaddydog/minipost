/* logistics_custom 前端交互
 * - 像素与交互基元复用现有样式（按钮/表格/弹窗/下拉等类名保持一致）
 * - 仅替换数据与事件（API: /api/logistics/custom）
 */
(function(){
  const API = '/api/logistics/custom';
  let page=1, pageSize=10, total=0;

  const $ = (s,sc=document)=>sc.querySelector(s);
  const $$ = (s,sc=document)=>Array.from(sc.querySelectorAll(s));

  // 工具栏
  $('#btnSearch').addEventListener('click', ()=>{ page=1; load(); });
  $('#btnReset').addEventListener('click', ()=>{ $('#kw').value=''; page=1; load(); });
  $('#btnNew').addEventListener('click', openModalCreate);

  // 分页
  $('#prev').addEventListener('click', ()=>{ if(page>1){ page--; load(); } });
  $('#next').addEventListener('click', ()=>{ if(page*pageSize<total){ page++; load(); } });

  // Modal 事件
  const modal = $('#modal');
  modal.addEventListener('click', e=>{ if(e.target.hasAttribute('data-close')) closeModal(); });
  $('.modal__close',modal).addEventListener('click', closeModal);
  $('#btnAddRow').addEventListener('click', addChannelRow);
  $('#btnSubmit').addEventListener('click', submitCreate);

  function openModalCreate(){
    modal.setAttribute('aria-hidden','false');
    $('#dlgTitle').textContent = '新增自定义物流';
    $('#channelList').innerHTML='';
    addChannelRow();
  }
  function closeModal(){
    modal.setAttribute('aria-hidden','true');
  }

  function addChannelRow(){
    const wrap = $('#channelList');
    const row = document.createElement('div');
    row.className='channel-row';
    row.innerHTML = `
      <input class="input" placeholder="渠道名称" data-field="channel_name">
      <select class="select" data-field="transport_mode">
        <option value="express">express</option>
        <option value="postal">postal</option>
        <option value="air">air</option>
        <option value="sea">sea</option>
        <option value="rail">rail</option>
        <option value="truck">truck</option>
        <option value="multimodal">multimodal</option>
        <option value="pickup">pickup</option>
        <option value="local_courier">local_courier</option>
      </select>
      <input class="input" placeholder="平台名称" data-map="platform_name">
      <input class="input" placeholder="承运商显示名" data-map="platform_carrier_name">
      <div class="ops">
        <button class="btn" data-op="add">+</button>
        <button class="btn" data-op="del">−</button>
      </div>
    `;
    wrap.appendChild(row);
    row.addEventListener('click', e=>{
      const op = e.target.getAttribute('data-op');
      if(!op) return;
      if(op==='add') addChannelRow();
      else if(op==='del') { if($$('.channel-row',wrap).length>1) row.remove(); }
    });
  }

  async function submitCreate(){
    const provider_name = $('#f_provider_name').value.trim();
    if(!provider_name){ alert('请输入物流名称'); return; }
    const addr = {
      country_code: $('#f_ship_from_country').value.trim(),
      state: $('#f_ship_from_state').value.trim(),
      city: $('#f_ship_from_city').value.trim(),
      street1: $('#f_ship_from_street1').value.trim(),
      postcode: $('#f_ship_from_postcode').value.trim(),
      contact_name: $('#f_ship_from_contact').value.trim()
    };
    if(!addr.country_code || !addr.city || !addr.street1 || !addr.postcode){
      if(!confirm('地址信息不完整，是否继续？')) return;
    }
    const channels = $$('.channel-row').map(r=>{
      const m = {};
      $$('.input[data-map]', r).forEach(i=>{ m[i.getAttribute('data-map')] = i.value.trim(); });
      return {
        channel_name: $('.input[data-field="channel_name"]',r).value.trim(),
        transport_mode: $('.select[data-field="transport_mode"]',r).value,
        platform_mapping: m
      };
    }).filter(x=>x.channel_name);
    if(channels.length===0){ alert('至少添加一个渠道'); return; }

    const tenant_id = crypto.randomUUID(); // 演示：实际应由后端/会话提供
    const payload = { tenant_id, provider_name, ship_from: addr, channels };
    const res = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json();
    if(!res.ok){ alert(data.detail || '提交失败'); return; }
    closeModal();
    load();
  }

  async function load(){
    const kw = $('#kw').value.trim();
    const url = new URL(API, window.location.origin);
    if(kw) url.searchParams.set('kw', kw);
    url.searchParams.set('page', page);
    url.searchParams.set('page_size', pageSize);
    const res = await fetch(url.toString());
    const json = await res.json();
    if(!res.ok){ alert(json.detail || '加载失败'); return; }
    total = json.pagination.total;
    $('#pageInfo').textContent = `第 ${json.pagination.page} / ${Math.ceil(total/pageSize)||1} 页，共 ${total} 条`;
    renderTable(json.data || []);
  }

  function renderTable(rows){
    const tb = $('#tbody');
    tb.innerHTML = '';
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-exp"><button class="btn btn--exp">+</button></td>
        <td>${escapeHTML(r.provider_name)}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td>
          <button class="btn btn--rename">重命名</button>
        </td>
      `;
      const exp = document.createElement('tr');
      exp.innerHTML = `<td></td><td colspan="3">${renderSubtable(r.channels||[])}</td>`;

      tb.appendChild(tr); tb.appendChild(exp);

      $('.btn--exp', tr).addEventListener('click', ()=>{
        const b = $('.btn--exp', tr);
        const open = b.textContent==='-';
        b.textContent = open ? '+' : '-';
        exp.style.display = open ? 'none' : '';
      });
      exp.style.display = 'none';
    });
  }

  function renderSubtable(chs){
    if(!chs.length) return '<div style="color:#9ca3af">暂无渠道</div>';
    const rows = chs.map(c => `
      <tr>
        <td>${escapeHTML(c.channel_name)}</td>
        <td>${escapeHTML((c.platform_mapping||{}).platform_name||'')}</td>
        <td>${escapeHTML(c.transport_mode)}</td>
        <td>
          <button class="btn btn--toggle" data-id="${c.id}" data-status="${c.status}">${c.status==='active'?'停用':'启用'}</button>
          <button class="btn btn--del" data-id="${c.id}">删除</button>
        </td>
      </tr>
    `).join('');
    const table = `
      <table class="subtable">
        <thead><tr><th>渠道名称</th><th>平台映射</th><th>运输方式</th><th>操作</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    // 事件委托（在父容器绑定）
    setTimeout(()=>{
      $$('.btn--toggle').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const id = btn.getAttribute('data-id');
          const cur = btn.getAttribute('data-status');
          const next = cur==='active' ? 'inactive' : 'active';
          const res = await fetch(`${API}/channels/${id}/status`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status:next}) });
          if(res.ok){ load(); } else { const j=await res.json(); alert(j.detail||'操作失败'); }
        });
      });
      $$('.btn--del').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          if(!confirm('确定删除该渠道？此操作为软删除。')) return;
          const id = btn.getAttribute('data-id');
          const res = await fetch(`${API}/channels/${id}`, { method:'DELETE' });
          if(res.ok){ load(); } else { const j=await res.json(); alert(j.detail||'删除失败'); }
        });
      });
    }, 0);
    return table;
  }

  function escapeHTML(s){ return String(s||'').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

  // 初始加载
  load();
})();