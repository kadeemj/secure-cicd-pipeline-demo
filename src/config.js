// AWS access key is read from the environment, never hardcoded.
// (Contrast this with the seeded finding on the demo/seeded-vulnerabilities
// branch, which hardcodes a fake key to demonstrate the secrets-scanning gate.)
module.exports = {
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || null,
    region: process.env.AWS_REGION || 'us-east-1',
  },
};
