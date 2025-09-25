
(function(){
  function h(s){ if(s==null) return ''; return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  const SAMPLE = {
    platform: [
      { carrier_code:'USPS', carrier_name:'USPS', channel_code:'USPS-FC', channel_name:'First Class', transport_mode:'postal', service_level:'standard', battery:false },
      { carrier_code:'USPS', carrier_name:'USPS', channel_code:'USPS-PM', channel_name:'Priority Mail', transport_mode:'postal', service_level:'expedited', battery:false }
    ],
    self: [
      { carrier_code:'SELF-01', carrier_name:'自发专线一', channel_code:'SF-ZX', channel_name:'自发小包', transport_mode:'express', service_level:'standard', battery:true }
    ],
    overseas: [
      { carrier_code:'WH-01', carrier_name:'洛杉矶海外仓', channel_code:'WH-PICK', channel_name:'海外仓配送', transport_mode:'local_courier', service_level:'priority', battery:true }
    ],
    custom: [
      { carrier_code:'CUST-01', carrier_name:'自定义承运', channel_code:'CUST-SVC', channel_name:'定制服务', transport_mode:'multimodal', service_level:'economy', battery:false }
    ],
  };
  function tableOf(rows){
    return `
      <div class="toolbar"><div class="toolbar-left">
        <input class="input input--search" id="lgKw" placeholder="渠道/承运商关键字...">
        <button class="btn btn--black" id="lgSearch">搜索</button>
      </div></div>
      <div class="table-wrap" id="lgWrap">
       <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>承运商编码</th>
              <th>承运商名称</th>
              <th>渠道编码</th>
              <th>渠道名称</th>
              <th>运输方式</th>
              <th>服务等级</th>
              <th>支持电池</th>
            </tr>
          </thead>
          <tbody id="lgTbody">
          ${rows.map(r=>`
            <tr>
              <td>${h(r.carrier_code)}</td>
              <td>${h(r.carrier_name)}</td>
              <td>${h(r.channel_code)}</td>
              <td>${h(r.channel_name)}</td>
              <td>${h(r.transport_mode)}</td>
              <td>${h(r.service_level)}</td>
              <td>${r.battery ? '是' : '否'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
       </div>
      </div>`;
  }
  function renderList(type){
    const rows = (SAMPLE[type]||[]).slice(0);
    const tabPanel = document.getElementById('tabPanel');
    if(!tabPanel) return;
    tabPanel.innerHTML = tableOf(rows);
    const kw = document.getElementById('lgKw');
    const btn = document.getElementById('lgSearch');
    const body = document.getElementById('lgTbody');
    function apply(){
      const k = (kw.value||'').trim().toLowerCase();
      const filtered = !k ? rows : rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(k)));
      body.innerHTML = filtered.map(r=>`
        <tr>
          <td>${h(r.carrier_code)}</td>
          <td>${h(r.carrier_name)}</td>
          <td>${h(r.channel_code)}</td>
          <td>${h(r.channel_name)}</td>
          <td>${h(r.transport_mode)}</td>
          <td>${h(r.service_level)}</td>
          <td>${r.battery ? '是' : '否'}</td>
        </tr>`).join('');
    }
    if(btn) btn.addEventListener('click', apply);
    if(kw) kw.addEventListener('keydown', (e)=>{ if(e.key==='Enter') apply(); });
  }
  window.LOGI = { renderList };
})();
