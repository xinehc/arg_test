import {formatAbundance,matchesTypes,totalCopy} from './chart-utils.mjs';
import {showMetadata} from './metadata.mjs';
import {readConfig,normalizeAccession,loadProfile,el,number} from './common.mjs';
const $=id=>document.getElementById(id),palette=['#117663','#318ab5','#8864b4','#ce9250','#ce6387','#597eba','#539c82','#808c52'];
let profile,types,rows,selectedTypes=new Set(),query='';
const percent=(v,t)=>t?100*v/t:0;
const display=formatAbundance;
const color=type=>palette[Math.max(0,types.findIndex(t=>t.name===type))%palette.length];
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
  const value=el('div','abundance-number');value.append(el('b','',display(type.value)),el('small','',percent(type.value,profile.total).toFixed(2)+'% of profile'));
  row.append(label,bar,value);row.onclick=e=>selectTypes([type.name],e.shiftKey);rankings.append(row);
 }
}
function filterType(type,multi=false){selectTypes([type],multi);}
function renderRows(){const filtered=rows.filter(r=>matchesTypes(r.type,selectedTypes)&&r.subtype.toLowerCase().includes(query));$('subtype-count').textContent=filtered.length+' subtype'+(filtered.length===1?'':'s');$('measure-heading').textContent='ABUNDANCE / % OF PROFILE';$('clear-type').hidden=!selectedTypes.size;$('clear-type').textContent='Clear '+selectedTypes.size+' selected type'+(selectedTypes.size===1?'':'s')+' ×';const bars=$('bars');bars.replaceChildren();filtered.forEach((r,i)=>{const row=el('div','subtype-bar-row'),label=el('div','subtype-label');label.append(el('b','',r.subtype),el('small','',r.type));const bar=el('div','abundance-track'),fill=el('span');fill.style.width=percent(r.abundance,filtered[0]?.abundance||1)+'%';fill.style.background=color(r.type);bar.append(fill);const value=el('div','abundance-number');value.append(el('b','',display(r.abundance)),el('small','',percent(r.abundance,profile.total).toFixed(2)+'% of profile'));row.append(el('span','rank-number',i+1),label,bar,value);bars.append(row);});if(!filtered.length)bars.append(el('p','subtype-empty','No subtypes match these filters.'));}
function table(){const hasCopy=profile.rows.some(r=>r.copy!==undefined),table=el('table'),head=el('thead'),hr=el('tr');for(const key of ['Type','Subtype',...(hasCopy?['Copy']:[]),'Abundance'])hr.append(el('th','',key));head.append(hr);table.append(head);const body=el('tbody');for(const r of profile.rows){const tr=el('tr');for(const value of [r.type,r.subtype,...(hasCopy?[r.copy===undefined?'—':display(r.copy)]:[]),display(r.abundance)])tr.append(el('td','',value));body.append(tr);}table.append(body);$('data').append(table);}
function tab(id,focus=false){for(const name of ['distribution','data']){const active=name===id;$(name).hidden=!active;$('tab-'+name).setAttribute('aria-selected',String(active));$('tab-'+name).tabIndex=active?0:-1;}if(focus)$('tab-'+id).focus();}
for(const id of ['distribution','data']){$('tab-'+id).onclick=()=>tab(id);$('tab-'+id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();tab(e.key==='Home'?'distribution':e.key==='End'?'data':id==='data'?'distribution':'data',true);}};}
$('subtype-query').oninput=e=>{query=e.target.value.toLowerCase();renderRows();};$('clear-type').onclick=()=>{selectedTypes.clear();renderTypes();renderRows();};
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([profile.rawText],{type:'text/plain;charset=utf-8'}));const link=el('a');link.href=url;link.download=profile.id+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
try{const accession=normalizeAccession(new URLSearchParams(location.search).get('accession')||'');if(!accession)throw Error('Accession not found. Enter a complete accession on the search page.');profile=await loadProfile(await readConfig(),accession);document.title=accession+' | ARG Atlas';$('profile-title').textContent=accession;const totals=new Map();for(const r of profile.rows)totals.set(r.type,(totals.get(r.type)||0)+r.abundance);types=[...totals].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));rows=[...profile.rows].sort((a,b)=>b.abundance-a.abundance||a.subtype.localeCompare(b.subtype));const genomeEntry=profile.metadata.find(([name])=>name.toLowerCase()==='genome');const genomeValue=genomeEntry?.[1]?.trim()||'Not available';for(const [label,value] of [['Total abundance',display(profile.total)],['Total copy',totalCopy(profile.rows)===null?'Not available':display(totalCopy(profile.rows))],['Genome',genomeValue],['Detected types',profile.typeCount],['Detected subtypes',profile.subtypeCount]]){const item=el('span','',label+' ');item.append(el('b','',value));$('metrics').append(item);}renderTypes();renderRows();table();$('state').hidden=true;$('profile').hidden=false;showMetadata({...profile,metadata:profile.metadata.filter(([name])=>!['genome','univec'].includes(name.trim().toLowerCase()))});}catch(e){$('state').replaceChildren(el('h2','',e.message.startsWith('Accession not found')?'Accession not found':'Unable to load profile'),el('p','',e.message));const retry=el('button','outline-button','Retry');retry.onclick=()=>location.reload();$('state').append(retry);}
