const express = require('express');
const { exec } = require('child_process');

const router = express.Router();

// SEEDED FINDING (demo/seeded-vulnerabilities branch only): CWE-78 /
// OWASP A03:2021 command injection. `host` is attacker-controlled and
// concatenated directly into a shell command, e.g.
// ?host=8.8.8.8;cat+/etc/passwd
// Semgrep's javascript.lang.security.detect-child-process rule (bundled
// in the p/owasp-top-ten registry ruleset) flags this pattern.
router.get('/ping', (req, res) => {
  const host = req.query.host;
  exec(`ping -c 1 ${host}`, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).send(stderr);
    }
    res.send(stdout);
  });
});

module.exports = router;
