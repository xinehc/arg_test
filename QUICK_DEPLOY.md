# Deploy ARGmap with your public R2 bucket

The code is already configured to retrieve:

https://pub-459b51c080494f7c9867269d16d90670.r2.dev/DRR000713.txt

Typing DRR000713 requests that file. Other accessions request their exact
UPPERCASE_ACCESSION.txt object. No bucket listing, database, or server is needed.

## 1. Check the file name

Open the link above in your browser. It should display or download your TXT file.
The object must be at the bucket root and named exactly `DRR000713.txt`.
If it lives in `profiles/DRR000713.txt`, set `filePrefix` to `profiles` in
`site/config.json`. Do not add `/argmap` to the public URL: the domain already
points to that bucket.

## 2. Configure CORS in Cloudflare

Go to **R2 → argmap → Settings → CORS policy** and paste the contents of
`r2-cors.example.json`, replacing YOUR_GITHUB_USERNAME with your GitHub username.

For username `alice`, use `https://alice.github.io` as the allowed origin, even
if the website lives under `/argmap/`. Only GET and HEAD are allowed; no upload
credentials are exposed. If the CORS policy already contains other rules, retain
them and add this rule. The optional configure_cors.py helper merges a rule.

## 3. Put the package contents into GitHub

Create a repository named `argmap`, with `main` as the default branch. Upload
this extracted folder's contents at the repository root, including the hidden
`.github/workflows/pages.yml` file. Do not upload only the ZIP or an extra outer
folder. Never upload your million profiles into this code repository.

For a NEW repository using Git and the GitHub CLI:

```bash
gh auth login
bash scripts/deploy_github.sh YOUR_GITHUB_USERNAME/argmap --public
```

The script creates the repository, pushes the code, enables Pages workflow
publishing, and triggers deployment. It needs your Git name/email configured.
It does not modify your bucket or upload profile files.

## 4. Enable GitHub Pages (when using browser upload)

- Repository **Settings → Pages → Source → GitHub Actions**.
- **Actions → Deploy ARG Atlas to GitHub Pages → Run workflow → main**.
- Wait for the job to succeed. GitHub shows the published URL in Settings → Pages.
- Enter DRR000713 and select **Open profile**.

The URL will normally be `https://YOUR_GITHUB_USERNAME.github.io/argmap/`.
Further pushes that modify `site/` on main deploy automatically.

## What is already set

- Public read URL: your `pub-459b51c080494f7c9867269d16d90670.r2.dev` domain.
- Format: plain UTF-8 TXT with tab-separated columns.
- Search: exact accession only, ignoring user-input case and outer spaces.
- Missing object: "Accession not found" on an HTTP 404.
- Connection/CORS errors: a separate retry/configuration message.
- Type and subtype charts, copy preservation, and TSV downloads are included.

No R2 API key is needed for the deployed website. You do not need to run the
optional upload scripts if your files are already in argmap.

The supplied R2 domain could not be checked from the preparation environment, so
file availability and CORS must be verified in your browser. The code's parser,
URL construction, and error handling were checked locally. No GitHub deployment
was performed because a destination GitHub account/repository was not provided.

Cloudflare describes r2.dev as rate-limited development access. Use it to try the
site; a custom data domain is the supported path for production traffic.
