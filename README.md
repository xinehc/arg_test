# ARG Atlas

A static website with accession search, resistance subtype search, sample metadata, and ARG distributions. All runtime data is served from `site/data/` on the same origin as the website. No storage account, credentials, backend, or external map service is required.

## Local preview

```bash
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000`. Use HTTP rather than opening HTML files directly. The default accession example is `DRR000713`; the subtype example is `beta-lactam|blaTEM`.

## Accession batches

`site/data/profiles/` contains 1,000 gzip batches named `000.txt.gz` through `999.txt.gz`. The last **three digits** of the complete accession select the batch: `DRR000713` uses `713.txt.gz`. Lookup then matches the complete, case-normalized accession in that batch; it never uses prefix or suffix matching to choose a profile.

Each profile starts with `[metadata]`, contains one accession field, and ends before the next `[metadata]` section:

```text
[metadata]
accession	DRR000713
project	PRJDA53873
scientific_name	food metagenome
...

[data]
subtype	copy	abundance
aminoglycoside|aph(6)-I	0.086	0.26922324398356484
```

Fields use literal tabs. The legacy `[abundance]` section name also parses. New metadata fields and original precision are retained; metadata is rendered as text. A header-only `[data]` section represents no reported resistance subtypes. An abundance value of `n/a` is unavailable, not zero: its row, affected type totals, overall abundance, and percentages display “Not available” as appropriate. Copy values and metadata remain accessible. Downloads contain only the selected profile's original text.

The browser decompresses the selected batch with `DecompressionStream`. Batches must contain a **single gzip stream**; concatenating already-compressed profile files produces multiple streams that this decoder rejects. To losslessly repack a newly supplied batch directory:

```bash
python3 scripts/prepare_profiles.py
```

This replaces each gzip file only after confirming that the repacked file decompresses to exactly the same bytes. It also checks duplicate accessions and filename suffixes. The migrated batches have already been repacked.

Received and expanded batches have a 32 MB limit; an individual selected profile has a 5 MB limit and up to 10,000 rows. Only the last selected profile is cached in sessionStorage for 60 seconds, keyed by both its batch URL and complete accession. Entire batches are not stored in sessionStorage. Responses already decoded by HTTP Content-Encoding are supported by inspecting the gzip magic bytes.

`site/config.json` uses `profileBaseUrl: "./data/profiles"` and `batchSuffixDigits: 3`. The loader requires same-origin data and supports GitHub Pages repository subpaths.

## Subtype files

`site/data/subtypes/` contains the supplied `.txt.gz` files with `[metadata]` and `[data]` sections:

```text
[metadata]
type	biocide
subtype	qacA/B
matched	1234
shown	1000

[data]
subtype	copy	abundance	accession	scientific_name	biome	geo_loc_name	collection_date	lat_lon
```

The counts above illustrate the format. The actual catalog contains 1,123 pairs and 998,644 sample rows, with up to 1,000 supplied samples per pair. Full matched counts are separate from supplied sample counts. The table and map cover only supplied samples; missing coordinates never remove rows from the table. Missing subtype abundance (`nan`) displays “Not available”, sorts after measured values, and is preserved in downloads.

The complete `(type, subtype)` pair is the identity. Names such as `bacitracin|bcrB` and `biocide|bcrB` remain separate. **Metadata preserves the original subtype spelling, including `/`.** The catalog records each file's actual basename (for example `biocide|qacA_B.txt.gz`) rather than attempting to reverse underscores into slashes. Requests URL-encode that basename. The reader verifies metadata and each data row against the selected pair.

After adding or replacing subtype files, rebuild the small search catalog:

```bash
python3 scripts/build_subtypes.py
```

This validates metadata, counts, row identities, unique sample accessions, and numeric values before writing `site/data/subtypes/index.json`. It does not modify or duplicate the source files. Search loads only the catalog; opening a subtype loads only its associated gzip file. TSV downloads retain the original metadata and numeric precision. Accession links use the local profile batches.

## Verification

No third-party packages are needed for the scripts or tests. Use a current Node.js with built-in fetch and DecompressionStream, and Python 3.9 or later.

```bash
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
node scripts/validate_profiles.mjs
python3 scripts/check_site_size.py
```

The full profile audit parses every supplied profile, checks batch assignment, duplicate accessions, size limits, and data validity. Unit tests cover exact accession matching, cache isolation, gzip bounds, empty/unavailable data, subtype name collisions, slash-containing names, coordinates, and every indexed subtype file.

## Deployment

Publish the contents of `site/` using any static host with sufficient capacity. The existing GitHub Pages workflow rebuilds the subtype index, checks the site's size, and uploads that directory. For an existing GitHub repository, enable Pages → GitHub Actions and push your changes to `main`. `scripts/deploy_github.sh OWNER/REPO --public` is an optional helper for creating a new repository.

**The current dataset is too large for GitHub Pages' documented 1 GB published-site limit.** Profile batches alone occupy 1,669,809,813 bytes after lossless repacking; subtype data and site assets add to that. The workflow's size check intentionally fails before upload. Further data reduction or a static host with a larger capacity is needed before publishing this complete dataset. Local preview and all search functions work independently of that hosting limitation.

The globe uses the bundled `site/assets/globe/locations.tsv` and land mask, with a transparent decorative canvas, random rotation, no drag/zoom controls, and reduced-motion support. The existing type filter, abundance formatting, and profile display remain in place. The website and its data are publicly readable when published.
