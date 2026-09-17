import {normalizeAccession,loadProfile} from './common.mjs?v=static-profiles-1';
const input=document.querySelector('#accession'),submit=document.querySelector('#submit'),error=document.querySelector('#error');let request;
const submitLabel=submit.querySelector('.search-button-label');
function showError(message){error.textContent=message;error.hidden=false;input.setAttribute('aria-invalid','true');}
function reset(){request?.abort();error.hidden=true;input.removeAttribute('aria-invalid');submit.disabled=false;submitLabel.textContent='Search';}
input.addEventListener('input',reset);
async function search(){reset();const accession=normalizeAccession(input.value);if(!accession){showError('Accession not found. Enter the complete accession, without a filename extension.');return;}const controller=new AbortController();request=controller;submit.disabled=true;submitLabel.textContent='Searching…';try{await loadProfile(accession,controller.signal);if(controller.signal.aborted)return;location.assign('./profile.html?accession='+encodeURIComponent(accession));}catch(e){if(e.name!=='AbortError')showError(e.message);}finally{if(request===controller){submit.disabled=false;submitLabel.textContent='Search';}}}
document.querySelector('#search-form').addEventListener('submit',e=>{e.preventDefault();void search();});
const example=document.querySelector('#example');
example.addEventListener('click',()=>{input.value=example.textContent.trim();void search();});
