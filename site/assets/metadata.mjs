import {el} from './common.mjs?v=static-profiles-1';
export function showMetadata(profile){
 const panel=document.getElementById('metadata-panel'),status=document.getElementById('metadata-status');panel.hidden=false;
 const list=el('dl','metadata-grid');
 const hiddenFields=new Set(['accession','project','sample','genome','copy','abundance','type','subtype']);
 const metadata=profile.metadata.filter(([name])=>!hiddenFields.has(name.trim().toLowerCase()));
 for(const [name,value] of metadata){
  const key=name.trim().toLowerCase(),raw=value.trim();
  const formatted=['base','bases','spot','spots'].includes(key)&&/^\d+$/.test(raw)
   ? raw.replace(/\B(?=(\d{3})+(?!\d))/g,',') : value;
  const item=el('div');item.append(el('dt','',name),el('dd','',formatted===''?'—':formatted));list.append(item);
 }
 document.getElementById('metadata-fields').replaceChildren(list);
 status.textContent=metadata.length?'Additional fields from this profile, shown as supplied.':'No additional metadata fields are available.';
}
