import {gunzipSync} from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {pairKey, subtypeUrl, findSubtypes, coordinates, parseSubtypeFile, SUBTYPE_TYPES, subtypeBatchEntries, subtypeRecords, loadSubtype, loadSubtypeCatalog} from '../site/assets/subtype-data.mjs';
const root = new URL('../site/data/subtypes/', import.meta.url);
const batches = new Map(await Promise.all(SUBTYPE_TYPES.map(async type => [type, gunzipSync(await readFile(new URL(encodeURIComponent(type + '.txt.gz'), root))).toString('utf8')])));
const entries = [...batches].flatMap(([type, text]) => subtypeBatchEntries(text, type));

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
test('all type batches preserve identities, counts, numeric values, and slash names', async () => {
  assert.deepEqual((await readdir(root)).filter(name => name.endsWith('.txt.gz')).sort(), SUBTYPE_TYPES.map(type => type + '.txt.gz').sort());
  assert.equal(entries.length, 1123);
  assert.equal(new Set(entries.map(entry => pairKey(entry.type, entry.subtype))).size, entries.length);
  let total = 0;
  for (const [type, text] of batches) {
    const metadata = subtypeBatchEntries(text, type);
    let index = 0;
    for (const record of subtypeRecords(text)) {
      const entry = metadata[index++], rows = parseSubtypeFile(record, entry);
      assert.equal(rows.length, entry.shown);
      assert.ok(rows.every(row => row.subtype === `${entry.type}|${entry.subtype}`));
      total += rows.length;
    }
  }
  assert.equal(total, 986473);
  for (const name of ['qacA/B', 'qacF/L', 'blaCMA/CSA', 'blaLCR/NPS']) {
    const entry = entries.find(entry => entry.subtype === name);
    assert.ok(entry);
    assert.equal(new URL(subtypeUrl(entry), 'https://example.org').searchParams.get('subtype'), name);
  }
});
test('batch parser rejects duplicate pairs, wrong types and invalid metadata', () => {
  const first = [...subtypeRecords(batches.get('colistin'))][0];
  assert.throws(() => subtypeBatchEntries(first + first, 'colistin'), /Duplicate/);
  assert.throws(() => subtypeBatchEntries(first, 'biocide'), /type/);
  assert.throws(() => subtypeBatchEntries(first.replace('matched\t2529', 'matched\tbad')), /counts/);
  assert.throws(() => subtypeBatchEntries('unexpected\n' + first), /before metadata/);
  assert.deepEqual(subtypeBatchEntries('\uFEFF'+first.replaceAll('\n', '\r\n')), subtypeBatchEntries(first));
});
test('direct lookup fetches one type batch and search uses no JSON index', async () => {
  const originalFetch = globalThis.fetch, requested = [];
  globalThis.fetch = async url => {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop());
    requested.push(name);
    return new Response(await readFile(new URL(encodeURIComponent(name), root)));
  };
  try {
    const {entry, samples} = await loadSubtype('biocide', 'qacA/B');
    assert.equal(entry.subtype, 'qacA/B');
    assert.equal(samples.length, entry.shown);
    assert.deepEqual(requested, ['biocide.txt.gz']);
    await assert.rejects(loadSubtype('biocide', 'not-a-subtype'), /not found/);
    await assert.rejects(loadSubtype('../other', 'qacA/B'), /not found/);
    const catalog = await loadSubtypeCatalog();
    assert.equal(catalog.length, entries.length);
    assert.ok(requested.every(name => name.endsWith('.txt.gz')));
  } finally { globalThis.fetch = originalFetch; }
});
