const express = require('express');
const _ = require('lodash');
const diagnosticsRouter = require('./routes/diagnostics');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  req.context = _.merge({}, { requestedAt: new Date().toISOString() });
  next();
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', region: config.aws.region });
});

app.use('/diagnostics', diagnosticsRouter);

app.listen(PORT, () => {
  console.log(`Demo app listening on port ${PORT}`);
});

module.exports = app;
