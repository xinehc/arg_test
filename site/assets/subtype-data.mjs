import {decodeProfileResponse} from './common.mjs?v=static-profiles-1';
// Identity is always the complete, case-sensitive pair. Case folding is used
// only for discovery, never to merge records or choose between ambiguous names.
export const pairKey = (type, subtype) => JSON.stringify([type, subtype]);
export const subtypeUrl = entry => './subtype.html?' + new URLSearchParams({type: entry.type, subtype: entry.subtype});
export function findSubtypes(entries, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const score = entry => {
    const name = entry.subtype.toLowerCase(), full = `${entry.type}|${entry.subtype}`.toLowerCase();
    return name === needle || full === needle ? 0 : name.startsWith(needle) ? 1 : 2;
  };
  return entries.filter(entry => `${entry.type}|${entry.subtype}`.toLowerCase().includes(needle))
    .sort((a, b) => score(a) - score(b) || a.subtype.localeCompare(b.subtype) || a.type.localeCompare(b.type));
}
export function coordinates(value) {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 2 || parts.some(part => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(part))) return null;
  const [lat, lon] = parts.map(Number);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? {lat, lon} : null;
}
export function parseSubtypeIndex(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.shift() !== 'type\tsubtype\tmatched\tshown\tfile') throw Error('Invalid subtype index columns.');
  const pairs = new Set(), files = new Set();
  return lines.map(line => {
    const cells = line.split('\t');
    if (cells.length !== 5) throw Error('Invalid subtype index row.');
    const [type, subtype, matched, shown, file] = cells;
    if (!type.trim() || !subtype.trim()) throw Error('Missing type or subtype in index.');
    if (![matched, shown].every(value => /^\d+$/.test(value) && Number.isSafeInteger(Number(value))) || Number(shown) > Number(matched)) throw Error('Invalid subtype index counts.');
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*\.txt\.gz$/.test(file)) throw Error('Invalid subtype data filename.');
    const key = pairKey(type, subtype);
    if (pairs.has(key) || files.has(file)) throw Error('Duplicate subtype pair or filename in index.');
    pairs.add(key); files.add(file);
    return {type, subtype, matched: Number(matched), shown: Number(shown), file};
  });
}
let catalog;
export function loadSubtypeCatalog() {
  if (!catalog) catalog = (async () => {
    const response = await fetch(new URL('../data/subtypes/index.tsv', import.meta.url));
    if (!response.ok) throw Error('Subtype search is unavailable. Please try again.');
    return parseSubtypeIndex(await decodeProfileResponse(response, undefined, 1_000_000));
  })().catch(error => { catalog = null; throw error; });
  return catalog;
}
export function parseSubtypeFile(text, expected) {
  const sections = new Map(); let active;
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith('[')) {
      if (!['[metadata]', '[data]'].includes(line) || sections.has(line)) throw Error('Invalid subtype sections.');
      active = []; sections.set(line, active);
    } else {
      if (!active) throw Error('Invalid subtype content before metadata.');
      active.push(line);
    }
  }
  if (!sections.has('[metadata]') || !sections.has('[data]')) throw Error('Expected subtype [metadata] and [data].');
  const metadata = new Map();
  for (const line of sections.get('[metadata]')) {
    const cells = line.split('\t');
    if (cells.length !== 2 || metadata.has(cells[0])) throw Error('Invalid or duplicate subtype metadata.');
    metadata.set(...cells);
  }
  const type = metadata.get('type'), subtype = metadata.get('subtype');
  const count = key => {
    const value = metadata.get(key) ?? (expected?.[key] !== undefined ? String(expected[key]) : undefined);
    if (!/^\d+$/.test(value ?? '') || !Number.isSafeInteger(Number(value))) throw Error('Invalid subtype counts.');
    return Number(value);
  };
  const matched = count('matched'), shown = count('shown');
  if (!type || !subtype || shown > matched) throw Error('Invalid subtype metadata.');
  if (expected && (pairKey(type, subtype) !== pairKey(expected.type, expected.subtype) || matched !== expected.matched || shown !== expected.shown)) {
    throw Error('Sample metadata does not match the selected type and subtype.');
  }
  const lines = sections.get('[data]'), columns = ['subtype', 'copy', 'abundance', 'accession', 'scientific_name', 'biome', 'geo_loc_name', 'collection_date', 'lat_lon'];
  if (lines[0] !== columns.join('\t') || lines.length - 1 !== shown) throw Error('Invalid subtype data columns or row count.');
  const seen = new Set();
  const rows = lines.slice(1).map(line => {
    const cells = line.split('\t');
    if (cells.length !== columns.length || cells[0] !== `${type}|${subtype}`) throw Error('Sample row does not match the subtype metadata.');
    const row = Object.fromEntries(columns.map((column, index) => [column, cells[index]]));
    if (!row.accession || seen.has(row.accession)) throw Error('Duplicate or missing sample accession.');
    seen.add(row.accession);
    for (const field of ['copy', 'abundance']) if (!(field === 'abundance' && row[field].toLowerCase() === 'nan') && (!row[field].trim() || !Number.isFinite(Number(row[field])) || Number(row[field]) < 0)) throw Error('Invalid sample abundance or copy value.');
    return row;
  });
  return rows.sort((a, b) => sampleNumber(b.abundance) - sampleNumber(a.abundance) || a.accession.localeCompare(b.accession));
}
export async function loadSubtype(type, subtype) {
  const entries = await loadSubtypeCatalog();
  const entry = entries.find(candidate => pairKey(candidate.type, candidate.subtype) === pairKey(type, subtype));
  if (!entry) throw Error('This type/subtype pair was not found.');
  const response = await fetch(new URL('../data/subtypes/' + encodeURIComponent(entry.file), import.meta.url));
  if (!response.ok) throw Error('Subtype data could not be loaded. Please try again.');
  const text = await decodeProfileResponse(response);
  return {entry, samples: parseSubtypeFile(text, entry)};
}

// Missing abundance sorts after measured values; original text is retained.
export const sampleNumber = value => Number.isFinite(Number(value)) ? Number(value) : -Infinity;
