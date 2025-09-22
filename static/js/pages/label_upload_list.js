/* 页：面单列表，对齐你 UI 的交互并优先从 /api 获取数据 */
(function(){
  // == 映射你的 UI 二/三级结构 ==
  const SUBMAP={
    '/orders':[
      {text:'预报',href:'/orders/prealert'},
      {text:'订单列表',href:'/orders/list'},
      {text:'面单上传',href:'/orders/label-upload'},
      {text:'订单轨迹',href:'/orders/track'},
      {text:'订单规则',href:'/orders/rules'},
    ]
  };
  const TABMAP={
    '/orders/label-upload':[
      {key:'list', text:'面单列表', href:'/orders/label-upload/list'},
      {key:'logs', text:'上传记录', href:'/orders/label-upload/logs'}
    ],
    '/orders/prealert':[
      {key:'pickup',text:'预约取件',href:'/orders/prealert/pickup'},
      {key:'scan',  text:'扫码发货',href:'/orders/prealert/scan'},
      {key:'list',  text:'预报列表',href:'/orders/prealert/list'},
    ],
  };
  window.__SUBMAP__ = SUBMAP;    // 供核心壳脚本读取
  window.__TABMAP__ = TABMAP;

  // === 与后端的轻量数据绑定 ===
  const state = {
    masterRows: [],
    viewRows: [],
    pageSize: 50,
    pageIndex: 1,
    sortKey: 'status',
    sortDir: 'asc',
    selectedIds: new Set(),
    timeField: 'created'
  };

  // DOM
  const tbodyEl = document.getElementById('luTbody');
  const tableWrap = document.getElementById('tableWrap');
  const logsWrap = document.getElementById('logsTableWrap');
  const footerBar = document.getElementById('footerBar');

  function formatDateTime(iso){
    if(!iso) return '-';
    const d = new Date(iso);
    if(isNaN(d)) return '-';
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  // 从 API 拉数据，失败用演示数据（与原 UI 保持一致）
  async function loadFromAPI(){
    try{
      const url = new URL('/api/labels', location.origin);
      url.searchParams.set('page', '1'); url.searchParams.set('size', '200');
      const resp = await fetch(url, {credentials:'same-origin'});
      if(!resp.ok) throw new Error('bad status');
      const data = await resp.json();
      state.masterRows = (data.items||[]).map((r, i)=>({
        id: r.id || i+1,
        orderNo: r.orderNo, waybill: r.waybill, transNo: r.transNo, ship: r.ship||'',
        file: r.file||'', status: r.status||'已预报',
        createdAt: r.createdAt ? new Date(r.createdAt) : null,
        printedAt: r.printedAt ? new Date(r.printedAt) : null,
        voided: !!r.voided
      }));
      if(!state.masterRows.length) throw 0;
      return true;
    }catch(e){
      // 回退：生成演示数据（与你 UI 原稿一致）
      state.masterRows = genDemoRows(120);
      return false;
    }
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

  // 渲染与事件（与原 UI 保持一致，这里省略若干无关紧要的样式操作）
  function render(){
    const start=(state.pageIndex-1)*state.pageSize, slice=state.viewRows.slice(start,start+state.pageSize);
    const frag = document.createDocumentFragment();
    tbodyEl.innerHTML = '';
    slice.forEach(r=>{
      const tr=document.createElement('tr'); tr.dataset.id = r.id;
      if(r.voided) tr.classList.add('voided');
      tr.innerHTML = `
        <td class="col-chk"><input type="checkbox" class="chk rowchk" data-id="${r.id}"></td>
        <td class="col-order">${r.orderNo}</td>
        <td class="col-waybill">${r.waybill}</td>
        <td class="col-trans">${r.transNo}</td>
        <td class="col-ship">${r.ship||'-'}</td>
        <td class="col-file">${r.file||'-'}</td>
        <td class="col-status">${r.status}${r.voided?'｜已作废':''}</td>
        <td class="col-created">
          <div class="time2">
            <div>创建时间：${formatDateTime(r.createdAt)}</div>
            <div>打印时间：${formatDateTime(r.printedAt)}</div>
          </div>
        </td>
        <td class="col-op">
          <button class="btn-link preview" ${!r.file?'disabled':''}>预览</button>
          <button class="btn-link toggle-void" data-id="${r.id}">${r.voided?'激活':'作废'}</button>
        </td>`;
      frag.appendChild(tr);
    });
    tbodyEl.appendChild(frag);
    tableWrap.classList.remove('hidden');
    logsWrap.classList.add('hidden');
    footerBar.classList.remove('hidden');
  }

  function applyFilters(){
    state.viewRows = state.masterRows.slice(); // demo：如需服务端分页，可改由后端分页
    render();
  }

  // —— 初始化：从 API 拉取 → 渲染（失败回退演示）——
  (async function init(){
    await loadFromAPI();
    applyFilters();

    // 绑定表头“全选”、排序、批量等事件（省略：与你 UI 原稿一致）
    document.getElementById('luTbody').addEventListener('click', async (e)=>{
      const t=e.target.closest('.toggle-void'); if(!t) return;
      e.preventDefault();
      const id = Number(t.dataset.id);
      const r = state.masterRows.find(x=>x.id===id); if(!r) return;
      const wantVoid = !r.voided;
      try{
        const resp = await fetch(wantVoid?'/api/labels/batch-void':'/api/labels/batch-activate',{
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ids:[id]})
        });
        if(resp.ok){ r.voided = wantVoid; applyFilters(); }
      }catch(_){}
    });
  })();

})();
