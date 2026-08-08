// Host validation, kept in its own module so it can be unit-tested directly
// without standing up an HTTP server or actually executing `ping`.

// Matches a bare IPv4 address or a simple DNS hostname — rejects anything
// that could be interpreted as a shell metacharacter.
const HOST_PATTERN = /^[a-zA-Z0-9.-]{1,253}$/;

function isValidHost(value) {
  return typeof value === 'string' && HOST_PATTERN.test(value);
}

module.exports = { HOST_PATTERN, isValidHost };
