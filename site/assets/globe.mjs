import {drawLocationMarkers,horizonOpacity} from './globe-renderer.mjs?v=hex-3';
import {buildLandCells,projectLandCell} from './globe-land.mjs?v=gap-2';
import {parseLocations} from './globe-locations.mjs';
// Adapted from ContinentHexbins / Scene in the user-supplied globe-main/index.tsx.
// The supplied Fibonacci land mask classifies a connected spherical honeycomb.
// A lightweight Canvas renderer replaces the React/Three scene.
const canvas=document.querySelector('#globe');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
async function start(){
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
  const response=await fetch(new URL('./globe/land-points.json',import.meta.url));
  if(!response.ok)throw new Error('Globe unavailable');
  const cells=buildLandCells(await response.json());
  const pointColor='#427a68';
  let markers=[];
  try {
    const locationResponse=await fetch(new URL('./globe/locations.tsv?v=teal-1',import.meta.url));
    if(!locationResponse.ok)throw Error('Locations unavailable');
    markers=parseLocations(await locationResponse.text());
  } catch { /* The decorative land layer can render without sample locations. */ }

  // Give every page load a genuinely different 3D motion. In addition to yaw,
  // pitch and roll are randomized and then drift independently, so the automatic path
  // can arc diagonally instead of always sweeping horizontally around the equator.
  let angle=Math.random()*Math.PI*2,tilt=(Math.random()*.9)-.45,roll=(Math.random()*Math.PI*2)-Math.PI;
  let tiltVelocity=(Math.random()<.5?-1:1)*(.000006+Math.random()*.000012);
  const yawVelocity=(Math.random()<.5?-1:1)*(.000028+Math.random()*.000036);
  const rollVelocity=(Math.random()<.5?-1:1)*(.000006+Math.random()*.000014);
  const yawPhase=Math.random()*Math.PI*2,tiltPhase=Math.random()*Math.PI*2,rollPhase=Math.random()*Math.PI*2;
  let motionTime=0;
  let size=0,frame=0,last=0,visible=true,paused=reduced.matches;
  // Fixed scale: CSS sizes this decorative canvas to the viewport.
  const zoom=1;
  function draw(){
    if(!size)return;
    const dpr=Math.min(devicePixelRatio||1,1.5);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
    // Leave the ocean and surrounding canvas transparent: only land and samples
    // are painted, allowing the page background to show through the globe.
    const cx=size/2,cy=size/2,r=size*.46;
    const ca=Math.cos(angle),sa=Math.sin(angle),ct=Math.cos(tilt),st=Math.sin(tilt),cr=Math.cos(roll),sr=Math.sin(roll);
    // Slightly inset geographic cells retain small gaps during rotation.
    const rotation={ca,sa,ct,st,cr,sr};
    for(const cell of cells){
      const polygon=projectLandCell(cell.insetVertices,rotation);
      if(polygon.length<3)continue;
      const [x,y,z]=cell.center;
      const depth=y*st+(z*ca-x*sa)*ct;
      ctx.beginPath();
      polygon.forEach(([px,py],index)=>{
        index?ctx.lineTo(cx+px*r,cy-py*r):ctx.moveTo(cx+px*r,cy-py*r);
      });
      ctx.closePath();
      const eased=horizonOpacity(depth-.015,.14);
      // Filled hexagon shapes with no outlines.
      ctx.fillStyle='rgb(106,133,121)';ctx.globalAlpha=(.10+depth*.12)*eased;ctx.fill();
    }
    ctx.globalAlpha=1;
    drawLocationMarkers(ctx,markers,pointColor,{ca,sa,ct,st,cr,sr,cx,cy,r,size,zoom});
  }
  function animate(now){
    frame=0;if(!visible||document.hidden||paused)return;
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
  function schedule(){if(!frame&&visible&&!document.hidden&&!paused){last=performance.now();frame=requestAnimationFrame(animate);}}
  function refresh(){cancelAnimationFrame(frame);frame=0;draw();schedule();}
  new ResizeObserver(()=>{size=canvas.clientWidth;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);refresh();}).observe(canvas);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;refresh();}).observe(canvas);
  document.addEventListener('visibilitychange',refresh);
  reduced.addEventListener('change',()=>{paused=reduced.matches;refresh();});
  refresh();
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});window.addEventListener('pageshow',schedule);
}
start().catch(()=>{canvas.hidden=true;});
