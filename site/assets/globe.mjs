import {pointRadius} from './chart-utils.mjs';
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
  const colors={'host-associated':'#a05f5a',environmental:'#3e7f8f',engineered:'#b58c45'};
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

  // Give every page load a genuinely different 3D motion. In addition to yaw,
  // pitch and roll are randomized and then drift independently, so the automatic path
  // can arc diagonally instead of always sweeping horizontally around the equator.
  let angle=Math.random()*Math.PI*2,tilt=(Math.random()*.9)-.45,roll=(Math.random()*Math.PI*2)-Math.PI;
  let tiltVelocity=(Math.random()<.5?-1:1)*(.000006+Math.random()*.000012);
  const yawVelocity=(Math.random()<.5?-1:1)*(.000028+Math.random()*.000036);
  const rollVelocity=(Math.random()<.5?-1:1)*(.000006+Math.random()*.000014);
  const yawPhase=Math.random()*Math.PI*2,tiltPhase=Math.random()*Math.PI*2,rollPhase=Math.random()*Math.PI*2;
  let motionTime=0;
  let size=0,frame=0,last=0,visible=true,paused=reduced.matches,drag=null,zoom=1;
  // Start smaller, then allow a more useful zoom range. The globe canvas is deliberately
  // wider than its layout column on desktop (see home.css), so the sphere can grow like a
  // background visual without ever touching the canvas edge. maxRadiusRatio also leaves
  // enough internal room for the rim stroke and the largest location markers.
  const baseRadiusRatio=.34,maxRadiusRatio=.455,maxZoom=maxRadiusRatio/baseRadiusRatio;
  const setButton=()=>{toggle.textContent=paused?'Resume rotation':'Pause rotation';toggle.setAttribute('aria-pressed',String(paused));};
  function draw(){
    if(!size)return;
    const dpr=Math.min(devicePixelRatio||1,1.5);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
    const cx=size/2,cy=size/2,r=size*baseRadiusRatio*zoom;
    const halo=ctx.createRadialGradient(cx,cy,r*.72,cx,cy,r*1.18);halo.addColorStop(0,'rgba(47,137,105,0.10)');halo.addColorStop(.72,'rgba(47,137,105,0.045)');halo.addColorStop(1,'rgba(47,137,105,0)');
    ctx.fillStyle=halo;ctx.fillRect(0,0,size,size);
    // Keep the globe surface fully opaque. There is no stroked rim, but unlike the
    // previous soft-edge treatment the sphere itself never fades to transparency.
    const sphere=ctx.createRadialGradient(cx-r*.34,cy-r*.38,r*.08,cx,cy,r);
    sphere.addColorStop(0,'rgb(248,252,250)');
    sphere.addColorStop(.58,'rgb(226,239,232)');
    sphere.addColorStop(.88,'rgb(198,222,210)');
    sphere.addColorStop(1,'rgb(190,216,203)');
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=sphere;ctx.fill();
    const ca=Math.cos(angle),sa=Math.sin(angle),ct=Math.cos(tilt),st=Math.sin(tilt),cr=Math.cos(roll),sr=Math.sin(roll);
    // Draw the land mask as visible hexagonal cells rather than dot-like points.
    // Four depth bands keep the globe shaded while batching fill/stroke operations.
    const landPaths=Array.from({length:8},()=>new Path2D());
    for(const [x,y,z] of points){
      const rx=x*ca+z*sa,rz=z*ca-x*sa,ry=y*ct-rz*st,depth=y*st+rz*ct;if(depth<0)continue;
      const ux=rx*cr-ry*sr,uy=rx*sr+ry*cr;
      const px=cx+ux*r,py=cy-uy*r,hex=Math.max(1.15,size*.0032)*(0.82+depth*.18);
      const path=landPaths[Math.min(7,Math.floor(depth*8))];
      for(let j=0;j<6;j++){
        const a=Math.PI/6+j*Math.PI/3,hx=px+Math.cos(a)*hex,hy=py+Math.sin(a)*hex;
        j?path.lineTo(hx,hy):path.moveTo(hx,hy);
      }
      path.closePath();
    }
    ctx.lineWidth=Math.max(.35,size*.00065);
    landPaths.forEach((path,index)=>{
      const depth=(index+.5)/8;
      const horizon=Math.min(1,Math.max(0,(depth-.015)/.14));
      const eased=horizon*horizon*(3-2*horizon);
      ctx.fillStyle=`rgba(35,128,94,${((.10+depth*.17)*eased).toFixed(3)})`;
      ctx.strokeStyle=`rgba(20,91,68,${((.12+depth*.18)*eased).toFixed(3)})`;
      ctx.fill(path);ctx.stroke(path);
    });
    // Batch real locations by category and horizon depth. Very fine depth bands make
    // horizon opacity effectively continuous while retaining efficient batched Canvas fills.
    const markerBands=160;
    const paths=Object.fromEntries(Object.keys(colors).map(category=>[category,Array.from({length:markerBands},()=>new Path2D())]));
    for(const m of markers){
      if(!m.weight)continue;
      const rx=m.x*ca+m.z*sa,rz=m.z*ca-m.x*sa,ry=m.y*ct-rz*st,depth=m.y*st+rz*ct;
      if(depth<0)continue;
      const ux=rx*cr-ry*sr,uy=rx*sr+ry*cr;
      const px=cx+ux*r,py=cy-uy*r,dot=pointRadius(m.weight,size,zoom);
      const band=Math.min(markerBands-1,Math.floor(depth*markerBands));
      paths[m.category][band].moveTo(px+dot,py);paths[m.category][band].arc(px,py,dot,0,Math.PI*2);
    }
    for(const category of Object.keys(colors)){
      ctx.fillStyle=colors[category];
      paths[category].forEach((path,index)=>{
        const depth=(index+.5)/markerBands;
        // Smoothstep across a broad horizon zone. With 160 bands the opacity increment
        // between adjacent depths is too small to read as a flash or bucket change.
        const horizon=Math.min(1,Math.max(0,depth/.24));
        const eased=horizon*horizon*(3-2*horizon);
        ctx.globalAlpha=.60*eased;
        ctx.fill(path);
      });
    }
    ctx.globalAlpha=1;
  }
  function animate(now){
    frame=0;if(!visible||document.hidden||paused||drag)return;
    if(now-last>=16){
      const dt=Math.min(now-last,60);motionTime+=dt;
      // Slowly modulate each axis so even one page load does not settle into a fixed orbit.
      angle+=dt*yawVelocity*(.82+.18*Math.sin(motionTime*.00035+yawPhase));
      tilt+=dt*(tiltVelocity+.000006*Math.sin(motionTime*.00022+tiltPhase));
      roll+=dt*rollVelocity*(.72+.28*Math.sin(motionTime*.00027+rollPhase));
      // Softly bounce the pitch before the poles; this keeps motion varied without flipping abruptly.
      if(tilt>.72){tilt=.72;tiltVelocity=-Math.abs(tiltVelocity);}
      else if(tilt<-.72){tilt=-.72;tiltVelocity=Math.abs(tiltVelocity);}
      last=now;draw();
    }
    frame=requestAnimationFrame(animate);
  }
  function schedule(){if(!frame&&visible&&!document.hidden&&!paused&&!drag){last=performance.now();frame=requestAnimationFrame(animate);}}
  function refresh(){cancelAnimationFrame(frame);frame=0;draw();schedule();}
  new ResizeObserver(()=>{size=canvas.clientWidth;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);refresh();}).observe(canvas);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;refresh();}).observe(canvas);
  document.addEventListener('visibilitychange',refresh);
  toggle.hidden=false;setButton();toggle.addEventListener('click',()=>{paused=!paused;setButton();refresh();});
  reduced.addEventListener('change',()=>{paused=reduced.matches;setButton();refresh();});
  // The drawing itself never reaches the canvas edge. On desktop the oversized canvas
  // can extend beyond the nominal globe column as a background layer, so this feels less
  // constrained while still guaranteeing that the complete rim is rendered.
  function setZoom(value){zoom=Math.max(1,Math.min(maxZoom,value));refresh();}
  canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.002));},{passive:false});
  const pointers=new Map();let pinchDistance=null;
  const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY};if(pointers.size===2)pinchDistance=distance();refresh();});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>=2){const next=distance();if(pinchDistance>0)setZoom(zoom*next/pinchDistance);pinchDistance=next;return;}if(!drag)return;angle+=(e.clientX-drag.x)*.006/zoom;tilt=Math.max(-.72,Math.min(.72,tilt+(e.clientY-drag.y)*.003/zoom));drag={x:e.clientX,y:e.clientY};draw();});
  const release=e=>{pointers.delete(e.pointerId);pinchDistance=null;drag=pointers.size?[...pointers.values()][0]:null;schedule();};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  setZoom(1);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});window.addEventListener('pageshow',schedule);
}
start().catch(()=>{canvas.hidden=true;caption.textContent='Globe unavailable. Accession search is still available.';});
