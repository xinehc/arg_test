# ARG Atlas — GitHub Pages + R2 TXT profiles

**This package is configured for your public R2 URL. Start with QUICK_DEPLOY.md.**

A build-free, two-page ARG abundance explorer. No Node installation, database,
search index, API server, or Cloudflare Worker is required to host it.

- `index.html`: basic collection information and exact accession search.
- `profile.html?accession=DRR000713`: type and subtype abundance distributions,
  type filtering, subtype search, relative percentages, and TSV download.
- Search requests **one exact TXT object**, never lists or downloads the bucket.
- Missing object (404): **Accession not found**. Network, CORS, and permission
  problems produce a separate error rather than a false "not found" result.
- A one-profile, 60-second browser cache avoids fetching it again immediately
  after search. It is optional and not a database.

## Your bucket

Bucket name: **argmap**

S3 API endpoint (for authenticated local scripts only):

    https://47bd4c09e8ac6457ef317324342bb09a.r2.cloudflarestorage.com

The `/argmap` URL you supplied is an S3 API address. It is **not the public read
URL for the website**. Do not put API keys in HTML, JavaScript, GitHub Pages, or
`site/config.json`.

## Quick deployment — your files are already uploaded

### 1. Get a public read URL

In Cloudflare: **R2 → argmap → Settings**.

- For testing, enable **Public Development URL** and copy its `https://pub-….r2.dev`
  URL. Cloudflare rate-limits this endpoint and recommends it only for development.
- For production, add a **Custom Domain**, such as `https://data.your-domain.org`.
  The domain must be connected to your Cloudflare account.

This setup is for publicly readable data. Enabling public access makes objects
readable by anyone with their URL. The scripts do not enable public access for you.

Verify that opening `YOUR_PUBLIC_URL/DRR000713.txt` displays or downloads that
file. Do **not** append `/argmap` to the public URL unless it is literally a
folder in your object names. The public domain already points to that bucket.

### 2. Set the website data URL

From the extracted project folder, run:

```bash
python3 scripts/configure_site.py --public-url https://YOUR_PUBLIC_BUCKET_HOST
```

Or edit `site/config.json` directly:

```json
{
  "profileBaseUrl": "https://YOUR_PUBLIC_BUCKET_HOST",
  "filePrefix": "",
  "exampleAccession": "DRR000713",
  "collectionLabel": "ARGmap accession collection",
  "profileCount": null,
  "typeCount": null,
  "subtypeCount": null,
  "statsNote": "Exact accession lookup"
}
```

If the key in R2 is `profiles/DRR000713.txt`, set `filePrefix` to `profiles`, or
pass `--prefix profiles` to the configuration script. For objects at the bucket
root, leave it empty. Counts are optional and supplied by you; the website does
not scan a million files to calculate collection totals. For example:

```bash
python3 scripts/configure_site.py --public-url https://YOUR_PUBLIC_BUCKET_HOST --count 1000000
```

**This package already uses your public R2 URL:**
`https://pub-459b51c080494f7c9867269d16d90670.r2.dev`.
It requests TXT files from the bucket root. There is no silent fallback to the
bundled local example if an R2 request fails. The local file is only a test fixture.

### 3. Allow your GitHub website to read the bucket (CORS)

In **R2 → argmap → Settings → CORS policy**, paste `r2-cors.example.json` after
replacing `YOUR_GITHUB_USERNAME`. Use the origin only:

    https://YOUR_GITHUB_USERNAME.github.io

Do not include `/REPOSITORY` in the CORS origin. If the website uses its own
custom domain, use that origin instead. Add `http://localhost:8000` as another
origin if you need to test against R2 locally. GET/HEAD are sufficient; browsers
never need permission to upload files.

