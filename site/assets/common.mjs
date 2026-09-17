export function normalizeAccession(value){const s=value.trim().toUpperCase();return /^[A-Z0-9][A-Z0-9_-]{0,99}$/.test(s)?s:null;}
export function profileUrl(accession,base=document.baseURI){
 const id=normalizeAccession(accession);
 if(!id||! /\d{3}$/.test(id))throw Error('Accession not found. Enter a complete accession ending in digits.');
 return new URL('./data/profiles/'+id.slice(-3)+'.txt.gz',base).href;
}

// Every [metadata] line starts one profile. Preserve each source block exactly,
// and use only its metadata accession for identity (never a substring match).
export function* batchProfiles(text){
 text=text.replace(/^\uFEFF/,'');
 const starts=[...text.matchAll(/^[ \t]*\[metadata\][ \t]*\r?$/gm)].map(match=>match.index);
 if(!starts.length||text.slice(0,starts[0]).replace(/^\uFEFF/,'').trim())throw Error('Invalid profile batch: expected [metadata].');
 const seen=new Set();
 for(let i=0;i<starts.length;i++){
  const raw=text.slice(starts[i],starts[i+1]??text.length);
  const end=raw.search(/^[ \t]*\[(?:data|abundance)\][ \t]*\r?$/m);
  if(end<0)throw Error('Invalid profile batch: missing [data].');
  const ids=[...raw.slice(0,end).matchAll(/^[ \t]*accession[ \t]*\t([^\r\n]*)\r?$/gm)];
  const id=ids.length===1?normalizeAccession(ids[0][1]):null;
  if(!id)throw Error('Each batch profile must contain exactly one valid accession.');
  if(seen.has(id))throw Error('Duplicate accession in profile batch: '+id);
  seen.add(id);yield {id,raw};
 }
}
export function extractProfile(text,accession){
 const id=normalizeAccession(accession);let selected;
 for(const profile of batchProfiles(text))if(profile.id===id)selected=profile.raw;
 if(selected===undefined)throw Error('Accession not found. This accession is not in the collection.');
 if(new TextEncoder().encode(selected).byteLength>MAX_PROFILE_BYTES)throw Error('Profile exceeds the supported 5 MB size.');
 return selected;
}
function parseAbundance(text,accession){const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());if(!lines.length)throw Error('The profile file is empty or has no abundance header.');const headers=lines[0].split('\t').map(s=>s.trim().toLowerCase());const native=headers.join(',')==='subtype,copy,abundance';const canonical=['type,subtype,abundance','type,subtype,copy,abundance'].includes(headers.join(','));if(!native&&!canonical)throw Error('Unsupported TXT header. Expected subtype / copy / abundance or type / subtype / abundance, separated by tabs.');if(lines.length>10001)throw Error('Profile exceeds the supported 10,000 rows.');const pairs=new Set();const rows=lines.slice(1).map((line,index)=>{const cells=line.split('\t').map(s=>s.trim());if(cells.length!==headers.length)throw Error(`Invalid column count on row ${index+2}.`);const raw=Object.fromEntries(headers.map((h,i)=>[h,cells[i]]));let type=raw.type,subtype=raw.subtype;if(native){const pipe=subtype.indexOf('|');if(pipe<1||pipe===subtype.length-1)throw Error(`Expected type|subtype on row ${index+2}.`);type=subtype.slice(0,pipe).trim();subtype=subtype.slice(pipe+1).trim();}if(!type||!subtype)throw Error(`Missing type or subtype on row ${index+2}.`);const missing=raw.abundance.toLowerCase()==='n/a';if(!missing&&(!raw.abundance||!Number.isFinite(Number(raw.abundance))||Number(raw.abundance)<0))throw Error(`Invalid abundance on row ${index+2}.`);const row={type,subtype,abundance:missing?null:Number(raw.abundance)};if('copy' in raw){if(!raw.copy||!Number.isFinite(Number(raw.copy))||Number(raw.copy)<0)throw Error(`Invalid copy on row ${index+2}.`);row.copy=Number(raw.copy);}const pair=JSON.stringify([type,subtype]);if(pairs.has(pair))throw Error(`Duplicate type/subtype on row ${index+2}.`);pairs.add(pair);return row;});const total=rows.some(r=>r.abundance===null)?null:rows.reduce((s,r)=>s+r.abundance,0);if(total!==null&&!Number.isFinite(total))throw Error('The profile total is invalid.');return {id:accession,filename:accession+'.txt',rows,total,typeCount:new Set(rows.filter(r=>r.abundance>0||(r.abundance===null&&r.copy>0)).map(r=>r.type)).size,subtypeCount:rows.filter(r=>r.abundance>0||(r.abundance===null&&r.copy>0)).length};}
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
    const section=line.trim().toLowerCase(),name=section==='[data]'?'[abundance]':section;
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
export const MAX_BATCH_BYTES=32_000_000;
async function readBounded(stream,signal,maxBytes){
 if(!stream)throw Error('Empty profile response.');
 const reader=stream.getReader(),chunks=[];let size=0;
 const abort=()=>{void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
 try{
  while(true){signal?.throwIfAborted();const {done,value}=await reader.read();signal?.throwIfAborted();if(done)break;size+=value.byteLength;
   if(size>maxBytes){await reader.cancel();throw Error(`Profile exceeds the supported ${maxBytes/1_000_000} MB size.`);}chunks.push(value);
  }
 }finally{signal?.removeEventListener('abort',abort);reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function decodeProfileResponse(response,signal,maxBytes=MAX_PROFILE_BYTES){
 let bytes=await readBounded(response.body,signal,maxBytes);
 // Inspect bytes, not headers: fetch may already have decoded Content-Encoding.
 if(bytes[0]===0x1f&&bytes[1]===0x8b){
  if(typeof DecompressionStream==='undefined')throw Error('This browser cannot decompress profiles. Please use a current Chrome, Edge, Firefox or Safari.');
  try{bytes=await readBounded(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),signal,maxBytes);}
  catch(e){if(signal?.aborted||e.message.includes('exceeds the supported'))throw e;throw Error('The gzip profile is damaged or incomplete.');}
 }
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('Profile must contain UTF-8 text.');}
}
export async function loadProfile(accession,signal){
 signal?.throwIfAborted();
 const id=normalizeAccession(accession),url=profileUrl(accession);
 // A batch URL is shared by many accessions. Cache only the selected profile,
 // keyed by BOTH URL and full accession, and never cache an entire batch.
 const cacheKey='arg-batch-profile-v2';
 try{const cached=JSON.parse(sessionStorage.getItem(cacheKey)||'null');if(cached?.url===url&&cached.id===id&&Date.now()-cached.time<60000)return parseProfile(cached.text,id);}catch{}
 let response;try{response=await fetch(url,{signal,mode:'same-origin'});}catch(e){if(signal?.aborted)signal.throwIfAborted();if(e.name==='AbortError')throw e;throw Error('Could not reach profile data. Check your connection and try again.');}
 if(response.status===404)throw Error('Accession not found. This accession is not in the collection.');
 if(!response.ok)throw Error('Profile data is temporarily unavailable. Please retry.');
 const batch=await decodeProfileResponse(response,signal,MAX_BATCH_BYTES);
 signal?.throwIfAborted();
 const raw=extractProfile(batch,id),data=parseProfile(raw,id);
 try{sessionStorage.setItem(cacheKey,JSON.stringify({url,id,text:raw,time:Date.now()}));}catch{}
 return data;
}
export function el(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=String(text);return e;}
