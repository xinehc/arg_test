export function normalizeAccession(value){const s=value.trim().toUpperCase();return /^[A-Z0-9][A-Z0-9_-]{0,99}$/.test(s)?s:null;}
export function profileUrl(config,accession,base=document.baseURI){const id=normalizeAccession(accession);if(!id)throw Error('Accession not found. Enter a complete accession.');const root=new URL(config.profileBaseUrl.replace(/\/?$/,'/'),base);const prefix=(config.filePrefix||'').replace(/^\/+|\/+$/g,'');return new URL((prefix?prefix.split('/').map(encodeURIComponent).join('/')+'/':'')+encodeURIComponent(id)+(config.profileExtension||'.txt.gz'),root).href;}
export async function readConfig(){const r=await fetch('./config.json',{cache:'no-cache'});if(!r.ok)throw Error('Website configuration could not be loaded. Please retry.');const c=await r.json();if(typeof c.profileBaseUrl!=='string'||!c.profileBaseUrl)throw Error('Profile storage is not configured.');if(c.profileBaseUrl.includes('.r2.cloudflarestorage.com'))throw Error('Use the bucket public URL, not its S3 API endpoint.');return c;}
function parseAbundance(text,accession){const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());if(lines.length<2)throw Error('The profile file is empty or has no abundance rows.');const headers=lines[0].split('\t').map(s=>s.trim().toLowerCase());const native=headers.join(',')==='subtype,copy,abundance';const canonical=['type,subtype,abundance','type,subtype,copy,abundance'].includes(headers.join(','));if(!native&&!canonical)throw Error('Unsupported TXT header. Expected subtype / copy / abundance or type / subtype / abundance, separated by tabs.');if(lines.length>10001)throw Error('Profile exceeds the supported 10,000 rows.');const pairs=new Set();const rows=lines.slice(1).map((line,index)=>{const cells=line.split('\t').map(s=>s.trim());if(cells.length!==headers.length)throw Error(`Invalid column count on row ${index+2}.`);const raw=Object.fromEntries(headers.map((h,i)=>[h,cells[i]]));let type=raw.type,subtype=raw.subtype;if(native){const pipe=subtype.indexOf('|');if(pipe<1||pipe===subtype.length-1)throw Error(`Expected type|subtype on row ${index+2}.`);type=subtype.slice(0,pipe).trim();subtype=subtype.slice(pipe+1).trim();}if(!type||!subtype)throw Error(`Missing type or subtype on row ${index+2}.`);if(!raw.abundance||!Number.isFinite(Number(raw.abundance))||Number(raw.abundance)<0)throw Error(`Invalid abundance on row ${index+2}.`);const row={type,subtype,abundance:Number(raw.abundance)};if('copy' in raw){if(!raw.copy||!Number.isFinite(Number(raw.copy))||Number(raw.copy)<0)throw Error(`Invalid copy on row ${index+2}.`);row.copy=Number(raw.copy);}const pair=JSON.stringify([type,subtype]);if(pairs.has(pair))throw Error(`Duplicate type/subtype on row ${index+2}.`);pairs.add(pair);return row;});const total=rows.reduce((s,r)=>s+r.abundance,0);if(!Number.isFinite(total))throw Error('The profile total is invalid.');return {id:accession,filename:accession+'.txt',rows,total,typeCount:new Set(rows.filter(r=>r.abundance>0).map(r=>r.type)).size,subtypeCount:rows.filter(r=>r.abundance>0).length};}
export function parseProfile(text,accession){
 const id=normalizeAccession(accession);if(!id)throw Error('Invalid accession.');
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
 const first=lines.find(line=>line.trim())?.trim();
 let metadata=[],abundance=text;
 if(first?.startsWith('[')){
  const sections=new Map();let active;
  for(const line of lines){
   if(!line.trim())continue;
   if(/^\[.*\]$/.test(line.trim())){
    const name=line.trim().toLowerCase();
    if(!['[metadata]','[abundance]'].includes(name)||sections.has(name))throw Error('Invalid or duplicate TXT section: '+name);
    active=[];sections.set(name,active);
   }else{if(!active)throw Error('Content before TXT section.');active.push(line);}
  }
  if(!sections.has('[metadata]')||!sections.has('[abundance]'))throw Error('Expected [metadata] and [abundance] sections.');
  const entries=sections.get('[metadata]');const seen=new Set();
  for(let i=0;i<entries.length;i++){
   const cells=entries[i].split('\t');
   if(i===0&&cells.length===2&&cells[0].trim()==='field'&&cells[1].trim()==='value')continue;
   if(cells.length!==2||!cells[0].trim())throw Error('Metadata must contain tab-separated field and value pairs.');
   const key=cells[0].trim(),value=cells[1];
   if(seen.has(key))throw Error('Duplicate metadata field: '+key);seen.add(key);
   if(key==='accession'&&normalizeAccession(value)!==id)throw Error('Metadata accession does not match the requested profile.');
   metadata.push([key,value]);
  }
  abundance=sections.get('[abundance]').join('\n');
 }
 return {...parseAbundance(abundance,id),metadata,rawText:text};
}
export const MAX_PROFILE_BYTES=5_000_000;
async function readBounded(stream,signal){
 if(!stream)throw Error('Empty profile response.');
 const reader=stream.getReader(),chunks=[];let size=0;
 const abort=()=>{void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
 try{
  while(true){signal?.throwIfAborted();const {done,value}=await reader.read();signal?.throwIfAborted();if(done)break;size+=value.byteLength;
   if(size>MAX_PROFILE_BYTES){await reader.cancel();throw Error('Profile exceeds the supported 5 MB size.');}chunks.push(value);
  }
 }finally{signal?.removeEventListener('abort',abort);reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function decodeProfileResponse(response,signal){
 let bytes=await readBounded(response.body,signal);
 // Inspect bytes, not headers: fetch may already have decoded Content-Encoding.
 if(bytes[0]===0x1f&&bytes[1]===0x8b){
  if(typeof DecompressionStream==='undefined')throw Error('This browser cannot decompress profiles. Please use a current Chrome, Edge, Firefox or Safari.');
  try{bytes=await readBounded(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),signal);}
  catch(e){if(signal?.aborted||e.message.includes('5 MB'))throw e;throw Error('The gzip profile is damaged or incomplete.');}
 }
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('Profile must contain UTF-8 text.');}
}
export async function loadProfile(config,accession,signal){
 const url=profileUrl(config,accession);
 try{const cached=JSON.parse(sessionStorage.getItem('arg-combined-profile-v1')||'null');if(cached?.url===url&&Date.now()-cached.time<60000)return parseProfile(cached.text,accession);}catch{}
 let response;try{response=await fetch(url,{signal,mode:'cors'});}catch(e){if(e.name==='AbortError')throw e;throw Error('Could not reach profile storage. Check the public bucket URL, CORS settings, or your connection.');}
 if(response.status===404)throw Error('Accession not found. This accession is not in the collection.');
 if(!response.ok)throw Error('Profile storage is temporarily unavailable. Please retry.');
 const raw=await decodeProfileResponse(response,signal),data=parseProfile(raw,accession);
 try{sessionStorage.setItem('arg-combined-profile-v1',JSON.stringify({url,text:raw,time:Date.now()}));}catch{}
 return data;
}
export function el(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=String(text);return e;}
export const number=n=>n===0?'0':n<.0001?n.toExponential(3):n.toLocaleString(undefined,{maximumSignificantDigits:5});
