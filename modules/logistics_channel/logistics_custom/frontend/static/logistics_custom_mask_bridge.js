/* logistics_custom_mask_bridge.js
 * 与壳层的“全屏蒙层”联动，不改变任何业务逻辑。
 */
(function(){
  const TOP = window.top || window.parent || window;

  function post(action){
    try{ TOP.postMessage({ type:'shell-mask', action }, '*'); }catch(e){}
  }

  // 1) 常见打开弹窗的触发器（你可按需追加选择器）
  const OPEN_SELECTORS = [
    '#btnNew',
    '[data-open="custom-logistics-modal"]',
    '[data-open-modal]',
    '.btn--open-modal'
  ];

  document.addEventListener('click', (e)=>{
    const t = e.target.closest(OPEN_SELECTORS.join(','));
    if (t) post('show');  // 显示壳层蒙层
  }, true);

  // 2) 常见关闭弹窗的触发器（取消/确认/右上角/通用 data-close）
  const CLOSE_SELECTORS = [
    '#opCancel', '#opConfirm',
    '.modal [data-close]', '.modal .close',
    '[data-modal-close]', '.btn--modal-close'
  ];
  document.addEventListener('click', (e)=>{
    const t = e.target.closest(CLOSE_SELECTORS.join(','));
    if (t) post('hide');  // 隐藏壳层蒙层
  }, true);

  // 3) 兜底：观察所有 .modal 显隐（即便弹窗是代码打开/关闭，也能联动）
  function observeModals(){
    const list = document.querySelectorAll('.modal');
    list.forEach((modal)=>{
      const mo = new MutationObserver(()=>{
        const visible = getComputedStyle(modal).display !== 'none' && modal.offsetParent !== null;
        post(visible ? 'show' : 'hide');
      });
      mo.observe(modal, { attributes:true, attributeFilter:['style','class'] });
      // 初始化一次
      const visible = getComputedStyle(modal).display !== 'none' && modal.offsetParent !== null;
      if(visible) post('show');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeModals);
  } else {
    observeModals();
  }

  // 4) 页面即将卸载时隐藏壳层蒙层（兜底）
  window.addEventListener('beforeunload', ()=> post('hide'));
})();
