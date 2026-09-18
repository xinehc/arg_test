import {subtypeUrl} from './subtype-data.mjs?v=type-batches-1';
import {formatAbundance,matchesTypes} from './chart-utils.mjs?v=abundance-precision-4';
import {showMetadata} from './metadata.mjs?v=readable-labels-1';
import {normalizeAccession,loadProfile,el} from './common.mjs?v=static-profiles-1';
const $=id=>document.getElementById(id),palette=['#117663','#318ab5','#8864b4','#ce9250','#ce6387','#597eba','#539c82','#808c52'];
let profile,types,rows,selectedTypes=new Set(),query='';
const percent=(v,t)=>Number.isFinite(v)&&Number.isFinite(t)&&t?100*v/t:0;
const share=v=>v===null||profile.total===null?'Not available':percent(v,profile.total).toFixed(2)+'%';
const rankValue=v=>v===null?-Infinity:v;
const display=formatAbundance;
const color=type=>palette[Math.max(0,types.findIndex(t=>t.name===type))%palette.length];
function subtypeLink(row){const link=el('a','subtype-link',row.subtype);link.href=subtypeUrl(row);link.setAttribute('aria-label',`Explore ${row.subtype} (${row.type})`);return link;}
function selectTypes(names,multi=false){
 if(multi){
  const allSelected=names.every(name=>selectedTypes.has(name));
  for(const name of names)allSelected?selectedTypes.delete(name):selectedTypes.add(name);
 }else{
  const isOnlySelection=selectedTypes.size===names.length&&names.every(name=>selectedTypes.has(name));
  selectedTypes.clear();
  if(!isOnlySelection)for(const name of names)selectedTypes.add(name);
 }
 renderTypes();renderRows();
}
function renderTypes(){
 const rankings=$('types');rankings.replaceChildren();
 $('type-count').textContent=types.length+' type'+(types.length===1?'':'s');
 const maxType=types[0]?.value||1;
 for(const type of types){
  const row=el('button','type-bar-row'+(selectedTypes.has(type.name)?' chosen':''));
  row.setAttribute('aria-pressed',String(selectedTypes.has(type.name)));
  const label=el('div','subtype-label type-bar-label'),labelLine=el('span','type-label-line'),dot=el('span','type-dot');
  dot.style.background=color(type.name);labelLine.append(dot,el('b','',type.name));label.append(labelLine);
  const bar=el('div','abundance-track'),fill=el('span');fill.style.width=percent(type.value,maxType)+'%';fill.style.background=color(type.name);bar.append(fill);
  const value=el('div','abundance-number');value.append(el('b','',display(type.value)),el('small','',share(type.value)));
  row.append(label,bar,value);row.onclick=e=>selectTypes([type.name],e.shiftKey);rankings.append(row);
 }
}
function renderRows(){const filtered=rows.filter(r=>matchesTypes(r.type,selectedTypes)&&r.subtype.toLowerCase().includes(query));$('subtype-count').textContent=filtered.length+' subtype'+(filtered.length===1?'':'s');$('measure-heading').textContent='ABUNDANCE / %';$('clear-type').hidden=!selectedTypes.size;$('clear-type').textContent='Clear '+selectedTypes.size+' selected type'+(selectedTypes.size===1?'':'s')+' ×';const bars=$('bars');bars.replaceChildren();filtered.forEach((r,i)=>{const row=el('div','subtype-bar-row'),label=el('div','subtype-label');const name=el('b');name.append(subtypeLink(r));label.append(name,el('small','',r.type));const bar=el('div','abundance-track'),fill=el('span');fill.style.width=percent(r.abundance,filtered[0]?.abundance||1)+'%';fill.style.background=color(r.type);bar.append(fill);const value=el('div','abundance-number');value.append(el('b','',display(r.abundance)),el('small','',share(r.abundance)));row.append(el('span','rank-number',i+1),label,bar,value);bars.append(row);});if(!filtered.length)bars.append(el('p','subtype-empty',rows.length?'No subtypes match these filters.':'No resistance subtypes were reported for this sample.'));}
function table(){const hasCopy=profile.rows.some(r=>r.copy!==undefined),table=el('table'),head=el('thead'),hr=el('tr');for(const key of ['Type','Subtype','Abundance',...(hasCopy?['Copy']:[])])hr.append(el('th','',key));head.append(hr);table.append(head);const body=el('tbody');for(const r of profile.rows){const tr=el('tr');for(const [index,value] of [r.type,r.subtype,display(r.abundance),...(hasCopy?[r.copy===undefined?'—':display(r.copy)]:[])].entries()){const cell=el('td');if(index===1)cell.append(subtypeLink(r));else cell.textContent=String(value);tr.append(cell);}body.append(tr);}table.append(body);$('data').append(table);}
function tab(id,focus=false){for(const name of ['distribution','data']){const active=name===id;$(name).hidden=!active;$('tab-'+name).setAttribute('aria-selected',String(active));$('tab-'+name).tabIndex=active?0:-1;}if(focus)$('tab-'+id).focus();}
for(const id of ['distribution','data']){$('tab-'+id).onclick=()=>tab(id);$('tab-'+id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();tab(e.key==='Home'?'distribution':e.key==='End'?'data':id==='data'?'distribution':'data',true);}};}
$('subtype-query').oninput=e=>{query=e.target.value.toLowerCase();renderRows();};$('clear-type').onclick=()=>{selectedTypes.clear();renderTypes();renderRows();};
$('download').onclick=()=>{
 const marker=/^[ \t]*\[(?:data|abundance)\][ \t]*\r?\n/im.exec(profile.rawText);
 const text=(marker?profile.rawText.slice(marker.index+marker[0].length):profile.rawText).trim()+'\n';
 const url=URL.createObjectURL(new Blob([text],{type:'text/tab-separated-values;charset=utf-8'}));
 const link=el('a');link.href=url;link.download=profile.id+'.tsv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
try{const accession=normalizeAccession(new URLSearchParams(location.search).get('accession')||'');if(!accession)throw Error('Accession not found. Enter a complete accession on the search page.');profile=await loadProfile(accession);$('profile-title').textContent=accession;const totals=new Map();for(const r of profile.rows)totals.set(r.type,r.abundance===null||totals.get(r.type)===null?null:(totals.get(r.type)||0)+r.abundance);types=[...totals].map(([name,value])=>({name,value})).sort((a,b)=>rankValue(b.value)-rankValue(a.value)||a.name.localeCompare(b.name));rows=[...profile.rows].sort((a,b)=>rankValue(b.abundance)-rankValue(a.abundance)||a.subtype.localeCompare(b.subtype));const metadata=new Map(profile.metadata.map(([key,value])=>[key.trim().toLowerCase(),value.trim()]));
for(const [field,database,pattern] of [['project','bioproject',/^(?:PRJ[A-Z]+)?\d+$/i],['sample','biosample',/^(?:SAM[A-Z]+)?\d+$/i]]){
 const value=metadata.get(field)||'Not available',container=$('profile-'+field);
 if(pattern.test(value)){
  const link=el('a','subtype-link',value);
  link.href=`https://www.ncbi.nlm.nih.gov/${database}/${encodeURIComponent(value)}/`;
  container.replaceChildren(link);
 }else container.textContent=value;
}
const metadataValue=key=>{
 const raw=metadata.get(key);
 return raw && Number.isFinite(Number(raw)) && Number(raw)>=0 ? Number(raw).toLocaleString(undefined,key==='abundance'?{minimumFractionDigits:2,maximumFractionDigits:2}:{maximumFractionDigits:20}) : 'Not available';
};
const leadingType=types.find(type=>Number.isFinite(type.value)&&type.value>0);
const leadingSubtype=rows.find(row=>Number.isFinite(row.abundance)&&row.abundance>0);
const typeNote=leadingType?`Most abundant: ${leadingType.name}`:types.some(type=>type.value===null)?'Abundance not available':'No types detected';
const subtypeNote=leadingSubtype?`Most abundant: ${leadingSubtype.subtype}`:rows.some(row=>row.abundance===null)?'Abundance not available':'No subtypes detected';
for(const [label,key,note] of [
 ['ARG abundance','abundance',`ARG copies: ${metadataValue('copy')} · Genome copies: ${metadataValue('genome')}`],
 ['Detected types', 'type', typeNote],
 ['Detected subtypes', 'subtype', subtypeNote]
]){
 const item=el('div');item.append(el('dt','',label),el('dd','',metadataValue(key)),el('small','',note));$('metrics').append(item);
}
renderTypes();renderRows();table();$('state').hidden=true;$('profile').hidden=false;showMetadata(profile);}catch(e){$('state').replaceChildren(el('h2','',e.message.startsWith('Accession not found')?'Accession not found':'Unable to load profile'),el('p','',e.message));const retry=el('button','outline-button','Retry');retry.onclick=()=>location.reload();$('state').append(retry);}
