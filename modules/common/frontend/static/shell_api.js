/* modules/common/frontend/static/shell_api.js  (v2: broadcast + local fallback) */
(function(w){
  function postTo(target, msg){
    try{ target.postMessage(msg, '*'); return true; }catch(e){ return false; }
  }
  function broadcast(msg){
    let sent = false;
    try{ if(w.parent && w.parent !== w){ sent = postTo(w.parent, msg) || sent; } }catch(e){}
    try{ if(w.top && w.top !== w && w.top !== w.parent){ sent = postTo(w.top, msg) || sent; } }catch(e){}
    // 本地应急弹窗（无监听者时）
    if(!sent && msg && msg.type === 'open-shell-modal'){
      let root = document.getElementById('shellModalRoot');
      if(!root){
        root = document.createElement('div');
        root.id = 'shellModalRoot';
        root.className = 'shell-modal';
        root.setAttribute('aria-hidden','true');
        root.innerHTML =
          '<div class="shell-modal__backdrop" data-close="1"></div>'+
          '<div class="shell-modal__dialog" role="document">'+
          '  <div class="shell-modal__header">'+
          '    <h3 class="shell-modal__title">—</h3>'+
          '    <button class="shell-modal__close" title="关闭" aria-label="关闭" data-close="1">×</button>'+
          '  </div>'+
          '  <div class="shell-modal__body"><iframe id="shellModalIframe" title="模块弹窗"></iframe></div>'+
          '</div>';
        document.body.appendChild(root);
        const style = document.createElement('style');
        style.textContent =
          '.shell-modal{ position:fixed; inset:0; display:none; align-items:center; justify-content:center; z-index:99999; }'+
          '.shell-modal[aria-hidden="false"]{ display:flex; }'+
          '.shell-modal__backdrop{ position:absolute; inset:0; background:rgba(0,0,0,.28); }'+
          '.shell-modal__dialog{ position:relative; background:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.2);'+
          '  width:min(920px,92vw); max-height:90vh; display:flex; flex-direction:column; overflow:hidden; }'+
          '.shell-modal__header{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(0,0,0,.06); }'+
          '.shell-modal__title{ font-size:16px; margin:0; }'+
          '.shell-modal__close{ border:0; background:transparent; font-size:20px; line-height:1; cursor:pointer; }'+
          '.shell-modal__body{ position:relative; padding:0; }'+
          '.shell-modal__body iframe{ display:block; width:100%; border:0; background:transparent; min-height:60vh; }';
        document.head.appendChild(style);
        root.addEventListener('click', (e)=>{ if(e.target?.dataset?.close==='1'){ root.setAttribute('aria-hidden','true'); } });
      }
      const titleEl = root.querySelector('.shell-modal__title');
      const iframe = root.querySelector('#shellModalIframe');
      if(titleEl) titleEl.textContent = msg.payload?.title || '弹窗';
      if(iframe)  iframe.src = msg.payload?.url || 'about:blank';
      root.setAttribute('aria-hidden','false');
    }
  }

  const ShellAPI = {
    openModal:  (cfg)=> broadcast({ type:'open-shell-modal',  payload: cfg }),
    updateModal:(cfg)=> broadcast({ type:'update-shell-modal', payload: cfg }),
    closeModal: (payload)=> broadcast({ type:'close-shell-modal', payload }),
    emitResult: (scope, action, data)=> broadcast({ type:'shell-modal-result', scope, action, data }),
  };
  w.ShellAPI = ShellAPI;
})(window);
