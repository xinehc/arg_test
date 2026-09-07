import test from 'node:test';
import assert from 'node:assert/strict';
import {drawLocationMarkers} from '../site/assets/globe-renderer.mjs';
import {parseLocations} from '../site/assets/globe-locations.mjs';
import {readFile} from 'node:fs/promises';
import {buildLandCells,projectLandCell} from '../site/assets/globe-land.mjs';

const color='#427a68';
const marker=(depth,weight=1)=>({x:Math.sqrt(1-depth*depth),y:0,z:depth,weight});
const view=angle=>({ca:Math.cos(angle),sa:Math.sin(angle),ct:1,st:0,cr:1,sr:0,cx:250,cy:250,r:170,size:500,zoom:1});

test('land honeycomb shares complete edges and preserves them under rotation',async()=>{
  const points=JSON.parse(await readFile(new URL('../site/assets/globe/land-points.json',import.meta.url),'utf8'));
  const cells=buildLandCells(points),edges=new Map(),ids=new Map();
  let shared=0;
  for(const cell of cells){
    assert.equal(cell.vertices.length,6);
    for(let i=0;i<6;i++){
      const a=cell.vertices[i],b=cell.vertices[(i+1)%6];
      for(const v of [a,b])if(!ids.has(v))ids.set(v,ids.size);
      const key=[ids.get(a),ids.get(b)].sort((a,b)=>a-b).join(',');
      if(edges.has(key)){
        shared++;
        const prior=edges.get(key);
        for(const angle of [0,.7,2.4])assert.deepEqual(projectLandCell([a,b],view(angle)),projectLandCell([prior[1],prior[0]],view(angle)));
      }else edges.set(key,[a,b]);
    }
  }
  assert.ok(shared>cells.length*2,'most land edges should meet an adjacent cell');
});

test('land polygons are clipped continuously at the horizon',()=>{
  const polygon=projectLandCell([[0,0,1],[1,0,-1],[0,1,1]],view(0));
  assert.equal(polygon.length,4);
  assert.ok(polygon.every(p=>p[2]>=0));
  assert.equal(polygon.filter(p=>p[2]===0).length,2);
});
// Evaluate source-over opacity at a point covered by every circle. A compound
// path covers the pixel only once, whereas separate fills accumulate density.
function render(markers,angle=0){
  const fills=[];
  const ctx={globalAlpha:1,beginPath(){},arc(){},fill(){fills.push(this.globalAlpha);}};
  drawLocationMarkers(ctx,markers,color,view(angle));
  return {alpha:1-fills.reduce((remaining,a)=>remaining*(1-a),1),fills,ctx};
}

test('overlapping samples keep density while crossing former depth buckets',()=>{
  const markers=[marker(.503),marker(.506)];
  // These nearby surface points share a bucket at angle 0 and separate at .004.
  const buckets=angle=>markers.map(m=>Math.floor((m.z*Math.cos(angle)-m.x*Math.sin(angle))*160));
  assert.equal(new Set(buckets(0)).size,1);
  assert.equal(new Set(buckets(.004)).size,2);
  const before=render(markers),after=render(markers,.004);
  assert.equal(before.fills.length,2);
  assert.ok(Math.abs(before.alpha-.84)<1e-12);
  assert.equal(before.alpha,after.alpha);
  assert.equal(after.ctx.globalAlpha,1);
  assert.equal(after.ctx.fillStyle,color);
});

test('current location file loads every row without biome data',async()=>{
  const text=await readFile(new URL('../site/assets/globe/locations.tsv',import.meta.url),'utf8');
  const markers=parseLocations(text);
  assert.ok(markers.length>0);
  assert.equal(markers.length,text.trim().split(/\r?\n/).length-1);
  assert.ok(markers.every(m=>Math.abs(Math.hypot(m.x,m.y,m.z)-1)<1e-12));
});

test('three-column locations preserve weights and reject invalid rows',()=>{
  assert.deepEqual(parseLocations('\uFEFFlat\tlon\tsize\r\n0\t0\t2\r\n'),[{x:0,y:0,z:1,weight:2}]);
  for(const row of ['91\t0\t1','0\t181\t1','0\t0\t-1','0\t0\tNaN','\t0\t1','0\t0']){
    assert.throws(()=>parseLocations('lat\tlon\tsize\n'+row));
  }
});

test('horizon appearance and former band boundaries have no opacity jump',()=>{
  for(const depth of [0,.00625,.125,.2375,.24]){
    const before=render([marker(depth-1e-7)]).alpha;
    const after=render([marker(depth+1e-7)]).alpha;
    assert.ok(Math.abs(after-before)<1e-6,`opacity jump at ${depth}`);
  }
  assert.equal(render([marker(-.1),marker(.5,0)]).fills.length,0);
});
