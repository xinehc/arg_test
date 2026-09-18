# ARG atlas

Explore antibiotic resistance genes by accession or subtype.

Run locally:

```sh
python3 -m http.server 8000 --directory site
```

Open [localhost:8000](http://localhost:8000).

Run checks: `node --test tests/*.test.mjs`.

The website and data are in `site/`. GitHub Pages deployment uses the included workflow.
