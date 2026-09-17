#!/usr/bin/env python3
"""Index supplied subtype TXT.GZ files using their metadata, not their filenames."""
import argparse
import gzip
import json
import math
from pathlib import Path

COLUMNS = ['subtype', 'copy', 'abundance', 'accession', 'scientific_name',
           'biome', 'geo_loc_name', 'collection_date', 'lat_lon']


def read_subtype(path):
    text = gzip.decompress(path.read_bytes()).decode('utf-8-sig')
    sections = {}; active = None
    for line in text.splitlines():
        if not line.strip():
            continue
        if line.startswith('['):
            if line not in ('[metadata]', '[data]') or line in sections:
                raise ValueError(f'{path.name}: invalid or duplicate section')
            active = []; sections[line] = active
        elif active is None:
            raise ValueError(f'{path.name}: content before section')
        else:
            active.append(line)
    if set(sections) != {'[metadata]', '[data]'}:
        raise ValueError(f'{path.name}: expected [metadata] and [data]')
    metadata = {}
    for line in sections['[metadata]']:
        cells = line.split('\t')
        if len(cells) != 2 or cells[0] in metadata:
            raise ValueError(f'{path.name}: invalid or duplicate metadata')
        metadata[cells[0]] = cells[1]
    if not all(metadata.get(key) for key in ('type', 'subtype', 'matched', 'shown')):
        raise ValueError(f'{path.name}: missing identity/count metadata')
    if not all(metadata[key].isdecimal() for key in ('matched', 'shown')):
        raise ValueError(f'{path.name}: invalid counts')
    matched, shown = int(metadata['matched']), int(metadata['shown'])
    if shown > matched:
        raise ValueError(f'{path.name}: shown exceeds matched')
    data = sections['[data]']
    if not data or data[0].split('\t') != COLUMNS:
        raise ValueError(f'{path.name}: unexpected data columns')
    if len(data) - 1 != shown:
        raise ValueError(f'{path.name}: shown does not match row count')
    seen = set()
    for line in data[1:]:
        cells = line.split('\t')
        if len(cells) != len(COLUMNS) or cells[0] != metadata['type'] + '|' + metadata['subtype']:
            raise ValueError(f'{path.name}: row does not match metadata identity')
        if not cells[3] or cells[3] in seen:
            raise ValueError(f'{path.name}: missing or duplicate accession')
        seen.add(cells[3])
        for index, value in enumerate(cells[1:3], 1):
            if index == 2 and value.lower() == 'nan':
                continue  # Missing abundance is preserved, never converted to zero.
            if not value.strip() or not math.isfinite(float(value)) or float(value) < 0:
                raise ValueError(f'{path.name}: invalid numeric value')
    return {'type': metadata['type'], 'subtype': metadata['subtype'],
            'matched': matched, 'shown': shown, 'file': path.name}


def build(source, output=None):
    source = Path(source)
    entries = [read_subtype(path) for path in sorted(source.glob('*.txt.gz'))]
    if not entries:
        raise ValueError('No subtype TXT.GZ files found')
    keys = [(entry['type'], entry['subtype']) for entry in entries]
    if len(keys) != len(set(keys)):
        raise ValueError('Duplicate type/subtype metadata across files')
    # Store the actual filename. Never turn underscores back into slashes:
    # that substitution is ambiguous and cannot identify a resistance subtype.
    entries.sort(key=lambda entry: (entry['type'], entry['subtype']))
    output = Path(output) if output else source / 'index.json'
    output.write_text(json.dumps({'version': 2, 'entries': entries}, ensure_ascii=False,
                                separators=(',', ':')) + '\n', encoding='utf-8')
    return len(entries), sum(entry['shown'] for entry in entries)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=Path(__file__).resolve().parents[1] / 'site/data/subtypes')
    args = parser.parse_args()
    pairs, samples = build(args.input)
    print(f'Indexed {pairs:,} pairs and {samples:,} sample rows')
