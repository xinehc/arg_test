#!/usr/bin/env python3
"""Losslessly repack concatenated gzip members for browser DecompressionStream."""
import argparse
from concurrent.futures import ProcessPoolExecutor
import gzip
import hashlib
from pathlib import Path
import re


def repack(path):
    original = path.read_bytes()
    raw = gzip.decompress(original)
    if len(raw) > 32_000_000:
        raise ValueError(f'{path.name}: expanded batch exceeds 32 MB')
    ids = re.findall(rb'^accession\t([^\r\n]+)', raw, re.M)
    suffix = path.name.removesuffix('.txt.gz').encode()
    if not ids or len(ids) != len(set(ids)) or any(not value.endswith(suffix) for value in ids):
        raise ValueError(f'{path.name}: missing, duplicate, or incorrectly grouped accessions')
    packed = gzip.compress(raw, compresslevel=6, mtime=0)
    if hashlib.sha256(gzip.decompress(packed)).digest() != hashlib.sha256(raw).digest():
        raise ValueError(f'{path.name}: lossless verification failed')
    temporary = path.with_suffix('.gz.tmp')
    temporary.write_bytes(packed)
    temporary.replace(path)
    return len(ids), len(original), len(packed), len(raw)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=Path(__file__).resolve().parents[1] / 'site/data/profiles')
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    paths = sorted(args.input.glob('*.txt.gz'))
    if not paths:
        parser.error('No profile batches found')
    profiles = original = packed = largest = 0
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        for index, (count, before, after, expanded) in enumerate(pool.map(repack, paths), 1):
            profiles += count; original += before; packed += after; largest = max(largest, expanded)
            if index % 100 == 0:
                print(f'Repacked and verified {index}/{len(paths)} batches', flush=True)
    print(f'{profiles:,} profiles; {original:,} -> {packed:,} compressed bytes; largest expanded batch {largest:,} bytes')
