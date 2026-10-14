const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/server');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET / returns ok with the configured region', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.region, process.env.AWS_REGION || 'us-east-1');
  // Set by the request-context middleware.
  assert.equal(typeof body.requestedAt, 'string');
  assert.ok(!Number.isNaN(Date.parse(body.requestedAt)));
});

test('GET /diagnostics/ping rejects a missing host', async () => {
  const res = await fetch(`${baseUrl}/diagnostics/ping`);
  assert.equal(res.status, 400);
  assert.equal(await res.text(), 'Invalid host');
});

test('GET /diagnostics/ping rejects a command-injection payload', async () => {
  const payload = encodeURIComponent('8.8.8.8; cat /etc/passwd');
  const res = await fetch(`${baseUrl}/diagnostics/ping?host=${payload}`);
  assert.equal(res.status, 400);
  assert.equal(await res.text(), 'Invalid host');
});

test('GET /diagnostics/ping rejects a repeated host parameter', async () => {
  const res = await fetch(`${baseUrl}/diagnostics/ping?host=8.8.8.8&host=evil.example.com`);
  assert.equal(res.status, 400);
});

test('GET /unknown returns 404', async () => {
  const res = await fetch(`${baseUrl}/nope`);
  assert.equal(res.status, 404);
});
