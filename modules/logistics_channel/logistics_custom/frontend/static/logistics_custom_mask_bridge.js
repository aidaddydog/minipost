/* logistics_custom_mask_bridge.js (V2)
 * 让 iframe 内的任意“弹窗”出现/消失时，通知壳层显示/隐藏全局蒙层。
 * 兼容：.modal、原生 dialog[aria-modal]、常见 UI 框架蒙层类名（可按需扩展）。
 */
(function(){
  const TOP = window.top || window.parent || window;
  const post = (action)=>{ try{ TOP.postMessage({ type:'shell-mask', action }, '*'); }catch(e){} };

  // === 兜底：若有固定触发按钮，可在此追加选择器 ===
  const OPEN_SELECTORS = ['#btnNew','[data-open-modal]','[data-open="custom-logistics-modal"]','.btn--open-modal'];
  const CLOSE_SELECTORS= ['#opCancel','#opConfirm','.modal [data-close]','.modal .close','[data-modal-close]','.btn--modal-close'];
  document.addEventListener('click', (e)=>{
    if(e.target.closest(OPEN_SELECTORS.join(',')))  post('show');
    if(e.target.closest(CLOSE_SELECTORS.join(','))) post('hide');
  }, true);

  // === 可见性判断 ===
  function isVisible(el){
    if(!el || !el.ownerDocument) return false;
    const st = getComputedStyle(el);
    if(st.display==='none' || st.visibility==='hidden' || parseFloat(st.opacity||'1')===0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width>0 && rect.height>0;
  }

  // 常见“弹窗/遮罩”选择器（可继续扩展）
  const MODAL_SELECTORS = [
    '.modal',                                  // 自研/演示
    'dialog[aria-modal="true"]',               // 原生
    '.ant-modal-wrap', '.ant-drawer-mask',     // Ant Design
    '.el-overlay', '.el-dialog__wrapper',      // Element Plus
    '.layui-layer-shade', '.layui-layer',      // layui
    '.van-overlay'                             // Vant
  ];

  function anyModalVisible(){
    for(const sel of MODAL_SELECTORS){
      const list = document.querySelectorAll(sel);
      for(const el of list){ if(isVisible(el)) return true; }
    }
    // 兜底：role=dialog 但无 aria-modal
    const extra = document.querySelectorAll('[role="dialog"]');
    for(const el of extra){ if(isVisible(el)) return true; }
    return false;
  }

  // 观察整个文档变化：发现/移除/显隐均会触发
  let ticking = false;
  const onChange = ()=>{
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{
      ticking = false;
      post(anyModalVisible() ? 'show' : 'hide');
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

  // 卸载兜底
  window.addEventListener('beforeunload', ()=> post('hide'));
})();
