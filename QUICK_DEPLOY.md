# Quick deploy

Copy the package contents into your existing repository, including the workflow. Commit to main with GitHub Pages configured to use GitHub Actions. The site now fetches `ACCESSION.txt.gz` from the configured public R2 URL.

Upload the attached `DRR000713.txt.gz` to the bucket root to try it. This release no longer uses `metadata.tsv.gz`, `scripts/build_metadata.py`, or generated `site/metadata/`; these old files can be removed from your existing repository. The included workflow does not run the old metadata builder.

The full format, upload steps, local preview instructions, and tests are in README.md.
