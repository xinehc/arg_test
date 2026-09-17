#!/usr/bin/env python3
"""Fail before upload when the static site exceeds the documented Pages limit."""
from pathlib import Path
import sys
site = Path(__file__).resolve().parents[1] / 'site'
size = sum(path.stat().st_size for path in site.rglob('*') if path.is_file())
print(f'Published site files: {size:,} bytes ({size / 1_000_000_000:.3f} GB)')
if size > 1_000_000_000:
    sys.exit('The complete site exceeds the documented GitHub Pages 1 GB limit. Reduce the data or use a static host with sufficient capacity.')
