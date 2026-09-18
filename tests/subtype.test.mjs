import {gunzipSync} from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {pairKey, subtypeUrl, findSubtypes, coordinates, parseSubtypeFile, parseSubtypeIndex, loadSubtype, loadSubtypeCatalog} from '../site/assets/subtype-data.mjs';
const root = new URL('../site/data/subtypes/', import.meta.url);
const indexText = await readFile(new URL('index.tsv', root), 'utf8');
const entries = parseSubtypeIndex(indexText);

test('duplicate subtype names remain separate type/subtype pairs', () => {
  for (const [name, types] of [['bcrB', ['bacitracin', 'biocide']], ['cprA', ['bacteriocin', 'colistin']]]) {
    const matches = findSubtypes(entries, name).filter(entry => entry.subtype === name);
    assert.deepEqual(matches.map(entry => entry.type).sort(), types);
    assert.equal(new Set(matches.map(entry => entry.type)).size, 2);
    assert.equal(new Set(matches.map(subtypeUrl)).size, 2);
    for (const entry of matches) assert.deepEqual(findSubtypes(entries, `${entry.type}|${name}`), [entry]);
  }
});
test('search is literal and case-insensitive, while identity is exact', () => {
  assert.ok(findSubtypes(entries, ' BLATEM ').some(entry => entry.subtype === 'blaTEM'));
  for (const name of ["aac(2')*", 'tet(C)']) assert.ok(findSubtypes(entries, name).some(entry => entry.subtype === name));
  assert.deepEqual(findSubtypes(entries, 'does-not-exist'), []);
  assert.deepEqual(findSubtypes(entries, ' '), []);
  assert.notEqual(pairKey('a|b', 'c'), pairKey('a', 'b|c'));
  assert.notEqual(pairKey('a', 'gene'), pairKey('a', 'Gene'));
});
test('deep links preserve punctuation and the complete pair', () => {
  const entry = {type: 'multidrug@RND', subtype: "a+b & c/|aac(2')*"};
  const url = new URL(subtypeUrl(entry), 'https://example.org/project/');
  assert.equal(url.pathname, '/project/subtype.html');
  assert.equal(url.searchParams.get('type'), entry.type);
  assert.equal(url.searchParams.get('subtype'), entry.subtype);
});
test('coordinates include zero and boundaries but reject missing or invalid values', () => {
  assert.deepEqual(coordinates('0 0'), {lat: 0, lon: 0});
  assert.deepEqual(coordinates(' -90 180 '), {lat: -90, lon: 180});
  for (const value of ['na', '', '91 0', '0 -181', '0', 'Infinity 0', '1 2 3', '0x10 0']) assert.equal(coordinates(value), null);
});
test('all indexed files preserve identities, counts, numeric values, and slash names', async () => {
  assert.deepEqual((await readdir(root)).filter(name => name.endsWith('.txt.gz')).sort(), entries.map(entry => entry.file).sort());
  assert.equal(entries.length, 1123);
  assert.equal(new Set(entries.map(entry => pairKey(entry.type, entry.subtype))).size, entries.length);
  let total = 0;
  for (const entry of entries) {
    const text = gunzipSync(await readFile(new URL(entry.file, root))).toString('utf8');
    const rows = parseSubtypeFile(text, entry);
    assert.equal(rows.length, entry.shown);
    assert.ok(rows.every(row => row.subtype === `${entry.type}|${entry.subtype}`));
    total += rows.length;
  }
  assert.equal(total, 986473);
  for (const name of ['qacA/B', 'qacF/L', 'blaCMA/CSA', 'blaLCR/NPS']) {
    const entry = entries.find(entry => entry.subtype === name);
    assert.ok(entry);
    assert.equal(new URL(subtypeUrl(entry), 'https://example.org').searchParams.get('subtype'), name);
  }
});
test('TSV index rejects unsafe filenames, duplicate identities and invalid counts', () => {
  const header='type\tsubtype\tmatched\tshown\tfile\n', row='A\tgene/x\t2\t1\t0000.txt.gz\n';
  assert.throws(() => parseSubtypeIndex(header+row+row), /Duplicate/);
  for (const file of ['../0000.txt.gz','https://other/0000.txt.gz','a/b.txt.gz','a\\b.txt.gz']) {
    assert.throws(() => parseSubtypeIndex(header+row.replace('0000.txt.gz',file)), /filename/);
  }
  assert.throws(() => parseSubtypeIndex(header+row.replace('\t2\t1\t','\t0\t1\t')), /counts/);
  assert.deepEqual(parseSubtypeIndex('\uFEFF'+(header+row).replaceAll('\n','\r\n')),parseSubtypeIndex(header+row));
});
test('selected file must match index identity and row count', async () => {
  const entry=entries[0], text=gunzipSync(await readFile(new URL(entry.file,root))).toString('utf8');
  assert.throws(()=>parseSubtypeFile(text,{...entry,subtype:'other'}),/does not match/);
  assert.throws(()=>parseSubtypeFile(text,{...entry,shown:entry.shown-1}),/row count/);
});
test('search downloads only TSV; lookup downloads only the selected gzip', async () => {
  const originalFetch = globalThis.fetch, requested = [];
  globalThis.fetch = async url => {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop());
    requested.push(name);
    return new Response(await readFile(new URL(encodeURIComponent(name), root)));
  };
  try {
    const catalog = await loadSubtypeCatalog();
    assert.equal(catalog.length, entries.length);
    assert.deepEqual(requested,['index.tsv']);
    const expected=entries.find(entry=>entry.type==='biocide'&&entry.subtype==='qacA/B');
    const {entry, samples} = await loadSubtype('biocide', 'qacA/B');
    assert.deepEqual(entry,expected);
    assert.equal(samples.length, entry.shown);
    assert.deepEqual(requested,['index.tsv',expected.file]);
    await assert.rejects(loadSubtype('biocide', 'not-a-subtype'), /not found/);
    await assert.rejects(loadSubtype('../other', 'qacA/B'), /not found/);
    assert.equal(requested.length,2);
  } finally { globalThis.fetch = originalFetch; }
});
