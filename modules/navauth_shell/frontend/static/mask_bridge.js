/* modules/navauth_shell/frontend/static/mask_bridge.js  (V3)
 * 运行位置：业务模块（iframe 内）
 * 作用：当模块页出现弹窗/遮罩时 -> 通知壳层显示灰层，并在本 iframe 内加“纯视觉模糊层”（不拦截点击）。
 * 关闭时 -> 通知壳层收起灰层，并隐藏本地模糊层。
 */
(function(){
  const TOP = (function(){ try{ return window.parent || null; }catch(_){ return null; } })();
  if(!TOP || TOP === window) return;

  // ---------- 本地视觉模糊层（仅视觉，不截点击） ----------
  function ensureLocalMask(){
    let el = document.getElementById('moduleBlurMask');
    if(!el){
      el = document.createElement('div');
      el.id = 'moduleBlurMask';
      el.className = 'module-blur-mask';
      document.body.appendChild(el);
      const style = document.createElement('style');
      style.textContent = `
        .module-blur-mask{
          position: fixed; inset: 0; pointer-events: none;
          background: transparent;
          -webkit-backdrop-filter: saturate(1) blur(var(--mask-blur, 2px));
          backdrop-filter:         saturate(1) blur(var(--mask-blur, 2px));
          opacity: 0; transition: opacity .16s ease;
          z-index: 2147483000;
        }
        html.shell-mask-active .module-blur-mask{ opacity: 1; }
        /* 避免双重变暗：把常见框架的遮罩“底色”透明化（只改颜色，不改命中区域） */
        html.shell-mask-active .ant-modal-mask,
        html.shell-mask-active .ant-modal-wrap,
        html.shell-mask-active .el-overlay,
        html.shell-mask-active .layui-layer-shade,
        html.shell-mask-active .van-overlay{
          background: transparent !important;
        }
      `;
      document.head.appendChild(style);
    }
    return el;
  }
  ensureLocalMask();

  // ---------- 选择器与可见性判断 ----------
  const MODAL_SELECTORS = [
    '.modal.open',
    '.modal[aria-modal="true"]:not([aria-hidden="true"])',
    'dialog[open]',
    '[role="dialog"][aria-modal="true"]:not([aria-hidden="true"])',
    '.ant-modal-wrap',
    '.ant-drawer-mask + .ant-drawer',
    '.ant-modal-root',
    '.el-dialog__wrapper',
    '.el-overlay',
    '.layui-layer',
    '.layui-layer-shade',
    '.van-overlay',
    '.van-overlay + .van-popup'
  ];

  function isShown(el){
    if(!el || !el.ownerDocument) return false;
    const st = getComputedStyle(el);
    if(st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity||'1') === 0) return false;
    const r = el.getBoundingClientRect();
    return (r.width > 0 && r.height > 0);
  }

  function anyOverlayVisible(){
    for(const sel of MODAL_SELECTORS){
      const list = document.querySelectorAll(sel);
      for(const el of list){ if(isShown(el)) return true; }
    }
    return false;
  }

  // ---------- 与壳层通信 ----------
  const post = (action, extra={}) => {
    try{ TOP.postMessage({ type: 'shell-mask', action, source: 'module', ...extra }, '*'); }
    catch(_){}
  };

  let lastVis = false;
  function apply(vis){
    if(vis === lastVis) return;
    lastVis = vis;
    document.documentElement.classList.toggle('shell-mask-active', !!vis);
    post(vis ? 'show' : 'hide', { visible: !!vis });
  }

  // ---------- 观察器：DOM 变化触发判定 ----------
  const onChange = (()=>{
    let raf = 0;
    return function(){
      if(raf) return;
      raf = requestAnimationFrame(()=>{
        raf = 0;
        const vis = anyOverlayVisible();
        apply(vis);
      });
    };
  })();

  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['style','class','open','hidden','aria-hidden']
  });

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', onChange, { once: true });
  }else{
    onChange();
  }

  window.addEventListener('beforeunload', ()=> post('hide', { visible: false }));
})();