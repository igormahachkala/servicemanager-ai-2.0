#!/usr/bin/env bash
# SMA-017.1 — GitHub settings (requires: gh auth login)
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-igormahachkala/servicemanager-ai-2.0}"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"

echo "==> Repository: ${REPO}"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI not found. Install: https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh not authenticated. Run: gh auth login"
  exit 1
fi

echo "==> 1. Make repository private"
gh repo edit "${REPO}" --visibility private --accept-visibility-change-consequences

echo "==> 2. Enable security features (repo settings)"
gh api -X PATCH "repos/${REPO}" \
  -f security_and_analysis[secret_scanning]=enabled \
  -f security_and_analysis[secret_scanning_push_protection]=enabled \
  2>/dev/null || echo "WARN: secret scanning API may require GitHub Advanced Security or org admin."

echo "==> 3. Branch protection on ${DEFAULT_BRANCH}"
gh api -X PUT "repos/${REPO}/branches/${DEFAULT_BRANCH}/protection" \
  -f required_status_checks[strict]=true \
  -f required_status_checks[checks][]='Backend' \
  -f required_status_checks[checks][]='Web' \
  -f enforce_admins=true \
  -f required_pull_request_reviews[required_approving_review_count]=1 \
  -f required_pull_request_reviews[dismiss_stale_reviews]=true \
  -f restrictions=null \
  -f allow_force_pushes=false \
  -f allow_deletions=false \
  2>/dev/null || echo "WARN: branch protection failed — set manually in GitHub UI."

echo "==> Done. Verify in GitHub: Settings → Security → Secret scanning / Push protection"
echo "==> Enforce 2FA: Organization Settings → Authentication security (org owners only)"
