import {gunzipSync} from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pairKey, subtypeUrl, findSubtypes, coordinates, parseSubtypeFile} from '../site/assets/subtype-data.mjs';
const root = new URL('../site/data/subtypes/', import.meta.url);
const {entries} = JSON.parse(await readFile(new URL('index.json', root), 'utf8'));

test('duplicate subtype names remain separate type/subtype pairs', () => {
  for (const [name, types] of [['bcrB', ['bacitracin', 'biocide']], ['cprA', ['bacteriocin', 'colistin']]]) {
    const matches = findSubtypes(entries, name).filter(entry => entry.subtype === name);
    assert.deepEqual(matches.map(entry => entry.type).sort(), types);
    assert.equal(new Set(matches.map(entry => entry.file)).size, 2);
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
test('all indexed subtype files preserve identity, metadata counts, and slash names', async () => {
  assert.equal(entries.length, 1123);
  assert.equal(new Set(entries.map(entry => pairKey(entry.type, entry.subtype))).size, entries.length);
  let total = 0;
  for (const entry of entries) {
    const text = gunzipSync(await readFile(new URL(encodeURIComponent(entry.file), root))).toString('utf8');
    const rows = parseSubtypeFile(text, entry);
    assert.equal(rows.length, entry.shown);
    assert.ok(entry.shown <= entry.matched);
    assert.ok(rows.every(row => row.subtype === `${entry.type}|${entry.subtype}`));
    total += rows.length;
  }
  assert.equal(total, 998644);
  for (const name of ['qacA/B', 'qacF/L', 'blaCMA/CSA', 'blaLCR/NPS']) {
    const entry = entries.find(entry => entry.subtype === name);
    assert.ok(entry);
    assert.ok(entry.file.includes(name.replaceAll('/', '_')));
    assert.equal(new URL(subtypeUrl(entry), 'https://example.org').searchParams.get('subtype'), name);
  }
});
