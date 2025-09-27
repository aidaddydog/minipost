/* modules/navauth_shell/frontend/static/mask_bridge.js  (V2)
 * 运行位置：业务模块（iframe 内）
 *
 * 目标：
 *  - 当模块内出现“弹窗/遮罩”时：
 *    1) 向壳层 postMessage 通知显示灰层（维持全页一致的“被模糊”语义）
 *    2) 在 iframe 内部插入一个“纯视觉模糊层”（pointer-events: none），
 *       让卡片/表格也被淡淡模糊，但不影响弹窗可交互
 *  - 当弹窗关闭时，移除/隐藏模糊层，并通知壳层收起灰层
 *
 * 特性：
 *  - 仅“透明模糊”，不叠加任何颜色
 *  - 默认模糊强度较轻（可通过 --mask-blur 变量调节）
 *  - 兼容多种 UI 框架选择器（ant/el/layui/vant/自研 .modal 等）
 */

(function () {
  // ---------------- postMessage 到壳层 ----------------
  const TOP = window.top || window.parent || window;
  const post = (action, extra = {}) => {
    try {
      TOP.postMessage({ type: 'shell-mask', action, source: 'module', ...extra }, '*');
    } catch (e) { /* ignore */ }
  };

  // ---------------- 可见性判断 & 选择器 ----------------
  function isVisible(el) {
    if (!el || !el.ownerDocument) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity || '1') === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
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

  function anyModalVisible() {
    for (const sel of MODAL_SELECTORS) {
      const list = document.querySelectorAll(sel);
      for (const el of list) { if (isVisible(el)) return true; }
    }
    // 兜底：role=dialog（即使未标 aria-modal）
    const extra = document.querySelectorAll('[role="dialog"]');
    for (const el of extra) { if (isVisible(el)) return true; }
    return false;
  }

  // ---------------- 注入样式（透明模糊 + 透明化外部遮罩） ----------------
  (function injectCSS() {
    const id = 'moduleMaskBlurPatch';
    if (document.getElementById(id)) return;

    const css = `
:root{
  /* 统一可调：淡淡的透明模糊（你也可在模块页或壳层通过 :root 覆盖成 6px、8px 等） */
  --mask-blur: 6px;
  --mask-saturate: 1.0;
}

/* 纯视觉模糊层：仅负责“看起来被模糊”，不拦截点击 */
.module-blur-mask{
  position: fixed; inset: 0;
  background: transparent;
  pointer-events: none;
  -webkit-backdrop-filter: saturate(var(--mask-saturate)) blur(var(--mask-blur));
  backdrop-filter:         saturate(var(--mask-saturate)) blur(var(--mask-blur));
  z-index: 180;           /* 需低于你模块弹窗层（演示页 .modal 为 200） */
  opacity: 0;
  transition: opacity .16s ease;
}
html.shell-mask-active .module-blur-mask{ opacity: 1; }

/* 当交由壳层统一模糊时，把模块自己的遮罩背景透明化，避免双重变暗（仅改“颜色”，不改命中区域） */
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
    const style = document.createElement('style');
    style.id = id; style.textContent = css;
    document.head.appendChild(style);
  })();

  function ensureModuleBlurMask() {
    let el = document.getElementById('moduleBlurMask');
    if (!el) {
      el = document.createElement('div');
      el.id = 'moduleBlurMask';
      el.className = 'module-blur-mask';
      document.body.appendChild(el);
    }
    return el;
  }

  // ---------------- DOM 观察：弹窗显隐 -> 同步壳层灰层 + 本地视觉模糊 ----------------
  let ticking = false, lastVisible = null;
  const onChange = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const vis = anyModalVisible();
      if (vis === lastVisible) return;
      lastVisible = vis;

      // 标记位：供样式选择器使用
      document.documentElement.classList.toggle('shell-mask-active', !!vis);

      // 本地视觉模糊（卡片/表格也需“被模糊”）
      const blurMask = ensureModuleBlurMask();
      blurMask.style.display = vis ? 'block' : 'none';

      // 通知壳层（维持壳层灰层状态与滚动锁定等）
      post(vis ? 'show' : 'hide', { visible: vis });
    });
  };

  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['style','class','open','hidden','aria-hidden']
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onChange, { once: true });
  } else {
    onChange();
  }

  // 离开页面兜底
  window.addEventListener('beforeunload', () => post('hide', { visible: false }));
})();
