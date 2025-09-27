/* modules/navauth_shell/frontend/static/mask_bridge.js  (V1)
 * 运行位置：业务模块（iframe 内）
 * 职责：
 * 1) 观察模块内的弹窗/遮罩显隐，通知壳层显示/隐藏“单一灰层”（透明模糊）
 * 2) 当交由壳层模糊时，把模块自己的遮罩背景设为透明，避免双重变暗
 */
(function(){
  const TOP = window.top || window.parent || window;
  const post = (action, extra={})=>{
    try{ TOP.postMessage({ type:'shell-mask', action, source:'module', ...extra }, '*'); }catch(e){}
  };

  // 可见性判断
  function isVisible(el){
    if(!el || !el.ownerDocument) return false;
    const st = getComputedStyle(el);
    if(st.display==='none' || st.visibility==='hidden' || parseFloat(st.opacity||'1')===0) return false;
    const r = el.getBoundingClientRect();
    return r.width>0 && r.height>0;
  }

  // 常见“弹窗/遮罩”选择器（可按你的 UI 库扩展）
  const MODAL_SELECTORS = [
    '.modal',                                  // 演示/自研
    'dialog[aria-modal="true"]',               // 原生
    '.ant-modal-wrap', '.ant-modal-root', '.ant-modal-mask', '.ant-drawer-mask',
    '.el-overlay', '.el-dialog__wrapper',
    '.layui-layer-shade', '.layui-layer',
    '.van-overlay', '.van-popup'
  ];

  // 注入：当交由壳层模糊时，模块遮罩透明化（避免 double-dim）
  (function injectTransparentMaskCSS(){
    const id='moduleMaskTransparentPatch';
    if(document.getElementById(id)) return;
    const css = `
/* 标记位：html.shell-mask-active 表示当前交由壳层模糊灰层管理 */
html.shell-mask-active .modal,
html.shell-mask-active .ant-modal-mask,
html.shell-mask-active .ant-modal-wrap,
html.shell-mask-active .el-overlay,
html.shell-mask-active .layui-layer-shade,
html.shell-mask-active .van-overlay{
  background: transparent !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}
`;
    const style=document.createElement('style');
    style.id=id; style.textContent=css;
    document.head.appendChild(style);
  })();

  function anyModalVisible(){
    for(const sel of MODAL_SELECTORS){
      const list = document.querySelectorAll(sel);
      for(const el of list){ if(isVisible(el)) return true; }
    }
    const extra = document.querySelectorAll('[role="dialog"]');
    for(const el of extra){ if(isVisible(el)) return true; }
    return false;
  }

  // DOM 观察：弹窗显隐 → 通知壳层；并在模块内打标记，用于遮罩透明化
  let ticking=false, lastVisible=null;
  const onChange = ()=>{
    if(ticking) return; ticking=true;
    requestAnimationFrame(()=>{
      ticking=false;
      const vis = anyModalVisible();
      if(vis !== lastVisible){
        lastVisible = vis;
        document.documentElement.classList.toggle('shell-mask-active', !!vis);
        post(vis ? 'show' : 'hide', { visible: vis });
      }
    });
  };

  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, {
    childList:true, subtree:true, attributes:true,
    attributeFilter:['style','class','open','hidden','aria-hidden']
  });

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', onChange);
  }else{
    onChange();
  }

  // 离开页面兜底
  window.addEventListener('beforeunload', ()=> post('hide', { visible:false }));
})();
