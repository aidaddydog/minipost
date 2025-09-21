// 使用 showPicker() 的点击触发适配
export function enhanceDateInputs(inputs){
  inputs.forEach(inp=>{
    if(!inp) return;
    if(typeof inp.showPicker === 'function'){
      inp.addEventListener('click',(e)=>{ e.preventDefault(); inp.showPicker(); });
      inp.addEventListener('keydown',(e)=>{ if(e.key!=='Tab') e.preventDefault(); });
    }
  });
}
