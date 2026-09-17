import {decodeProfileResponse, MAX_BATCH_BYTES} from './common.mjs?v=static-profiles-1';
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
// Static hosts cannot list directories. Only resistance type filenames live here;
// subtype names and counts always come from the supplied batch metadata.
export const SUBTYPE_TYPES = [
  "albicidin",
  "aminocoumarin",
  "aminoglycoside",
  "aminonucleoside",
  "avilamycin",
  "bacitracin",
  "bacteriocin",
  "beta-lactam",
  "bicyclomycin",
  "biocide",
  "bleomycin",
  "capuramycin",
  "colistin",
  "daptomycin",
  "defensin",
  "edeine",
  "factumycin",
  "fosfomycin",
  "fosmidomycin",
  "friulimicin",
  "fusidic_acid",
  "glycopeptide",
  "ionophore",
  "lugdunin",
  "macrolide-lincosamide-streptogramin",
  "multidrug@ABC",
  "multidrug@MATE",
  "multidrug@MFS",
  "multidrug@RND",
  "multidrug@SMR",
  "mupirocin",
  "nitroimidazole",
  "phenicol",
  "pleuromutilin",
  "quinolone",
  "rifamycin",
  "streptolydigin",
  "streptothricin",
  "sulfonamide",
  "tetracenomycin",
  "tetracycline",
  "thiostrepton",
  "trimethoprim",
  "tuberactinomycin",
  "tunicamycin"
];
export function* subtypeRecords(text) {
  const source = text.replace(/^\uFEFF/, '');
  const markers = source.matchAll(/^\[metadata\]\r?$/gm);
  let start;
  for (const marker of markers) {
    if (start === undefined && source.slice(0, marker.index).trim()) throw Error('Invalid subtype content before metadata.');
    if (start !== undefined) yield source.slice(start, marker.index);
    start = marker.index;
  }
  if (start === undefined) throw Error('Expected subtype [metadata].');
  yield source.slice(start);
}
export function subtypeBatchEntries(text, expectedType) {
  const entries = [], seen = new Set();
  for (const record of subtypeRecords(text)) {
    const dataAt = record.search(/^\[data\]\r?$/m);
    if (dataAt < 0) throw Error('Expected subtype [data].');
    const metadata = new Map();
    for (const line of record.slice(0, dataAt).split(/\r?\n/).slice(1).filter(line => line.trim())) {
      const cells = line.split('\t');
      if (cells.length !== 2 || metadata.has(cells[0])) throw Error('Invalid or duplicate subtype metadata.');
      metadata.set(...cells);
    }
    const type = metadata.get('type'), subtype = metadata.get('subtype');
    const matched = metadata.get('matched'), shown = metadata.get('shown');
    if (!type || !subtype || (expectedType !== undefined && type !== expectedType)) throw Error('Subtype batch type does not match its filename.');
    if (![matched, shown].every(value => /^\d+$/.test(value ?? '') && Number.isSafeInteger(Number(value))) || Number(shown) > Number(matched)) throw Error('Invalid subtype counts.');
    const key = pairKey(type, subtype);
    if (seen.has(key)) throw Error('Duplicate type/subtype pair in batch.');
    seen.add(key);
    entries.push({type, subtype, matched: Number(matched), shown: Number(shown)});
  }
  return entries;
}
async function fetchSubtypeBatch(type) {
  if (!SUBTYPE_TYPES.includes(type)) throw Error('This resistance type was not found.');
  const response = await fetch(new URL('../data/subtypes/' + encodeURIComponent(type + '.txt.gz'), import.meta.url));
  if (!response.ok) throw Error('Subtype data could not be loaded. Please try again.');
  return decodeProfileResponse(response, undefined, MAX_BATCH_BYTES);
}
const typeCatalogs = new Map();
export function loadSubtypeCatalog(type) {
  if (type !== undefined) {
    if (!typeCatalogs.has(type)) typeCatalogs.set(type, fetchSubtypeBatch(type)
      .then(text => subtypeBatchEntries(text, type))
      .catch(error => { typeCatalogs.delete(type); throw error; }));
    return typeCatalogs.get(type);
  }
  return loadAllSubtypeMetadata();
}
let catalog;
function loadAllSubtypeMetadata() {
  if (!catalog) catalog = (async () => {
    // Bound parallel decompression and discard sample text after reading metadata.
    let next = 0;
    const results = new Array(SUBTYPE_TYPES.length);
    await Promise.all(Array.from({length: 3}, async () => {
      while (next < SUBTYPE_TYPES.length) {
        const index = next++;
        results[index] = await loadSubtypeCatalog(SUBTYPE_TYPES[index]);
      }
    }));
    return results.flat();
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
    const value = metadata.get(key);
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
  const text = await fetchSubtypeBatch(type);
  const entries = subtypeBatchEntries(text, type);
  const index = entries.findIndex(entry => pairKey(entry.type, entry.subtype) === pairKey(type, subtype));
  if (index < 0) throw Error('This type/subtype pair was not found.');
  let position = 0;
  for (const record of subtypeRecords(text)) {
    if (position++ === index) return {entry: entries[index], samples: parseSubtypeFile(record, entries[index])};
  }
}

// Missing abundance sorts after measured values; original text is retained.
export const sampleNumber = value => Number.isFinite(Number(value)) ? Number(value) : -Infinity;
