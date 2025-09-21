// 三级页签下划线
export function ensureTabInk(tabsEl){
  let ink = document.getElementById('tabInk');
  if(!ink){ ink = document.createElement('span'); ink.id='tabInk'; ink.className='tab-ink'; tabsEl && tabsEl.appendChild(ink); }
  return ink;
}
export function positionTabInk(activeTabEl){
  const tabsEl = document.getElementById('tabs');
  const ink = ensureTabInk(tabsEl);
  if(!activeTabEl){ ink.style.width='0px'; return; }
  const txt = activeTabEl.querySelector('.tab__text') || activeTabEl;
  const rect = txt.getBoundingClientRect();
  const tabsRect = tabsEl.getBoundingClientRect();
  const padX  = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tab-ink-pad-x'))||0;
  const ml    = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tab-ink-ml'))||0;
  const left  = Math.round(rect.left - tabsRect.left + ml);
  const width = Math.max(2, Math.round(rect.width + padX*2));
  ink.style.width = width + 'px';
  ink.style.transform = `translateX(${left}px)`;
}
