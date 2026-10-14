const express = require('express');
const { execFile } = require('child_process');
const { isValidHost } = require('../lib/host');

const router = express.Router();

// GET /diagnostics/ping?host=8.8.8.8
// `host` is validated against an allowlist pattern (see src/lib/host.js) and
// passed as an argv element (no shell involved), so it can't be used for
// command injection.
// (Contrast this with the seeded finding on the demo/seeded-vulnerabilities
// branch, which builds a shell string from unsanitized input.)
router.get('/ping', (req, res) => {
  const host = req.query.host;

  if (!isValidHost(host)) {
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
