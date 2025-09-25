(function(){
  const form = document.getElementById('loginForm');
  const err = document.getElementById('err');
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    err.textContent = '';
    const fd = new FormData(form);
    const res = await fetch('/login', { method:'POST', body:fd });
    if(res.ok){
      // 登录后跳转首页
      location.href = '/';
    }else{
      const j = await res.json().catch(()=>({error:'登录失败'}));
      err.textContent = j.error || '登录失败';
    }
  });
})();
