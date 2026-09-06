# ARG Atlas: combined TXT.GZ profiles

A static GitHub Pages website with exact accession lookup, a globe with three real location categories, metadata, and ARG type/subtype distributions. No backend server or separate metadata index is needed.

## Deploy an existing repository

1. Copy this package's contents into your repository, including `.github/workflows/pages.yml` and `site/`. Use the new workflow to replace the old metadata-build workflow.
2. In GitHub Settings → Pages, select GitHub Actions as the source. Commit to `main` to deploy.
3. Upload `DRR000713.txt.gz` (and your other accession files) into R2. An unchanged `.txt` object is not the file this version requests.
4. Keep your bucket's public read URL and CORS policy configured. This package already uses `https://pub-459b51c080494f7c9867269d16d90670.r2.dev`.

The optional `scripts/deploy_github.sh OWNER/REPO --public` creates a new repository using the GitHub CLI. For an existing repository, use your normal commit/push workflow.

## File format: exactly matches the attached example

Object name: `DRR000713.txt.gz`. The decompressed UTF-8 text contains:

```text
[metadata]
project	PRJDA53873
scientific_name	food metagenome
spot_length	80.0
genome_size	3924.0517
sample	SAMD00008644
platform	ILLUMINA
published	2012-02-20 22:01:22

[abundance]
subtype	copy	abundance
aminoglycoside|aph(6)-I	0.086	0.26922324398356484
```

The example above is abbreviated. `examples/DRR000713.txt.gz` is the original complete upload, unchanged, and `examples/DRR000713.txt` is its decompressed content. All 17 metadata fields appear in source order. No `field/value` header or metadata accession field is required; an optional `field<TAB>value` header is supported. New metadata keys are automatically displayed. Metadata values, including spaces, `na`, and decimal precision, remain strings. Separate fields and values with literal tabs, not spaces. Embedded tabs/newlines inside values are not supported.

Abundance accepts the attached `subtype / copy / abundance` header and splits each `type|subtype` at the first pipe. It also accepts `type / subtype / abundance` or `type / subtype / copy / abundance`. Duplicate metadata fields, duplicate ARG pairs, missing sections, malformed numbers, and mismatched metadata accessions are rejected. Plain legacy abundance tables still parse, but the configured object suffix is `.txt.gz`.

## Loading and decompression

Search `drr000713` to request exactly `DRR000713.txt.gz`. HTTP 404 means accession not found. The browser decompresses gzip locally using DecompressionStream. It checks the gzip magic bytes before decompressing, so responses already decoded by HTTP Content-Encoding work too. Use a current Chrome, Edge, Firefox, or Safari; unsupported browsers get an explicit message.

Both received bytes and decompressed text have a 5 MB limit. Abundance tables support up to 10,000 rows. Only the last successfully loaded text is cached in sessionStorage for 60 seconds to reuse it when navigating from search to profile. No separate metadata request is made. Metadata is displayed as text, never interpreted as HTML. Download TXT includes both original sections.

Keep gzip objects as `Content-Type: application/gzip` without `Content-Encoding`; the included uploader does this. Existing objects correctly served with `Content-Encoding: gzip` also work because the loader detects the resulting bytes.

## Configuration

`site/config.json` specifies `profileBaseUrl`, `filePrefix`, and `profileExtension` (default `.txt.gz`). To use plain objects explicitly, set `profileExtension` to `.txt`. Files should have uppercase accession names with lowercase extensions. Do not include bucket credentials in this file or in website JavaScript.

## Upload profiles (optional)

Install dependencies with `python -m pip install -r requirements.txt`. Set `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET` in your local shell, following `.env.example`.

```bash
python scripts/upload_profiles.py --input /path/to/gzip-profiles --validate-only
python scripts/upload_profiles.py --input /path/to/gzip-profiles
```

Use a folder containing only one file per accession. The uploader supports `.txt.gz` and `.txt`, validates decoded content before upload, preserves the original bytes and suffix, and resumes using a local SQLite checkpoint. It does not list or delete bucket objects. `--overwrite` explicitly allows replacement. Do not point it at `examples/`, which includes both formats for the same accession.

## Preview locally

Serve the `site/` folder over HTTP with `python -m http.server 8000 --directory site`. To use the included local sample instead of R2, temporarily set `profileBaseUrl` to `./data` in `site/config.json`. Restore the R2 URL before deploying. Do not open index.html directly as a file URL.

## Verification

`node --test tests/*.test.mjs` exercises the uploaded gzip, all metadata fields, ARG parsing, exact lookup, already-decoded responses, corrupted gzip, expansion limits and invalid records. `python tests/test_upload.py` checks uploader object naming, content type, duplicate detection and resumable uploads. Live R2 access and browser visual QA have not been performed for this package.

The globe reads `site/assets/globe/locations.tsv` with columns `biome`, `lat`, `lon`, `size`. Marker area uses log2(1 + size), with visible minimum and maximum radii. Zoom supports wheel, pinch, and buttons, clamped to 1–3×. The supplied 13,521 points all have size 1. Replace the TSV to update the map; coordinates must be valid decimal degrees and sizes finite and nonnegative. Categories are host-associated (red), environmental (blue), and engineered (yellow). The website and public R2 files are publicly readable when deployed through GitHub Pages.

The type filter supports multiple selections (union of selected types); clear selection returns all subtypes. Percentages use the whole profile total. Abundance displays up to three decimal places, with values below 0.0005 shown as <0.001; downloads preserve source precision. Total copy sums all copy values, or reports Not available when any row lacks a copy value.
