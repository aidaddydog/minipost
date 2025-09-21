export function closeAllMenus(exceptEl=null){
  document.querySelectorAll('.dropdown.open').forEach(el=>{ if(el!==exceptEl) el.classList.remove('open'); });
  document.querySelectorAll('.cselect.open').forEach(el=>{ if(el!==exceptEl){ el.classList.remove('open'); const btn=el.querySelector('.cs-toggle'); btn && btn.setAttribute('aria-expanded','false'); } });
}
document.addEventListener('click',(e)=>{ if(!e.target.closest('.dropdown') && !e.target.closest('.cselect')) closeAllMenus(null); });
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeAllMenus(null); });
