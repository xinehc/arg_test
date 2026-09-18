import {buildLandCells} from './globe-land.mjs?v=gap-1';
import {el} from './common.mjs?v=static-profiles-1';
import {formatAbundance} from './chart-utils.mjs?v=abundance-precision-4';
import {coordinates, loadSubtype, sampleNumber} from './subtype-data.mjs?v=type-batches-1';

const $ = id => document.getElementById(id);
let samples = [], selected, excludeNaBiomes = false;
const number = value => value.toLocaleString();
const coordinateLabel = value => String(Number(value.toFixed(2)));

function renderSamples() {
  const order = $('sample-sort').value;
  const rows = samples.map((sample, index) => ({sample, rank: index + 1}))
    .filter(({sample}) => !excludeNaBiomes || !sample.biome.trim().toLowerCase().startsWith('na:'))
    .sort((a, b) => order === 'accession' ? a.sample.accession.localeCompare(b.sample.accession) :
      sampleNumber(b.sample[order]) - sampleNumber(a.sample[order]) || a.rank - b.rank);
  const body = $('sample-rows'); body.replaceChildren();
  for (const {sample, rank} of rows) {
    const row = el('tr'), accession = el('td'), link = el('a', '', sample.accession);
    link.href = './profile.html?' + new URLSearchParams({accession: sample.accession});
    accession.append(link); row.append(el('td', '', rank), accession);
    for (const field of ['copy', 'abundance']) {
      const cell = el('td', '', Number.isFinite(Number(sample[field])) ? formatAbundance(Number(sample[field])) : 'Not available');
      cell.title = sample[field]; row.append(cell);
    }
    for (const field of ['scientific_name', 'biome', 'geo_loc_name', 'collection_date', 'lat_lon']) row.append(el('td', '', sample[field] || '—'));
    body.append(row);
  }
  $('sample-empty').hidden = rows.length > 0;
  $('sample-filter-status').textContent = `${number(rows.length)} of ${number(samples.length)} supplied samples`;
}

async function renderMap() {
  const svg = $('map-points'), ns = 'http://www.w3.org/2000/svg';
  const groups = new Map(); let geocoded = 0;
  for (const sample of samples) {
    const point = coordinates(sample.lat_lon);
    if (!point) continue;
    geocoded++;
    const key = JSON.stringify([point.lat, point.lon]);
    if (!groups.has(key)) groups.set(key, {...point, samples: []});
    groups.get(key).samples.push(sample);
  }
  $('coordinate-count').textContent = number(geocoded);
  $('map-description').textContent = `${number(geocoded)} of ${number(samples.length)} supplied samples have valid coordinates, across ${number(groups.size)} distinct locations.`;
  const defaultStatus = groups.size ? 'Hover over or focus a marker to inspect its location. Larger markers represent more supplied samples.' : 'No valid coordinates are available for these samples.';
  $('map-status').textContent = defaultStatus;
  const ctx = $('map-land').getContext('2d');
  if (ctx) {
    ctx.strokeStyle = '#e4ede7'; ctx.lineWidth = 1;
    for (let x = 0; x <= 1000; x += 1000 / 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 500); ctx.stroke(); }
    for (let y = 0; y <= 500; y += 500 / 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1000, y); ctx.stroke(); }
  }
  for (const group of groups.values()) {
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', (group.lon + 180) / 360 * 1000);
    circle.setAttribute('cy', (90 - group.lat) / 180 * 500);
    circle.setAttribute('r', Math.min(14, 2 + Math.sqrt(group.samples.length) * 1.4));
    const label = `${coordinateLabel(group.lat)}, ${coordinateLabel(group.lon)}: ${group.samples.length} supplied sample${group.samples.length === 1 ? '' : 's'} · ${[...new Set(group.samples.map(sample => sample.geo_loc_name))].join('; ')}`;
    circle.setAttribute('tabindex', '0'); circle.setAttribute('role', 'img'); circle.setAttribute('aria-label', label);
    const title = document.createElementNS(ns, 'title'); title.textContent = label; circle.append(title);
    for (const event of ['mouseenter', 'focus']) circle.addEventListener(event, () => { $('map-status').textContent = label; });
    for (const event of ['mouseleave', 'blur']) circle.addEventListener(event, () => { $('map-status').textContent = defaultStatus; });
    svg.append(circle);
  }
  if (!ctx) return;
  try {
    const response = await fetch(new URL('./globe/land-points.json', import.meta.url));
    if (!response.ok) throw Error('Land layer unavailable');
    const cells = buildLandCells(await response.json()); ctx.fillStyle = '#d2e2d8';ctx.globalAlpha=0.5
    // Project the shared land grid onto the flat map. Draw regular hexagons
    // with a small, uniform gap instead of stretching cells near the poles.
    const radius = 1000 / 240 / Math.sqrt(3) * 1;
    for (const {center: [x, y, z]} of cells) {
      const lon = Math.atan2(x, z) * 180 / Math.PI, lat = Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI;
      const cx = (lon + 180) / 360 * 1000, cy = (90 - lat) / 180 * 500;
      // Repeat boundary cells across the longitude seam.
      for (const offset of [-1000, 0, 1000]) {
        if (cx + offset < -radius || cx + offset > 1000 + radius) continue;
        ctx.beginPath();
        for (let corner = 0; corner < 6; corner++) {
          const angle = Math.PI / 6 + corner * Math.PI / 3;
          const px = cx + offset + radius * Math.cos(angle), py = cy + radius * Math.sin(angle);
          if (corner) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.fill();
      }
    }
  } catch { $('map-status').textContent = 'The background map is unavailable. Sample markers and coordinates are still shown.'; }
}

