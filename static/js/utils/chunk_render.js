// 表格分块渲染（避免长列表卡顿）
export function chunkRender(container, rows, renderRow, chunkSize=50){
  container.innerHTML = ''; let i=0;
  function chunk(){ const frag=document.createDocumentFragment(); for(let c=0;c<chunkSize && i<rows.length;c++,i++){ const el = renderRow(rows[i]); frag.appendChild(el); } container.appendChild(frag); if(i<rows.length){ requestAnimationFrame(chunk); } }
  requestAnimationFrame(chunk);
}
