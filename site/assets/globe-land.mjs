const TAU=Math.PI*2;
const surface=(lon,lat)=>[Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)];

export function buildLandCells(points){
  // Classify a regular geographic honeycomb with the supplied land samples.
  // The spatial index keeps this one-time conversion inexpensive.
  const reach=.025,bins=new Map();
  const key=(x,y,z)=>`${x},${y},${z}`;
  for(const p of points){
    const k=key(...p.map(v=>Math.floor(v/reach)));
    if(!bins.has(k))bins.set(k,[]);
    bins.get(k).push(p);
  }
  const isLand=p=>{
    const [bx,by,bz]=p.map(v=>Math.floor(v/reach));
    for(let x=bx-1;x<=bx+1;x++)for(let y=by-1;y<=by+1;y++)for(let z=bz-1;z<=bz+1;z++){
      for(const q of bins.get(key(x,y,z))||[]){
        if((p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2<=reach**2)return true;
      }
    }
    return false;
  };
  // More columns = smaller connected hexagons (240 is 25% smaller than 180).
  const columns=240,dx=TAU/columns,side=dx/Math.sqrt(3),dy=side*1.5;
  // Inset each hexagon by 14% to leave a small gap; 1 restores touching cells.
  const cellScale=1;
  const cells=[],vertices=new Map();
  // Integer lattice coordinates guarantee that neighbours reuse the same
  // vertices, including across the longitude seam. Only polar cells deform.
  const vertex=(u,v)=>{
    u=((u%(columns*2))+columns*2)%(columns*2);
    const k=`${u},${v}`;
    if(!vertices.has(k))vertices.set(k,surface(u*dx/2-Math.PI,Math.max(-Math.PI/2,Math.min(Math.PI/2,v*side/2-Math.PI/2))));
    return vertices.get(k);
  };
  for(let row=0;row*dy<=Math.PI;row++)for(let col=0;col<columns;col++){
    const u=col*2+(row%2),v=row*3;
    const center=surface(u*dx/2-Math.PI,v*side/2-Math.PI/2);
    if(!isLand(center))continue;
    const corners=[[1,1],[0,2],[-1,1],[-1,-1],[0,-2],[1,-1]].map(([du,dv])=>vertex(u+du,v+dv));
    const insetVertices=corners.map(corner=>{
      const p=corner.map((value,i)=>center[i]+(value-center[i])*cellScale);
      const length=Math.hypot(...p);
      return p.map(value=>value/length);
    });
    cells.push({center,vertices:corners,insetVertices});
  }
  return cells;
}

export function projectLandCell(vertices,{ca,sa,ct,st,cr,sr}){
  const rotated=vertices.map(([x,y,z])=>{
    const rx=x*ca+z*sa,rz=z*ca-x*sa,ry=y*ct-rz*st;
    return [rx*cr-ry*sr,rx*sr+ry*cr,y*st+rz*ct];
  });
  // Clip cells at the horizon instead of dropping a whole cell by its centre.
  const clipped=[];
  for(let i=0;i<rotated.length;i++){
    const a=rotated[i],b=rotated[(i+1)%rotated.length];
    if(a[2]>=0)clipped.push(a);
    if((a[2]>=0)!==(b[2]>=0)){
      const t=a[2]/(a[2]-b[2]);
      clipped.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),0]);
    }
  }
  return clipped;
}
