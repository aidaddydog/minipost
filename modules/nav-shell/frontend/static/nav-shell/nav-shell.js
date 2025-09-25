// 壳层渲染脚本（最小实现）：拉取 /api/v1/shell/nav 与 /api/v1/shell/profile
(async function(){
  const navEl = document.getElementById('nsNav');
  const subEl = document.getElementById('nsSubNav');
  const pill = document.createElement('span'); pill.className = 'ns-pill'; navEl.appendChild(pill);

  try{
    const prof = await fetch('/api/v1/shell/profile').then(r=>r.json());
    const loginBtn = document.getElementById('nsLogin');
    const userBox  = document.getElementById('nsUser');
    if(prof.authenticated){
      loginBtn.hidden = true;
      userBox.hidden = false;
      document.getElementById('nsUserName').textContent = prof.name || '用户';
    }else{
      loginBtn.hidden = false;
      userBox.hidden = true;
    }
  }catch(e){}

  const nav = await fetch('/api/v1/shell/nav').then(r=>r.json()).catch(()=>({l1:[],l2:{}}));
  const l1 = nav.l1 || [];
  const l2 = nav.l2 || {};
  function movePillTo(a){
    const rect = a.getBoundingClientRect();
    const pRect = navEl.getBoundingClientRect();
    const left = rect.left - pRect.left + navEl.scrollLeft;
    const w = Math.max(60, rect.width);
    pill.style.width = w + 'px';
    pill.style.transform = `translate(${left}px, -50%)`;
  }
  navEl.innerHTML = ''; navEl.appendChild(pill);
  l1.forEach((it, idx)=>{
    const a = document.createElement('a');
    a.className = 'ns-link' + (idx===0?' active':'');
    a.textContent = it.text;
    a.href = it.href || '#';
    if(it.disabled) a.classList.add('ns-disabled');
    a.addEventListener('mouseenter', ()=>movePillTo(a));
    a.addEventListener('click', (e)=>{ e.preventDefault(); setActive(a, it.href); });
    navEl.appendChild(a);
    if(idx===0) setTimeout(()=>movePillTo(a), 0);
  });

  function setActive(a, href){
    navEl.querySelectorAll('.ns-link').forEach(x=>x.classList.remove('active'));
    a.classList.add('active');
    const subs = l2[href] || [];
    subEl.innerHTML = '';
    subs.forEach((s, i)=>{
      const b = document.createElement('a');
      b.textContent = s.text; b.href = s.href || '#';
      if(s.disabled) b.classList.add('ns-disabled');
      if(i===0) b.classList.add('active');
      b.addEventListener('click', (e)=>{ e.preventDefault(); subEl.querySelectorAll('a').forEach(x=>x.classList.remove('active')); b.classList.add('active'); });
      subEl.appendChild(b);
    });
    movePillTo(a);
  }
})();
