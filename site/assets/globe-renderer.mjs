import {pointRadius} from './chart-utils.mjs';

export function horizonOpacity(depth,width){
  const t=Math.max(0,Math.min(1,depth/width));
  return t*t*(3-2*t);
}

export function drawLocationMarkers(ctx,markers,color,{ca,sa,ct,st,cr,sr,cx,cy,r,size,zoom}){
  // Stable row order and one fill per sample keep alpha compositing
  // consistent. Combining overlapping circles in depth buckets makes their
  // opacity jump whenever they join or leave the same compound path.
  // Smaller filled dots leave the larger outlined land cells visible underneath.
  ctx.fillStyle=color;
  for(const m of markers){
    if(!m.weight)continue;
    const rx=m.x*ca+m.z*sa,rz=m.z*ca-m.x*sa,ry=m.y*ct-rz*st,depth=m.y*st+rz*ct;
    if(depth<=0)continue;
    const ux=rx*cr-ry*sr,uy=rx*sr+ry*cr;
    const px=cx+ux*r,py=cy-uy*r,dot=pointRadius(m.weight,size,zoom)*.55;
    ctx.globalAlpha=.60*horizonOpacity(depth,.24);
    ctx.beginPath();ctx.arc(px,py,dot,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
}