$('biome-filter').addEventListener('click', () => {
  excludeNaBiomes = !excludeNaBiomes;
  $('biome-filter').setAttribute('aria-pressed', String(excludeNaBiomes));
  renderSamples();
});
$('sample-sort').addEventListener('change', renderSamples);
$('download-samples').addEventListener('click', () => {
  const columns = ['copy', 'abundance', 'accession', 'scientific_name', 'biome', 'geo_loc_name', 'collection_date', 'lat_lon'];
  const text = [['subtype', ...columns].join('\t'), ...samples.map(sample =>
    [`${selected.type}|${selected.subtype}`, ...columns.map(column => sample[column])].join('\t'))].join('\n') + '\n';
  const url = URL.createObjectURL(new Blob([text], {type: 'text/tab-separated-values;charset=utf-8'}));
  const link = el('a'); link.href = url;
  link.download = `${selected.type}-${selected.subtype}-top-samples.tsv`.replace(/[\\/:*?"<>|]/g, '_');
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});

async function start() {
  const params = new URLSearchParams(location.search), type = params.get('type'), subtype = params.get('subtype');
  if (!type || !subtype) {
    $('subtype-state').textContent = subtype ? 'Use Back to search to choose a resistance type for this subtype.' : 'Use Back to search to find a subtype and view its top samples.';
    return;
  }
  const result = await loadSubtype(type, subtype);
  selected = result.entry; samples = result.samples;
  $('subtype-title').textContent = subtype; $('subtype-type').textContent = type;
  $('matched-count').textContent = number(selected.matched); $('sample-count').textContent = number(samples.length);
  $('samples-description').textContent = `${number(samples.length)} supplied top samples from ${number(selected.matched)} matched accessions for ${type}|${subtype}, ranked by abundance. Open an accession to view its full profile.`;
  renderSamples(); void renderMap();
  $('subtype-state').hidden = true; $('subtype-detail').hidden = false;
}
start().catch(error => {
  $('subtype-state').replaceChildren(el('h2', '', 'Unable to load subtype'), el('p', '', error.message));
  const retry = el('button', 'outline-button', 'Retry'); retry.addEventListener('click', () => location.reload()); $('subtype-state').append(retry);
});
