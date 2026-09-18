# ARG Atlas

A static website with accession search, resistance subtype search, sample metadata, and ARG distributions. All runtime data is served from `site/data/` on the same origin as the website. No storage account, credentials, backend, or external map service is required.

## Local preview

```bash
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000`. Use HTTP rather than opening HTML files directly. The default accession example is `DRR815000`; the subtype example is `colistin|mcr-1`.

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

Fields use literal tabs. The legacy `[abundance]` section name also parses. New metadata fields and original precision are retained; metadata is rendered as text. A header-only `[data]` section represents no reported resistance subtypes. An abundance value of `n/a` is unavailable, not zero: its row, affected type totals, overall abundance, and percentages display “Not available” as appropriate. Copy values and metadata remain accessible. Profile TSV downloads contain only the selected profile's data header and rows, preserving supplied numeric precision and excluding metadata and section markers.

The browser decompresses the selected batch with `DecompressionStream`. Store each batch as a single gzip stream: concatenate the plain-text records first, then gzip the result.

Received and expanded batches have a 32 MB limit; an individual selected profile has a 5 MB limit and up to 10,000 rows. Only the last selected profile is cached in sessionStorage for 60 seconds, keyed by both its batch URL and complete accession. Entire batches are not stored in sessionStorage. Responses already decoded by HTTP Content-Encoding are supported by inspecting the gzip magic bytes.

The profile loader reads `./data/profiles/` directly and uses the final three accession digits for batch selection. It supports GitHub Pages repository subpaths. The example accession and full-profile download link are defined in `site/index.html`; no configuration file is needed.

## Subtype files

`site/data/subtypes/index.tsv` lists each type/subtype pair, its counts, and its individual gzip filename:

```tsv
type	subtype	matched	shown	file
albicidin	albA	49063	1000	0000.txt.gz
```

Each gzip contains one subtype record:

```text
[metadata]
type	albicidin
subtype	albA

[data]
subtype	copy	abundance	accession	scientific_name	biome	geo_loc_name	collection_date	lat_lon
```

Search loads only the approximately 50 KB TSV index. Opening a result reads the index and fetches only its selected gzip file. Counts come from the index; the reader checks the file's exact type/subtype identity, supplied row count, columns, unique sample accessions, and numeric values. Optional counts in file metadata must also match the index. Individual subtype files have a 5 MB compressed/expanded limit; the index has a 1 MB limit.

The complete `(type, subtype)` pair remains the identity. For example, `bacitracin|bcrB` and `biocide|bcrB` remain separate. Original spelling, including `/`, is preserved in metadata and URLs; numeric filenames avoid special-character issues. There is no hardcoded type list or JSON index. Update the TSV index alongside its gzip files when changing the dataset.

The supplied files contain 1,123 pairs and 986,473 sample rows, with up to 1,000 supplied samples per pair. Full matched counts are separate from supplied counts. The table and map cover supplied samples; missing coordinates never remove table rows. Missing abundance (`nan`) displays “Not available”, sorts after measured values, and is preserved in downloads.

TSV downloads preserve the supplied values, and accession links use local profile batches.

## Verification

Use a current Node.js with built-in fetch and DecompressionStream:

```bash
node --test tests/*.test.mjs
```

Tests cover accession matching, cache isolation, gzip limits, missing values, subtype name collisions, slash-containing names, indexed subtype lookup, and every supplied subtype record. Tests validate the TSV index against all referenced gzip files.

## Deployment

Publish the contents of `site/` using any static host with sufficient capacity. The GitHub Pages workflow runs the Node tests and uploads that directory directly. For an existing GitHub repository, enable Pages → GitHub Actions and push your changes to `main`. `scripts/deploy_github.sh OWNER/REPO --public` is an optional helper for creating a new repository.

The current complete site occupies approximately 646 MB. No gzip repacking or index-generation build step is needed; the supplied TSV index is published directly.

The globe uses the bundled `site/assets/globe/locations.tsv` and land mask, with a transparent decorative canvas, random rotation, no drag/zoom controls, and reduced-motion support. The existing type filter, abundance formatting, and profile display remain in place. The website and its data are publicly readable when published.
