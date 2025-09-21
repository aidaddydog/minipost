// 占位模块：一级胶囊轨道交互（可进一步拆分/增强）
export function movePill(pill, track, target){
  if(!pill || !track || !target) return;
  const left = target.offsetLeft - track.scrollLeft;
  const minw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pill-minw'))||60;
  const width = Math.max(minw, target.offsetWidth);
  pill.style.width = width + 'px';
  pill.style.transform = `translate(${left}px,-50%)`;
  pill.style.opacity = 1;
}
