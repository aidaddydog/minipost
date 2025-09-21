// 复制剪贴板助手（降级方案）
export async function copyToClipboard(text){
  try{ await navigator.clipboard.writeText(text); return true; }
  catch(e){
    try{ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); return true; }
    catch(e2){ return false; }
  }
}
