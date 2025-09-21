function queryFocusable(container){
  return [...container.querySelectorAll('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled && el.offsetParent!==null);
}
function setPageInert(inertOn){
  const nodes = [document.querySelector('.shell'), document.querySelector('.subrow'), document.querySelector('.tabrow'), document.getElementById('footerBar')].filter(Boolean);
  nodes.forEach(el=>{ if(inertOn){ el.setAttribute('inert',''); } else { el.removeAttribute('inert'); }});
  document.documentElement.style.overflow = inertOn ? 'hidden' : '';
}
export function openModal(modal){
  modal.style.display = 'flex'; setPageInert(true);
  const box = modal.querySelector('.box'); box && box.focus();
  function trap(e){
    if(e.key!=='Tab') return; const focusables = queryFocusable(modal); if(!focusables.length) return;
    const first=focusables[0], last=focusables[focusables.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  }
  function esc(e){ if(e.key==='Escape'){ e.preventDefault(); closeModal(modal); } }
  function outside(e){ if(e.target===modal){ closeModal(modal); } }
  modal._trap = trap; modal._esc = esc; modal._outside = outside;
  modal.addEventListener('keydown', trap); document.addEventListener('keydown', esc); modal.addEventListener('click', outside);
}
export function closeModal(modal){
  modal.style.display='none';
  modal.removeEventListener('keydown', modal._trap||(()=>{}));
  document.removeEventListener('keydown', modal._esc||(()=>{}));
  modal.removeEventListener('click', modal._outside||(()=>{}));
  setPageInert(false);
}
