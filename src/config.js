// SEEDED FINDING (demo/seeded-vulnerabilities branch only): a hardcoded,
// non-functional, fake AWS access key, used to demonstrate the
// secrets-scanning gate.
//
// This deliberately does NOT use AWS's own documented example key
// (AKIAIOSFODNN7EXAMPLE) — gitleaks' default config explicitly allowlists
// any value ending in "EXAMPLE" (it's copy-pasted into so many tutorials
// that gitleaks suppresses it by default), so that value would NOT be
// flagged. This value keeps the same AKIA + 16-char shape so the same
// aws-access-token rule fires.
module.exports = {
  aws: {
    accessKeyId: 'AKIAFAKEKEYNOTREALXX',
    region: process.env.AWS_REGION || 'us-east-1',
  },
};
