import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {parseProfile,decodeProfileResponse,loadProfile,profileUrl} from '../site/assets/common.mjs';
const gz=await readFile(new URL('../examples/DRR000713.txt.gz',import.meta.url));
const txt=await readFile(new URL('../examples/DRR000713.txt',import.meta.url),'utf8');
test('uploaded gzip decodes and preserves all 17 metadata fields and seven abundance rows',async()=>{
 const text=await decodeProfileResponse(new Response(gz));assert.equal(text,txt);
 const p=parseProfile(text,'DRR000713'),m=Object.fromEntries(p.metadata);
 assert.equal(p.metadata.length,17);assert.equal(m.sample,'SAMD00008644');assert.equal(m.spot_length,'80.0');assert.equal(m.genome_size,'3924.0517');assert.equal(m.published,'2012-02-20 22:01:22');assert.equal(m.univec,'0.25');assert.equal(p.rows.length,7);assert.equal(p.typeCount,5);assert.equal(p.rows[5].type,'multidrug@RND');assert.equal(p.rows[5].subtype,'mexI');assert.equal(p.rawText,txt);
});
test('already-decompressed fetch body is not decompressed twice',async()=>assert.equal(await decodeProfileResponse(new Response(txt,{headers:{'Content-Encoding':'gzip'}})),txt));
test('damaged gzip and excessive expansion fail clearly',async()=>{
 await assert.rejects(decodeProfileResponse(new Response(gz.subarray(0,40))),/damaged/);
 await assert.rejects(decodeProfileResponse(new Response(gzipSync('a'.repeat(5_000_001)))),/5 MB/);
});
test('header optional; new metadata fields preserved; malformed records rejected',()=>{
 const p=parseProfile(txt.replace('[metadata]','[metadata]\nfield\tvalue\nnew_field\t<sample>'),'DRR000713');assert.deepEqual(p.metadata[0],['new_field','<sample>']);
 assert.throws(()=>parseProfile(txt.replace('[metadata]','[metadata]\naccession\tOTHER'),'DRR000713'),/does not match/);
 assert.throws(()=>parseProfile(txt.replace('[metadata]','[metadata]\nproject\tduplicate'),'DRR000713'),/Duplicate/);
 assert.throws(()=>parseProfile(txt.replace('[metadata]','[metadata]\nbad row'),'DRR000713'),/tab-separated/);
 assert.throws(()=>parseProfile(txt.replace('[abundance]','[wrong]'),'DRR000713'),/section/);
});
test('loader requests exact gz URL and returns metadata from the same response',async()=>{
 globalThis.document={baseURI:'https://user.github.io/repo/'};globalThis.sessionStorage={getItem:()=>null,setItem:()=>{}};
 const old=globalThis.fetch;let calls=0;try{globalThis.fetch=async url=>{calls++;assert.equal(url,'https://bucket.example/DRR000713.txt.gz');return new Response(gz);};const p=await loadProfile({profileBaseUrl:'https://bucket.example'},'drr000713');assert.equal(p.metadata.length,17);assert.equal(calls,1);}finally{globalThis.fetch=old;}
});
