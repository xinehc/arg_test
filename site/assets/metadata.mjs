import {el} from './common.mjs';
export function showMetadata(profile){
 const panel=document.getElementById('metadata-panel'),status=document.getElementById('metadata-status');panel.hidden=false;
 const list=el('dl','metadata-grid');
 const hiddenFields=new Set(['genome','univec']);
 const metadata=profile.metadata.filter(([name])=>!hiddenFields.has(name.trim().toLowerCase()));
 for(const [name,value] of metadata){const item=el('div');item.append(el('dt','',name),el('dd','',value===''?'—':value));list.append(item);}
 document.getElementById('metadata-fields').replaceChildren(list);
 status.textContent=metadata.length?'Additional fields from this profile, shown as supplied.':'No additional metadata fields are available.';
}
