#!/usr/bin/env bash
# Configures branch protection on `main` so the "Security Gate" status
# check (from .github/workflows/security.yml) must pass before merge.
#
# Prereqs: gh CLI authenticated with repo-admin rights.
# Usage: ./scripts/configure-branch-protection.sh [owner/repo] [branch]

set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
BRANCH="${2:-main}"
REQUIRED_CHECK="Security Gate"

echo "Configuring branch protection for ${REPO}@${BRANCH}"
echo "Required status check: ${REQUIRED_CHECK}"

# NOTE: required_pull_request_reviews is intentionally null. Setting a
# required_approving_review_count on a solo-maintained repo would create
# a deadlock: GitHub does not allow authors to approve their own PRs, and
# enforce_admins:true (below) means the owner couldn't bypass it either.
# The automated Security Gate status check is the sole merge gate here —
# it also blocks direct pushes of untested commits to `main`, since
# GitHub rejects pushes of a SHA that hasn't already recorded a passing
# required status check.
#
# `contexts` (below) is the classic/simple schema and still fully
# functional. GitHub's newer schema is `checks: [{context, app_id}]`,
# which additionally lets you scope a required check to a specific app
# (useful if two different apps could report a check with the same
# name) — not needed for a single-workflow repo like this one.
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/${REPO}/branches/${BRANCH}/protection" \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["${REQUIRED_CHECK}"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF

echo "Done. Verify at: https://github.com/${REPO}/settings/branches"
