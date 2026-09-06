import {el} from './common.mjs';
export function showMetadata(profile){
 const panel=document.getElementById('metadata-panel'),status=document.getElementById('metadata-status');panel.hidden=false;
 const list=el('dl','metadata-grid');
 for(const [name,value] of profile.metadata){const item=el('div');item.append(el('dt','',name),el('dd','',value===''?'—':value));list.append(item);}
 document.getElementById('metadata-fields').replaceChildren(list);
 status.textContent=profile.metadata.length?'All fields from this profile, shown as supplied.':'This profile does not contain metadata.';
}
