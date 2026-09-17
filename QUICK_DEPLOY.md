# Quick deploy

Preview the complete site locally:

```bash
python3 -m http.server 8000 --directory site
```

All accession and subtype data is now local to `site/data/`. No storage credentials or separate data service are required.

Before publishing, run `python3 scripts/build_subtypes.py` and `python3 scripts/check_site_size.py`. The current complete dataset exceeds GitHub Pages' documented 1 GB site limit, even after lossless gzip repacking. Reduce the published dataset or choose a static host with sufficient capacity.

Once the site fits, configure GitHub Pages to use GitHub Actions and push to `main`; the included workflow publishes `site/`. See README.md for data formats and validation commands.
