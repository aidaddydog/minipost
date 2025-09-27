/* logistics_custom_mask_bridge.js (V3)
 * 运行环境：业务模块（iframe 内）
 * 职责：
 * 1) 观察模块内的弹窗/遮罩是否可见，通知壳层显示/隐藏灰层（ChatGPT风格模糊在壳层实现）
 * 2) 当交由壳层灰层管控时，把模块本地的遮罩背景设为透明，避免双重变暗
 */

(function(){
  const TOP = window.top || window.parent || window;
  const post = (action, extra={})=>{
    try{ TOP.postMessage({ type:'shell-mask', action, source:'module', ...extra }, '*'); }catch(e){}
  };

  // === 可见性判断 ===
  function isVisible(el){
    if(!el || !el.ownerDocument) return false;
    const st = getComputedStyle(el);
    if(st.display==='none' || st.visibility==='hidden' || parseFloat(st.opacity||'1')===0) return false;
    const r = el.getBoundingClientRect();
    return r.width>0 && r.height>0;
  }

  // 常见“弹窗/遮罩”选择器（可按你的库扩展）
  const MODAL_SELECTORS = [
    '.modal',                                  // 自研/演示
    'dialog[aria-modal="true"]',               // 原生
    '.ant-modal-wrap', '.ant-drawer-mask', '.ant-modal-root', '.ant-modal-mask',
    '.el-overlay', '.el-dialog__wrapper',
    '.layui-layer-shade', '.layui-layer',
    '.van-overlay'
  ];

  // 注入“遮罩透明化”样式（仅在“交由壳层管控”时生效）
  (function injectTransparentMaskCSS(){
    const id='moduleMaskTransparentPatch';
    if(document.getElementById(id)) return;
    const css = `
/* 当 html.shell-mask-active 标记为真时，模块内遮罩背景统一透明，避免与壳层灰层叠加 */
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

  // 观察 DOM 变化：发现/移除/显隐均会触发
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

  // 初始判定
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', onChange);
  }else{
    onChange();
  }

  // 离开页面兜底
  window.addEventListener('beforeunload', ()=> post('hide', { visible:false }));
})();
