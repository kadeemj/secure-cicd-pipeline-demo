const express = require('express');
const { execFile } = require('child_process');

const router = express.Router();

// Matches a bare IPv4 address or a simple DNS hostname — rejects anything
// that could be interpreted as a shell metacharacter.
const HOST_PATTERN = /^[a-zA-Z0-9.-]{1,253}$/;

// GET /diagnostics/ping?host=8.8.8.8
// `host` is validated against an allowlist pattern and passed as an argv
// element (no shell involved), so it can't be used for command injection.
// (Contrast this with the seeded finding on the demo/seeded-vulnerabilities
// branch, which builds a shell string from unsanitized input.)
router.get('/ping', (req, res) => {
  const host = req.query.host;

  if (typeof host !== 'string' || !HOST_PATTERN.test(host)) {
    return res.status(400).send('Invalid host');
  }

  execFile('ping', ['-c', '1', host], (error, stdout, stderr) => {
    if (error) {
      return res.status(500).send(stderr);
    }
    res.send(stdout);
  });
});

module.exports = router;
