# Security Policy

## Scope, and an important caveat

This repository is a **demonstration of a security-gated CI/CD pipeline**, not a
production service. The Express app under `src/` exists only to give the
scanners something real to analyse.

The `demo/seeded-vulnerabilities` branch **intentionally contains
vulnerabilities** — a hardcoded fake credential, a knowingly outdated
dependency, and a command-injection sink. They are there so the pipeline can be
observed catching and blocking them. Please do not report those as
vulnerabilities; see the README's "Seeded vulnerabilities" section for the full
list.

The fake AWS key on that branch is not, and never was, a real credential. It is
quoted in full in the README (the only file where the secrets gate allowlists
it) and deliberately not repeated here.

## Reporting a vulnerability

If you find a genuine issue — in `main`, in the pipeline definition, or a way to
bypass the merge gate — please report it privately rather than opening a public
issue:

1. Use GitHub's [private vulnerability
   reporting](https://github.com/kadeemj/secure-cicd-pipeline-demo/security/advisories/new)
   on this repository, or
2. contact the maintainer directly through their GitHub profile.

Please include what you did, what you expected, and what happened instead. A
proof of concept against a local clone is ideal.

Expect an acknowledgement within a few days. As a demo repository maintained by
one person, this is best-effort — there is no SLA and no bug bounty.

## What is in scope

- A way to merge into `main` without `Security Gate` passing.
- A gate that reports success while a finding it is supposed to catch is
  present (a false negative in the enforcement logic, not in a scanner's own
  rule set).
- Anything that could leak the repository's `GITHUB_TOKEN` or elevate a
  workflow's permissions.

## What is out of scope

- The deliberately seeded findings on `demo/seeded-vulnerabilities`.
- Findings in the upstream scanners themselves — report those to gitleaks,
  Trivy, or Semgrep.
- Missing hardening the README already documents as a known limitation or a
  future improvement.
