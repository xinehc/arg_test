import {setSearchBusy} from './search-state.mjs';
import {normalizeAccession,loadProfile} from './common.mjs?v=static-profiles-1';
const input=document.querySelector('#accession'),submit=document.querySelector('#submit'),error=document.querySelector('#error');let request;
function showError(message){error.textContent=message;error.hidden=false;input.setAttribute('aria-invalid','true');}
function reset(){request?.abort();error.hidden=true;input.removeAttribute('aria-invalid');setSearchBusy(submit,false);}
input.addEventListener('input',reset);
async function search(){reset();const accession=normalizeAccession(input.value);if(!accession||!/\d{3}$/.test(accession)){showError('Invalid accession. Enter a complete accession, such as DRR815000.');return;}const controller=new AbortController();request=controller;setSearchBusy(submit,true);try{await loadProfile(accession,controller.signal);if(controller.signal.aborted)return;location.assign('./profile.html?accession='+encodeURIComponent(accession));}catch(e){if(e.name!=='AbortError')showError(e.message.startsWith('Accession not found')?'No matching accession. Check the accession and try again.':e.message);}finally{if(request===controller){setSearchBusy(submit,false);}}}
document.querySelector('#search-form').addEventListener('submit',e=>{e.preventDefault();void search();});
const example=document.querySelector('#example');
example.addEventListener('click',()=>{input.value=example.textContent.trim();void search();});

window.addEventListener('pageshow',reset);
