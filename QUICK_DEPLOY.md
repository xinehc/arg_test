# Quick deploy

Preview the complete site locally:

```bash
python3 -m http.server 8000 --directory site
```

All accession and subtype data is now local to `site/data/`. No storage credentials or separate data service are required.

Before publishing, run `node --test tests/*.test.mjs`. The supplied subtype TSV index and individual gzip files are published directly; no data build step is required. The current complete site is approximately 646 MB.

Configure GitHub Pages to use GitHub Actions and push to `main`; the included workflow validates and publishes `site/`. See README.md for data formats and validation commands.
