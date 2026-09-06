#!/usr/bin/env bash
# Run locally after gh auth login. Creates a NEW repository and publishes site/.
set -euo pipefail
if [ "$#" -ne 2 ] || { [ "$2" != '--public' ] && [ "$2" != '--private' ]; }; then
  echo 'Usage: bash scripts/deploy_github.sh OWNER/REPO --public|--private' >&2
  exit 2
fi
repo="$1"
if ! [[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo 'Use OWNER/REPO.' >&2
  exit 2
fi
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
command -v gh >/dev/null
command -v git >/dev/null
gh auth status
if gh repo view "$repo" >/dev/null 2>&1; then
  echo 'Repository already exists. Use the manual push steps in README.md.' >&2
  exit 1
fi
if [ ! -d .git ]; then git init -b main; fi
if [ "$(git rev-parse --show-toplevel)" != "$project_root" ]; then
  echo 'Run this script from its own checkout, not inside another Git repository.' >&2
  exit 1
fi
if git remote get-url origin >/dev/null 2>&1; then
  echo 'An origin remote is already configured. Follow the manual push steps.' >&2
  exit 1
fi
# Stage only the delivered code, never arbitrary data folders or credential files.
git add .github .gitignore .env.example README.md requirements.txt r2-cors.example.json site scripts tests examples
git diff --cached --quiet || git commit -m 'Deploy static ARG Atlas with exact TXT accession lookup'
gh repo create "$repo" "$2" --description 'ARG abundance explorer: GitHub Pages and R2 TXT profiles'
git remote add origin "https://github.com/$repo.git"
gh auth setup-git
git push -u origin HEAD:main
# GitHub Pages needs an existing branch. Enable workflow publishing, then trigger it.
gh api --method POST "repos/$repo/pages" -f build_type=workflow
gh workflow run pages.yml --repo "$repo" --ref main
echo "Deployment requested. Check https://github.com/$repo/actions"
