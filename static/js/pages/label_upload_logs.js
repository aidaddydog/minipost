/* 页：上传记录（与 UI 原稿一致，增加从 /api/logs 获取） */
(function(){
  async function loadLogs(){
    try{
      const resp = await fetch('/api/logs');
      if(!resp.ok) throw 0;
      const data = await resp.json();
      window.__LOG_ROWS__ = (data.items||[]).map((r,i)=>({
        id: r.id||i+1,
        time: r.time?.replace('T',' ').slice(0,16),
        file: r.file, type: r.type, total: r.total, success: r.success, fail: r.fail,
        operator: r.operator, successNos: r.successNos||[], failNos: r.failNos||[]
      }));
    }catch(_){
      // 留空：也可按你的原稿生成演示
      window.__LOG_ROWS__ = [];
    }
  }
  (async function init(){
    await loadLogs();
    // 这里调用你壳脚本里已有的“渲染 logs 表”的函数（若采用完全分离，可在此处实现表格填充）
    const tbody = document.getElementById('logsTbody');
    tbody.innerHTML = (window.__LOG_ROWS__||[]).map(r=>`
      <tr data-id="${r.id}">
        <td>${r.time||'-'}</td><td>${r.file||'-'}</td><td>${r.type||'-'}</td>
        <td>${r.total||0}</td><td>${r.success||0}</td><td>${r.fail||0}</td>
        <td>${r.operator||'系统'}</td>
        <td><button class="btn-link log-view" data-id="${r.id}">查看</button></td>
      </tr>`).join('');
  })();
})();
