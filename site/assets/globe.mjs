import {clampZoom,pointRadius} from './chart-utils.mjs';
// Adapted from ContinentHexbins / Scene in the user-supplied globe-main/index.tsx.
// Same Fibonacci-sphere continent sampling; a lightweight Canvas renderer replaces
// the React/Three scene. Coordinates are geographical surface points, not samples.
const canvas=document.querySelector('#globe');
const toggle=document.querySelector('#globe-toggle');
const caption=document.querySelector('#globe-caption');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
async function start(){
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
  const response=await fetch(new URL('./globe/land-points.json',import.meta.url));
  if(!response.ok)throw new Error('Globe unavailable');
  const points=await response.json();
  const colors={'host-associated':'#e33e39',environmental:'#2879ed',engineered:'#f3c624'};
  let markers=[];
  try {
    const locationResponse=await fetch(new URL('./globe/locations.tsv',import.meta.url));
    if(!locationResponse.ok)throw Error('Locations unavailable');
    const lines=(await locationResponse.text()).replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
    const headers=lines.shift().split('\t');
    if(headers.join(',')!=='biome,lat,lon,size')throw Error('Expected biome, lat, lon, size columns');
    markers=lines.map(line=>{
      const cells=line.split('\t');
      if(cells.length!==4||cells.some(value=>!value.trim()))throw Error('Invalid location row');
      const category=cells[0].trim(),lat=Number(cells[1]),lon=Number(cells[2]),weight=Number(cells[3]);
      if(!Number.isFinite(weight)||weight<0)throw Error('Invalid point size');
      if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180||!Object.hasOwn(colors,category))throw Error('Invalid coordinate');
      // Matches the equirectangular mask's atan2(x,z) longitude convention.
      const phi=lat*Math.PI/180,theta=lon*Math.PI/180;
      return {x:Math.cos(phi)*Math.sin(theta),y:Math.sin(phi),z:Math.cos(phi)*Math.cos(theta),category,weight};
    });
    caption.textContent=markers.length.toLocaleString()+' locations · logarithmic point sizes';
    document.querySelector('#globe-legend').hidden=false;
  } catch {caption.textContent='Location layer unavailable';}

  let angle=0.2,tilt=0.12,size=0,frame=0,last=0,visible=true,paused=reduced.matches,drag=null,zoom=1;
  const setButton=()=>{toggle.textContent=paused?'Resume rotation':'Pause rotation';toggle.setAttribute('aria-pressed',String(paused));};
  function draw(){
    if(!size)return;
    const dpr=Math.min(devicePixelRatio||1,1.5);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
    const cx=size/2,cy=size/2,r=size*.405*zoom;
    const halo=ctx.createRadialGradient(cx,cy,r*.8,cx,cy,r*1.2);halo.addColorStop(0,'rgba(47,137,105,0.12)');halo.addColorStop(1,'rgba(47,137,105,0)');
    ctx.fillStyle=halo;ctx.fillRect(0,0,size,size);
    const sphere=ctx.createRadialGradient(cx-r*.45,cy-r*.5,r*.1,cx+r*.1,cy+r*.15,r*1.2);sphere.addColorStop(0,'#f8fcfa');sphere.addColorStop(.6,'#e2efe8');sphere.addColorStop(1,'#b7d5c6');
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=sphere;ctx.fill();ctx.strokeStyle='#a9cdbb';ctx.lineWidth=.7;ctx.stroke();
    const ca=Math.cos(angle),sa=Math.sin(angle),ct=Math.cos(tilt),st=Math.sin(tilt);
    for(const [x,y,z] of points){
      const rx=x*ca+z*sa,rz=z*ca-x*sa,ry=y*ct-rz*st,depth=y*st+rz*ct;if(depth<0)continue;
      const px=cx+rx*r,py=cy-ry*r,dot=Math.max(.55,size*.0021)*(0.65+depth*.35);
      ctx.fillStyle=`rgba(23,103,77,${(.26+depth*.65).toFixed(2)})`;
      ctx.beginPath();for(let j=0;j<6;j++){const a=j*Math.PI/3;const hx=px+Math.cos(a)*dot,hy=py+Math.sin(a)*dot;j?ctx.lineTo(hx,hy):ctx.moveTo(hx,hy);}ctx.closePath();ctx.fill();
    }
    // Batch the real locations into three canvas paths to keep rotation smooth.
    const paths=Object.fromEntries(Object.keys(colors).map(category=>[category,new Path2D()]));
    for(const m of markers){
      if(!m.weight)continue;
      const rx=m.x*ca+m.z*sa,rz=m.z*ca-m.x*sa,ry=m.y*ct-rz*st,depth=m.y*st+rz*ct;
      if(depth<0.02)continue;
      const px=cx+rx*r,py=cy-ry*r,dot=pointRadius(m.weight,size,zoom);
      paths[m.category].moveTo(px+dot,py);paths[m.category].arc(px,py,dot,0,Math.PI*2);
    }
    ctx.globalAlpha=.85;
    for(const category of Object.keys(colors)){ctx.fillStyle=colors[category];ctx.fill(paths[category]);}

    ctx.globalAlpha=1;
  }
  function animate(now){frame=0;if(!visible||document.hidden||paused||drag)return;if(now-last>=32){angle+=Math.min(now-last,60)*.00005;last=now;draw();}frame=requestAnimationFrame(animate);}
  function schedule(){if(!frame&&visible&&!document.hidden&&!paused&&!drag){last=performance.now();frame=requestAnimationFrame(animate);}}
  function refresh(){cancelAnimationFrame(frame);frame=0;draw();schedule();}
  new ResizeObserver(()=>{size=canvas.clientWidth;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);refresh();}).observe(canvas);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;refresh();}).observe(canvas);
  document.addEventListener('visibilitychange',refresh);
  toggle.hidden=false;setButton();toggle.addEventListener('click',()=>{paused=!paused;setButton();refresh();});
  reduced.addEventListener('change',()=>{paused=reduced.matches;setButton();refresh();});
  const zoomIn=document.querySelector('#globe-zoom-in'),zoomOut=document.querySelector('#globe-zoom-out'),zoomReset=document.querySelector('#globe-zoom-reset');
  function setZoom(value){zoom=clampZoom(value);zoomIn.disabled=zoom>=3;zoomOut.disabled=zoom<=1;zoomReset.textContent=zoom.toFixed(1)+'×';refresh();}
  zoomIn.onclick=()=>setZoom(zoom+.25);zoomOut.onclick=()=>setZoom(zoom-.25);zoomReset.onclick=()=>setZoom(1);
  canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.002));},{passive:false});
  const pointers=new Map();let pinchDistance=null;
  const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY};if(pointers.size===2)pinchDistance=distance();refresh();});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>=2){const next=distance();if(pinchDistance>0)setZoom(zoom*next/pinchDistance);pinchDistance=next;return;}if(!drag)return;angle+=(e.clientX-drag.x)*.006/zoom;tilt=Math.max(-.65,Math.min(.65,tilt+(e.clientY-drag.y)*.003/zoom));drag={x:e.clientX,y:e.clientY};draw();});
  const release=e=>{pointers.delete(e.pointerId);pinchDistance=null;drag=pointers.size?[...pointers.values()][0]:null;schedule();};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  document.querySelector('#globe-zoom').hidden=false;setZoom(1);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});window.addEventListener('pageshow',schedule);
}
start().catch(()=>{canvas.hidden=true;caption.textContent='Globe unavailable. Accession search is still available.';});
