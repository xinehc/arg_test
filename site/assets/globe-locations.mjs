export function parseLocations(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
  const headers=lines.shift()?.split('\t').map(value=>value.trim());
  if(headers?.join(',')!=='lat,lon,size')throw Error('Expected lat, lon, size columns');
  return lines.map(line=>{
    const cells=line.split('\t');
    if(cells.length!==3||cells.some(value=>!value.trim()))throw Error('Invalid location row');
    const [lat,lon,weight]=cells.map(Number);
    if(!Number.isFinite(weight)||weight<0)throw Error('Invalid point size');
    if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)throw Error('Invalid coordinate');
    // Matches the land mask's atan2(x,z) longitude convention.
    const phi=lat*Math.PI/180,theta=lon*Math.PI/180;
    return {x:Math.cos(phi)*Math.sin(theta),y:Math.sin(phi),z:Math.cos(phi)*Math.cos(theta),weight};
  });
}
