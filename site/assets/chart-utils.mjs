export const formatAbundance=n=>n>0&&n<0.0005?'<0.001':n.toLocaleString(undefined,{maximumFractionDigits:3});
export const matchesTypes=(type,selected)=>selected.size===0||selected.has(type);
export const totalCopy=rows=>rows.every(r=>Number.isFinite(r.copy))?rows.reduce((s,r)=>s+r.copy,0):null;
export const clampZoom=value=>Math.max(1,Math.min(3,value));
// Area follows log2(1 + size), with a visible minimum and an 8 px radius cap.
export const pointRadius=(weight,width,zoom)=>weight<=0?0:Math.min(8,Math.max(.9,1.4*Math.sqrt(Math.log1p(weight)/Math.LN2)))*(width/500)*Math.sqrt(zoom);
