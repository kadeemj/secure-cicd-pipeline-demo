const express = require('express');
const { execFile } = require('child_process');
const { rateLimit } = require('express-rate-limit');
const { isValidHost } = require('../lib/host');

const router = express.Router();

// Each /ping request spawns a `ping` child process, so cap how often a single
// client can hit it to keep the endpoint from being used to exhaust
// processes/CPU (denial of service). Limits are per client IP.
const pingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
});

// GET /diagnostics/ping?host=8.8.8.8
// `host` is validated against an allowlist pattern (see src/lib/host.js) and
// passed as an argv element (no shell involved), so it can't be used for
// command injection.
// (Contrast this with the seeded finding on the demo/seeded-vulnerabilities
// branch, which builds a shell string from unsanitized input.)
router.get('/ping', pingLimiter, (req, res) => {
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
