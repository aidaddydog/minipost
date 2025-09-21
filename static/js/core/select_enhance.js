// 原生 select → 自定义菜单（ARIA+键盘）
export function upgradeSelectToMenu(selectEl, opts={ sizeLike:false, dropUp:false }){
  if(!selectEl || selectEl.dataset.enhanced === '1') return;
  const wrapper = document.createElement('div');
  wrapper.className = 'cselect' + (opts.sizeLike ? ' size-like' : '') + (opts.dropUp ? ' dropup' : '');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cs-toggle';
  btn.setAttribute('aria-haspopup','listbox');
  btn.setAttribute('aria-expanded','false');
  const txtSpan = document.createElement('span'); txtSpan.className = 'cs-text';
  const curOpt = selectEl.options[selectEl.selectedIndex] || null;
  txtSpan.textContent = curOpt ? curOpt.text : '';
  const caret = document.createElement('span'); caret.className = 'caret'; caret.textContent = '▾';
  btn.appendChild(txtSpan); btn.appendChild(caret);
  const menu = document.createElement('div'); menu.className = 'menu'; menu.setAttribute('role','listbox'); menu.tabIndex = -1;

  const aEls = [];
  [...selectEl.options].forEach((opt, idx)=>{
    const a = document.createElement('a');
    a.href = '#'; a.dataset.value = opt.value; a.textContent = opt.text; a.setAttribute('role','option');
    if(idx===selectEl.selectedIndex) a.setAttribute('aria-selected','true');
    a.addEventListener('click', (e)=>{
      e.preventDefault(); selectEl.value = opt.value; txtSpan.textContent = opt.text;
      menu.querySelectorAll('[aria-selected]').forEach(x=>x.removeAttribute('aria-selected')); a.setAttribute('aria-selected','true');
      selectEl.dispatchEvent(new Event('change', { bubbles:true }));
      wrapper.classList.remove('open'); btn.setAttribute('aria-expanded','false'); btn.focus();
    });
    menu.appendChild(a); aEls.push(a);
  });

  selectEl.classList.add('sr-select'); selectEl.dataset.enhanced = '1';
  selectEl.parentNode.insertBefore(wrapper, selectEl); wrapper.appendChild(selectEl); wrapper.appendChild(btn); wrapper.appendChild(menu);
  btn.addEventListener('click', (e)=>{ e.stopPropagation(); const willOpen = !wrapper.classList.contains('open'); document.querySelectorAll('.cselect.open').forEach(x=>x.classList.remove('open')); wrapper.classList.toggle('open', willOpen); btn.setAttribute('aria-expanded', willOpen?'true':'false'); if(willOpen){ const cur = aEls.find(a=>a.getAttribute('aria-selected')==='true') || aEls[0]; if(cur){ menu.focus({preventScroll:true}); setTimeout(()=>cur.scrollIntoView({block:'nearest'}),0);} } });
  btn.addEventListener('keydown', (e)=>{ if(e.key==='ArrowDown' || e.key==='Enter' || e.key===' '){ e.preventDefault(); btn.click(); } });
  menu.addEventListener('keydown', (e)=>{
    const curIdx = aEls.findIndex(a=>a.getAttribute('aria-selected')==='true'); let next = curIdx;
    if(e.key==='Escape'){ e.preventDefault(); wrapper.classList.remove('open'); btn.setAttribute('aria-expanded','false'); btn.focus(); return; }
    if(e.key==='ArrowDown'){ next = Math.min(aEls.length-1, curIdx+1); }
    else if(e.key==='ArrowUp'){ next = Math.max(0, curIdx-1); }
    else if(e.key==='Home'){ next = 0; }
    else if(e.key==='End'){ next = aEls.length-1; }
    else if(e.key==='Enter' || e.key===' '){ e.preventDefault(); (aEls[curIdx>=0?curIdx:0]).click(); return; } else { return; }
    e.preventDefault(); if(next!==curIdx && aEls[next]){ menu.querySelectorAll('[aria-selected]').forEach(x=>x.removeAttribute('aria-selected')); aEls[next].setAttribute('aria-selected','true'); aEls[next].scrollIntoView({block:'nearest'}); }
  });
}
