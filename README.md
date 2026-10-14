# Secure CI/CD Pipeline Demo

A GitHub Actions pipeline that enforces **secrets scanning**, **dependency (SCA)**, and
**static analysis (SAST)** gates, and actually **blocks merges on critical findings** —
not just in theory, but demonstrated live in [PR #1](../../pull/1), which is intentionally
left open because it can never pass.

## Architecture

```mermaid
flowchart LR
    PR[Pull Request] --> T[Build & Test\nnode --test]
    PR --> A[Secrets Scan\ngitleaks]
    PR --> B[Dependency Scan\nTrivy SCA]
    PR --> C[Static Analysis\nSemgrep SAST]
    T --> G[Security Gate]
    A --> G
    B --> G
    C --> G
    G -->|any gate fails| X[Merge Blocked]
    G -->|all pass| M[Merge Allowed]
    A -.SARIF.-> S[(GitHub Security Tab)]
    B -.SARIF.-> S
    C -.SARIF.-> S
```

Every pull request against `main` runs four jobs in parallel. A fifth job,
`Security Gate`, depends on all four and fails if any of them didn't succeed — that
single job is the one required status check configured on branch protection, so it's
the actual thing standing between a PR and the merge button.

Its name is deliberately stable. Adding a gate means adding one entry to that job's
`needs:` list; branch protection never has to change, and there's no window where the
required check name doesn't exist.

## The gates

| Gate | Tool | What it checks | Threshold | Enforcement |
|---|---|---|---|---|
| Build & test | Node 22 `node --test` | `npm ci` installs from the lockfile, then the test suite runs | Any failing test | Non-zero exit |
| Secrets scanning | [gitleaks](https://github.com/gitleaks/gitleaks) v8.30.1 | Current working tree (`gitleaks dir`) | Any match against gitleaks' default rule set | Exits non-zero on any finding |
| Dependency scan (SCA) | [Trivy](https://github.com/aquasecurity/trivy) v0.36.0 | `package-lock.json` / filesystem | CRITICAL, HIGH — **including vulnerabilities with no fix available** | Exits non-zero at or above threshold |
| Static analysis (SAST) | [Semgrep](https://semgrep.dev/) 1.172.0 | Application source (`p/owasp-top-ten`, `p/security-audit`) | Any `ERROR`-level finding | `--error` flag exits non-zero |

Each security gate uploads its results as SARIF to GitHub's native **Security → Code
scanning** tab, so findings are visible there regardless of whether they blocked the
build.

Every scanner step carries `continue-on-error: true` and a step `id`; a separate step
then reads `steps.<id>.outcome` and exits non-zero. That split is what lets the SARIF
upload run unconditionally (`if: always()`) while the finding still fails the job —
findings get recorded *and* enforced, rather than one or the other.

## Seeded vulnerabilities

`main` is clean and passes every gate. A separate branch,
[`demo/seeded-vulnerabilities`](../../tree/demo/seeded-vulnerabilities), reintroduces one
real, targeted issue per security gate to prove the pipeline actually catches and blocks
them:

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
screenshot that goes stale. Its checks show all three security gates failing,
`Security Gate` failing as a result, and GitHub's merge button disabled because
`Security Gate` is a required status check.

Findings from every run (both the passing `main` runs and the failing PR run) are also
visible under the repo's [**Security → Code scanning**](../../security/code-scanning)
tab.

## Setup / reproduction

```bash
git clone https://github.com/kadeemj/secure-cicd-pipeline-demo.git
cd secure-cicd-pipeline-demo
npm ci
npm test

# Push to your own fork/repo, then configure branch protection:
./scripts/configure-branch-protection.sh   # or: bash scripts/configure-branch-protection.sh

# Open a PR against main and watch the gates run.
```

`scripts/configure-branch-protection.sh` uses `gh api` to require the `Security Gate`
check on `main` — see the script's comments for why it deliberately does **not** also
require PR approvals (short version: on a solo-maintained repo, `enforce_admins: true`
plus a required review count creates a self-approval deadlock; the status check alone
is the merge gate, and it already rejects direct pushes of unvetted commits too).

## Security-hardening choices

- **Least-privilege `permissions:`.** The workflow's default is `contents: read`; each
  security gate elevates to add `security-events: write` only for its own SARIF upload
  step. `Build & Test` and `Security Gate` get neither — the former only needs the
  source, the latter only reads `needs.*.result`.
- **Unified SARIF reporting.** All three scanners upload through the same
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
  actions automatically, and `.github/dependabot.yml` has it watching both the Actions
  and npm ecosystems, so this doesn't sacrifice update automation.
- **A cooldown on automated updates.** `.github/dependabot.yml` sets
  `cooldown.default-days: 7` (30 for npm majors), so Dependabot won't propose a version
  published in the last week. Automated updates otherwise pull a fresh release in within
  hours — exactly the window a compromised package needs, since most malicious releases
  are found and yanked within days. Security advisories are unaffected. This one has the
  same origin story as the SHA-pinning above: Semgrep's `dependabot-missing-cooldown`
  rule failed the SAST gate on the `dependabot.yml` added in the very commit that was
  meant to improve the repo's supply-chain posture. Two for two on the pipeline catching
  its own configuration.
- **Scanner container images pinned by digest, not tag.** `ghcr.io/gitleaks/gitleaks`
  and `semgrep/semgrep` are referenced as `@sha256:…`. A Docker tag is exactly as
  repointable as a Git tag, so pinning the actions by SHA while leaving `:v8.30.1` on
  the images would have left the same hole open on a different axis.
- **No blanket `ignore-unfixed` on the SCA gate.** The obvious way to keep a dependency
  gate quiet is `ignore-unfixed: true`, which drops every vulnerability without an
  available patch. That's a large, invisible hole: a CRITICAL with no fix is still a
  CRITICAL, and it's arguably the one you most want to know about. This pipeline blocks
  on it and routes genuinely unactionable findings through `.trivyignore`, where each
  entry has to carry a rationale and an expiry date. An exemption you have to write down
  and re-review beats one that applies to everything forever.
- **`gitleaks dir` (working tree), not `gitleaks git` (full history).** The obvious
  choice for a secrets gate is scanning full git history, but that's the wrong default
  for a per-PR merge gate: `gitleaks git` scans every commit reachable in the fetched
  repository, not just the branch under review, so a secret seeded once on
  `demo/seeded-vulnerabilities` would permanently fail the gate on `main` and every
  future PR too, forever, regardless of which branch actually introduced it. Scanning
  the current working tree matches the actual question a merge gate needs answered —
  "does the code being proposed right now contain a secret?" — and leaves full-history
  auditing as a separate, deliberate job rather than baking it into every PR check.
- **The gitleaks allowlist is scoped to one value in one file.** README.md quotes the
  seeded fake key in prose, which trips the `aws-access-token` rule. The exception uses
  `matchCondition = "AND"` so it applies only when the path is README.md *and* the
  matched secret is that exact documented value — an earlier path-only version
  suppressed every possible secret in README.md, not just the intended one. A related
  wrinkle: `.gitleaks.toml` can't spell the key out in full, or the config file itself
  becomes a match that its own README-scoped allowlist won't cover.
- **`npm ci`, not `npm install`, in CI.** `npm ci` fails on a lockfile that disagrees
  with `package.json` rather than quietly resolving a different tree — which matters
  here specifically, because a drifted tree would mean the SCA gate scanned something
  other than what gets installed.

## Known limitations

Being explicit about what this pipeline does *not* do:

- **Semgrep's rulesets are resolved at run time and are mutable.** `p/owasp-top-ten` and
  `p/security-audit` are fetched from Semgrep's registry on every run, so their contents
  can change without a commit here — the same class of mutable-dependency risk that
  SHA-pinning the actions and digest-pinning the images eliminates. Closing it properly
  means vendoring the rules into the repo and pinning them, at the cost of no longer
  picking up new rules automatically. That trade hasn't been made yet; the risk is
  recorded here rather than left implicit.
- **Fork pull requests can't upload SARIF.** GitHub never grants
  `security-events: write` to a `pull_request` run from a fork, regardless of the
  `permissions:` block. The upload steps are therefore skipped on fork PRs (with a
  `::notice::` in the log) so a permissions error can't be mistaken for a clean scan.
  Enforcement is unaffected — findings still fail the gate — but on a fork PR they are
  only visible in the job log, not the Security tab.
- **The demo branch predates the current pipeline.** `demo/seeded-vulnerabilities`
  branched before `.gitleaks.toml` and the switch to `gitleaks dir`, so its copy of the
  workflow still uses full-history scanning. It demonstrates that the gates block, which
  is its job, but it is not a current reference for how the pipeline is configured — read
  `main` for that.
- **This is not a general-purpose CI pipeline.** There's no linter, no build step, and no
  container or IaC scanning. The test suite covers the host validator and the two HTTP
  routes; it is a smoke test, not a claim of coverage.

## Future improvements

- **SBOM generation** via [`anchore/sbom-action`](https://github.com/anchore/sbom-action).
- **Container/IaC scanning** — Trivy also supports `scan-type: config` for Dockerfiles,
  Kubernetes manifests, and Terraform.
- **[OpenSSF Scorecard](https://github.com/ossf/scorecard-action)** to continuously
  benchmark the repo's supply-chain security posture.
- **Vendored, pinned Semgrep rules** to close the mutable-ruleset gap noted above.

## Security policy

See [SECURITY.md](SECURITY.md) — including which findings are intentional and therefore
out of scope.

## License

[MIT](LICENSE)
