# Secure CI/CD Pipeline Demo

A GitHub Actions pipeline that enforces **secrets scanning**, **dependency (SCA)**, and
**static analysis (SAST)** gates, and actually **blocks merges on critical findings** —
not just in theory, but demonstrated live in [PR #1](../../pull/1), which is intentionally
left open because it can never pass.

## Architecture

```mermaid
flowchart LR
    PR[Pull Request] --> A[Secrets Scan\ngitleaks]
    PR --> B[Dependency Scan\nTrivy SCA]
    PR --> C[Static Analysis\nSemgrep SAST]
    A --> G[Security Gate]
    B --> G
    C --> G
    G -->|any gate fails| X[Merge Blocked]
    G -->|all pass| M[Merge Allowed]
    A -.SARIF.-> S[(GitHub Security Tab)]
    B -.SARIF.-> S
    C -.SARIF.-> S
```

Every pull request against `main` runs three gate jobs in parallel. A fourth job,
`Security Gate`, depends on all three and fails if any of them didn't succeed — that
single job is the one required status check configured on branch protection, so it's
the actual thing standing between a PR and the merge button.

## The three gates

| Gate | Tool | What it scans | Threshold | Enforcement |
|---|---|---|---|---|
| Secrets scanning | [gitleaks](https://github.com/gitleaks/gitleaks) v8.30.1 | Full git history (`git log -p` equivalent) | Any match against gitleaks' default rule set | Exits non-zero on any finding |
| Dependency scan (SCA) | [Trivy](https://github.com/aquasecurity/trivy) v0.36.0 | `package-lock.json` / filesystem | CRITICAL, HIGH | Exits non-zero at or above threshold |
| Static analysis (SAST) | [Semgrep](https://semgrep.dev/) 1.172.0 | Application source (`p/owasp-top-ten`, `p/security-audit`) | Any `ERROR`-level finding | `--error` flag exits non-zero |

Each gate job uploads its results as SARIF to GitHub's native **Security → Code scanning**
tab, so findings are visible there regardless of whether they blocked the build.

## Seeded vulnerabilities

`main` is clean and passes every gate. A separate branch,
[`demo/seeded-vulnerabilities`](../../tree/demo/seeded-vulnerabilities), reintroduces one
real, targeted issue per gate to prove the pipeline actually catches and blocks them:

| Gate | Seeded issue | File |
|---|---|---|
| Secrets scanning | Hardcoded fake AWS access key, `AKIAFAKEKEYNOTREALXX` | `src/config.js` |
| SCA | `lodash` pinned to `4.17.15` — [CVE-2020-8203](https://nvd.nist.gov/vuln/detail/CVE-2020-8203) (prototype pollution), [CVE-2021-23337](https://nvd.nist.gov/vuln/detail/CVE-2021-23337) (command injection via `_.template`) | `package.json` |
| SAST | Unsanitized input passed to `child_process.exec` (CWE-78 / OWASP A03:2021 Injection) | `src/routes/diagnostics.js` |

**A gotcha worth calling out:** the obvious choice for a fake AWS key is AWS's own
documented example, `AKIAIOSFODNN7EXAMPLE`. It doesn't work — gitleaks' default
`aws-access-token` rule explicitly allowlists any match ending in `EXAMPLE`, precisely
because that value is copy-pasted into so many tutorials that it became the canonical
"ignore this" case. The key used here keeps the same shape (`AKIA` + 16 chars from
`[A-Z2-7]`) without the `EXAMPLE` suffix, so the same detection rule actually fires.

## Live proof

[**PR #1: demo: seeded vulnerabilities (do not merge)**](../../pull/1) is open against
`main` and will stay open — it's the reproducible evidence that the gate works, not a
screenshot that goes stale. Its checks show all three gates failing, `Security Gate`
failing as a result, and GitHub's merge button disabled because `Security Gate` is a
required status check.

Findings from every run (both the passing `main` runs and the failing PR run) are also
visible under the repo's [**Security → Code scanning**](../../security/code-scanning)
tab.

## Setup / reproduction

```bash
git clone https://github.com/kadeemj/secure-cicd-pipeline-demo.git
cd secure-cicd-pipeline-demo
npm install

# Push to your own fork/repo, then configure branch protection:
./scripts/configure-branch-protection.sh   # or: bash scripts/configure-branch-protection.sh

# Open a PR against main and watch the three gates run.
```

`scripts/configure-branch-protection.sh` uses `gh api` to require the `Security Gate`
check on `main` — see the script's comments for why it deliberately does **not** also
require PR approvals (short version: on a solo-maintained repo, `enforce_admins: true`
plus a required review count creates a self-approval deadlock; the status check alone
is the merge gate, and it already rejects direct pushes of unvetted commits too).

## Security-hardening choices

- **Least-privilege `permissions:`.** The workflow's default is `contents: read`; each
  gate job elevates to add `security-events: write` only for its own SARIF upload step.
  `Security Gate` itself needs neither, since it only reads `needs.*.result`.
- **Unified SARIF reporting.** All three tools upload through the same
  `github/codeql-action/upload-sarif` step, so findings land in one place (the Security
  tab) instead of three different UIs.
- **Actions pinned to commit SHAs, not mutable tags** — e.g.
  `uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`. A tag like
  `@v7` can be silently repointed by the action owner (or an attacker who compromises
  their account), which is exactly how several real supply-chain incidents happened.
  SHA-pinning was **not** just a design choice written into this README after the fact —
  Semgrep's own `p/security-audit` ruleset caught the workflow file itself using mutable
  tags on the first run and failed the SAST gate on its own config, which is what
  prompted pinning every reference. Dependabot understands and updates SHA-pinned
  actions automatically, so this doesn't sacrifice update automation.

## Future improvements

- **SBOM generation** via [`anchore/sbom-action`](https://github.com/anchore/sbom-action).
- **Container/IaC scanning** — Trivy also supports `scan-type: config` for Dockerfiles,
  Kubernetes manifests, and Terraform.
- **[OpenSSF Scorecard](https://github.com/ossf/scorecard-action)** to continuously
  benchmark the repo's supply-chain security posture.

## License

[MIT](LICENSE)
