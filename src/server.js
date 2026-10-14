const express = require('express');
const _ = require('lodash');
const diagnosticsRouter = require('./routes/diagnostics');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Per-request metadata. Both merge operands are literals — no request-derived
// keys are merged, which is what keeps this clear of the prototype-pollution
// sink pattern that `_.merge` is flagged for.
app.use((req, res, next) => {
  req.context = _.merge({}, { requestedAt: new Date().toISOString() });
  next();
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    region: config.aws.region,
    requestedAt: req.context.requestedAt,
  });
});

app.use('/diagnostics', diagnosticsRouter);

// Only bind a port when run directly (`npm start`), so the test suite can
// require the app and listen on an ephemeral port without leaking a handle.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Demo app listening on port ${PORT}`);
  });
}

module.exports = app;
