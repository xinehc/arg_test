import {el} from './common.mjs?v=static-profiles-1';
import {findSubtypes, loadSubtypeCatalog, subtypeUrl} from './subtype-data.mjs?v=type-batches-1';

export function setupSubtypeSearch(form) {
  const input = form.querySelector('input'), results = form.querySelector('[data-results]');
  const status = form.querySelector('[data-search-status]');
  let generation = 0;
  async function search(navigate = false) {
    const current = ++generation, query = input.value.trim();
    results.replaceChildren();
    if (!query) { status.textContent = ''; return; }
    status.textContent = 'Searching subtypes…';
    try {
      const entries = await loadSubtypeCatalog();
      if (current !== generation) return;
      const matches = findSubtypes(entries, query);
      const exact = matches.filter(entry => entry.subtype.toLowerCase() === query.toLowerCase() ||
        `${entry.type}|${entry.subtype}`.toLowerCase() === query.toLowerCase());
      const choices = exact.length ? exact : matches;
      if (navigate && choices.length === 1) { location.assign(subtypeUrl(choices[0])); return; }
      status.textContent = matches.length ? `${matches.length.toLocaleString()} matching type/subtype pair${matches.length === 1 ? '' : 's'}. ${matches.length > 12 ? 'Showing the first 12; refine your search.' : 'Choose a result below.'}` : 'No matching subtypes. Try another name or type|subtype.';
      for (const entry of matches.slice(0, 12)) {
        const link = el('a', 'subtype-result'); link.href = subtypeUrl(entry);
        const name = el('span', 'subtype-result-name');
        name.append(el('strong', '', entry.subtype), el('small', '', entry.type));
        link.append(name, el('span', 'subtype-result-count', entry.matched.toLocaleString() + ' accessions'));
        const item = el('li'); item.append(link); results.append(item);
      }
    } catch (error) {
      if (current === generation) status.textContent = error.message;
    }
  }
  input.addEventListener('input', () => { void search(); });
  form.addEventListener('submit', event => { event.preventDefault(); void search(true); });
  return () => { ++generation; results.replaceChildren(); status.textContent = ''; };
}

for (const form of document.querySelectorAll('[data-subtype-search]')) setupSubtypeSearch(form);
document.querySelector('#subtype-example')?.addEventListener('click', () => {
  const input = document.querySelector('#subtype-query-home');
  input.value = 'mcr-1';
  input.form.requestSubmit();
});

const modes = document.querySelectorAll('input[name="search-mode"]');
function syncSearchMode(focus = false) {
  if (!modes.length) return;
  const subtype = document.querySelector('input[name="search-mode"]:checked').value === 'subtype';
  document.querySelector('#accession-search-panel').hidden = subtype;
  document.querySelector('#subtype-search-panel').hidden = !subtype;
  // Cancel an in-flight accession lookup before it can navigate from subtype mode.
  document.querySelector('#accession').dispatchEvent(new Event('input'));
  if (focus) document.querySelector(subtype ? '#subtype-query-home' : '#accession').focus();
}
for (const mode of modes) mode.addEventListener('change', () => syncSearchMode(true));
syncSearchMode();
window.addEventListener('pageshow', () => syncSearchMode());