There is also an optional authenticated helper:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
# Set the environment variables described in the optional-upload section below.
python3 scripts/configure_cors.py --origin https://YOUR_GITHUB_USERNAME.github.io
```

### 4. Upload the code to GitHub and enable Pages

**Browser method, no local Git required:**

1. Create a GitHub repository, e.g. `argmap`.
2. Put this package's **contents** at the repository root, including the hidden
   `.github/workflows/pages.yml` directory. Do not upload the ZIP itself or put
   everything in another wrapper folder. A GitHub web upload can omit dotfiles;
   verify that the workflow appears in the repository afterward.
3. Go to **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Go to **Actions → Deploy ARG Atlas to GitHub Pages → Run workflow**, using `main`.
5. The workflow publishes only `site/`. Its deployment output shows the website URL.

**Command-line method:** install Git and the GitHub CLI (`gh`), configure your Git
name/email if necessary, then:

```bash
gh auth login
bash scripts/deploy_github.sh YOUR_GITHUB_USERNAME/argmap --public
```

This creates a **new** public repository and requests Pages deployment. Use
`--private` only if your GitHub plan supports Pages from private repositories;
a private repository does not itself make a Pages website or R2 data private.
The helper refuses to replace an existing repository or remote. If the initial
push workflow ran before Pages was enabled, the helper triggers it again afterward.
You can also rerun it from Actions. Organization policies can require admin setup.

For an **existing empty repository**, use Git directly from this folder:

```bash
git init -b main
git add .
git commit -m "Add static ARG Atlas"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/argmap.git
git push -u origin main
```

Then enable Pages with GitHub Actions as described above. Do not force-push over
an existing project. Later updates to `site/` on `main` deploy automatically.

## File format and naming

Objects must be named **UPPERCASE_ACCESSION.txt**, for example `DRR000713.txt`.
R2 object names are case-sensitive. User input is trimmed and uppercased; partial
IDs, filename extensions, and gene names do not expand into accession matches.
Only letters, digits, underscore, and hyphen are accepted in accessions.

Supported UTF-8, tab-separated TXT headers:

```text
subtype\tcopy\tabundance
aminoglycoside|aph(6)-I\t0.086\t0.26922324398356484
```

Here `\t` means an actual TAB character; see `examples/DRR000713.txt` for a real file.
The first `|` splits type from subtype. `multidrug@RND`, `bla*`, parentheses, and
other subtype characters are preserved. `copy` is retained separately; charts use
`abundance`. These normalized headers are also supported:

- `type`, `subtype`, `abundance`
- `type`, `subtype`, `copy`, `abundance`

Blank lines, Windows line endings, UTF-8 BOM, and scientific notation are accepted.
Invalid/nonfinite/negative numbers and duplicate type/subtype pairs are rejected.
The UI supports up to 10,000 rows per profile. Files are tab-delimited; arbitrary
space-delimited text and CSV quoting are not supported. Percentages are computed
from the selected profile's total, even when filtering its subtypes.

If by "plain.txt" you mean **every object is literally named `plain.txt` inside
accession folders**, the current key pattern must be changed to
`ACCESSION/plain.txt`. The supplied code assumes the earlier example naming,
`DRR000713.txt`.

## Optional: upload new TXT profiles later

**Skip this section if all files are already in argmap.**

The uploader sends original TXT bytes; no JSON conversion is needed. It uses a
local SQLite checkpoint only for upload progress, not for the deployed website.
It walks input folders incrementally, validates all files before remote writes,
and rejects duplicate accession filenames in separate folders. It holds only a
bounded number of uploads in memory. There is no recursive remote bucket scan.

Python 3.10+ is required. Install the optional dependencies in a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

Create bucket-scoped R2 access keys locally. Set these environment variables in
your terminal (the endpoint and bucket are already the script defaults):

```bash
export R2_ENDPOINT_URL=https://47bd4c09e8ac6457ef317324342bb09a.r2.cloudflarestorage.com
export R2_BUCKET=argmap
export AWS_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
```

`.env.example` documents them; scripts do not automatically load `.env` files.
Do not commit actual credentials. The GitHub Pages workflow needs no R2 secrets.

```bash
# Local validation only; no credentials or network required.
python3 scripts/upload_profiles.py --input /path/to/txt-profiles --validate-only

# Upload; rerun the same command to resume using .state/uploads.sqlite.
python3 scripts/upload_profiles.py --input /path/to/txt-profiles --workers 8
```

Use `--prefix profiles` if your site config uses that folder. Existing remote
objects are not overwritten by default. Use `--overwrite` only for intended
updates. Unchanged locally checkpointed files are skipped. Keep the checkpoint
outside the input folder and preserve it across runs. The checkpoint assumes
completed objects have not subsequently been removed or altered remotely; remove
or use a new checkpoint if you must reconcile a remotely changed bucket.

The uploader uses bounded parallelism (default 8, maximum 32), SDK retries, and
SHA-256 metadata to recover a completed upload whose local acknowledgment was
lost. No remote files are deleted. Uploaded files receive a five-minute cache
lifetime; allow that time for changed profiles to appear. For uploads from other
tools, configure their cache headers or purge your CDN cache when updating data.

At one million profiles, validate a representative subset first and monitor R2
storage/request usage. No million-object throughput benchmark was run here.

## Local preview and checks

The website needs HTTP rather than double-clicking `index.html` (browsers restrict
fetch from `file://`). This temporary preview server is only for development:

```bash
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000` in your browser. No development server is needed once
GitHub Pages hosts the site.

Optional checks, using Node 20+ and Python 3.10+:

```bash
node --test tests/profile.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

Checked locally: TXT parsing, native field preservation, exact URL construction,
GitHub repository subpaths, 404 vs network/permission errors, upload checkpoints,
and duplicate accession rejection. R2 upload and GitHub deployment require your
accounts and have not been executed for you. The existing ChatGPT-hosted site is
unchanged by this standalone export.

## Files

| File | Purpose |
| --- | --- |
| `site/index.html` | Accession search page |
| `site/profile.html` | Dedicated profile display |
| `site/assets/common.mjs` | TXT parser and exact object retrieval |
| `site/assets/profile.mjs` | Type/subtype charts, filtering and downloads |
| `site/config.json` | Public read URL and collection information |
| `.github/workflows/pages.yml` | Automatic static deployment |
| `scripts/configure_site.py` | Set public bucket URL |
| `scripts/configure_cors.py` | Add bucket read-origin rule |
| `scripts/upload_profiles.py` | Optional resumable TXT uploader |
| `scripts/deploy_github.sh` | Create a new repository and enable Pages |

## Official references

- https://developers.cloudflare.com/r2/buckets/public-buckets/
- https://developers.cloudflare.com/r2/buckets/cors/
- https://developers.cloudflare.com/r2/examples/aws/boto3/
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
# arg_test
