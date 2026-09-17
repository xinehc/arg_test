#!/usr/bin/env node
import {readdir,readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {batchProfiles,parseProfile,MAX_BATCH_BYTES,MAX_PROFILE_BYTES} from '../site/assets/common.mjs';
const root=new URL('../site/data/profiles/',import.meta.url);
const files=(await readdir(root)).filter(file=>/^\d{3}\.txt\.gz$/.test(file)).sort();
let count=0,bytes=0,largest=0,rows=0,empty=0,unavailable=0;const errors=[];
for(const [index,file] of files.entries()){
 const packed=await readFile(new URL(file,root)),raw=gunzipSync(packed);bytes+=packed.length;largest=Math.max(largest,raw.length);
 if(raw.length>MAX_BATCH_BYTES)throw Error(file+': batch exceeds browser limit');
 for(const profile of batchProfiles(raw.toString('utf8'))){
  count++;
  try{
   if(!profile.id.endsWith(file.slice(0,3)))throw Error('Wrong batch suffix');
   if(Buffer.byteLength(profile.raw)>MAX_PROFILE_BYTES)throw Error('Profile exceeds browser limit');
   const parsed=parseProfile(profile.raw,profile.id);rows+=parsed.rows.length;if(!parsed.rows.length)empty++;if(parsed.total===null)unavailable++;
  }catch(e){errors.push({id:profile.id,file,error:e.message});}
 }
 if((index+1)%100===0)console.log(`Validated ${index+1}/${files.length} batches (${count.toLocaleString()} profiles)`);
}
console.log(JSON.stringify({batches:files.length,profiles:count,rows,emptyProfiles:empty,unavailableAbundanceProfiles:unavailable,compressedBytes:bytes,largestExpandedBatch:largest,errors:errors.slice(0,30),errorCount:errors.length},null,2));
if(errors.length)process.exitCode=1;
