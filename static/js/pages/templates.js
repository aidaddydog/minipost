(async function(){
  const wrap = document.getElementById('tplApp'); if(!wrap) return;
  const list = await (await fetch('/api/v1/templates')).json();
  wrap.innerHTML = `<div style="display:flex;gap:16px;"><div id="tplList" style="width:280px"></div><div style="flex:1"><textarea id="tplEditor" style="width:100%;height:60vh"></textarea><div style="margin-top:8px"><button id="tplSave">保存</button></div></div></div>`;
  const ul = document.getElementById('tplList'); ul.innerHTML = list.map(x=>`<div><a href="#" data-path="${x.path}">${x.path}</a></div>`).join('');
  const ed = document.getElementById('tplEditor'); let cur='';
  ul.addEventListener('click', async (e)=>{ const a=e.target.closest('a[data-path]'); if(!a) return; e.preventDefault(); cur=a.dataset.path; const d = await (await fetch('/api/v1/templates/content?path='+encodeURIComponent(cur))).json(); ed.value = d.content||''; });
  document.getElementById('tplSave').addEventListener('click', async ()=>{ if(!cur) return alert('请选择模板'); const fd = new FormData(); fd.append('path', cur); fd.append('content', ed.value); const r = await fetch('/api/v1/templates/save', {method:'POST', body: fd}); if(!r.ok) alert(await r.text()); else alert('已保存'); });
})();