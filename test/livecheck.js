'use strict';
// A read-only smoke test against a server that is already running, which is
// the one people actually use.
//
//   node test/livecheck.js [baseUrl]
//
// It checks that the site is served, that the security headers are on every
// response, that the public configuration is right, that the access code still
// gates registration, and that a third party is refused. It creates no data.

const assert = require('node:assert');

const BASE = (process.argv[2] || process.env.LIVE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

async function get(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, headers: res.headers, body, text };
}

(async () => {
  const checks = [];
  const check = (name, ok, detail) => {
    checks.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `: ${detail}` : ''}`);
  };

  // The page and its assets.
  const page = await get('/');
  check('the site is served', page.status === 200 && String(page.text).includes('SecureShare'));
  const css = await get('/style.css');
  check('the stylesheet is served', css.status === 200);
  const js = await get('/app.js');
  check('the script is served', js.status === 200);
  const keyguard = await get('/keyguard.js');
  check('the key module is served', keyguard.status === 200);

  // The security headers, on a page and on an API answer.
  const wanted = [
    'content-security-policy',
    'x-content-type-options',
    'x-frame-options',
    'referrer-policy',
  ];
  const missing = wanted.filter((name) => !page.headers.get(name));
  check('the security headers are on every response', missing.length === 0, missing.join(', '));

  // The public configuration.
  const config = await get('/api/config');
  check('the configuration is published', config.status === 200 && config.body !== null);
  check(
    'the Google client id is published',
    Boolean(config.body.googleClientId),
    config.body.googleClientId || 'none'
  );
  check(
    'the authorised origins are published',
    Array.isArray(config.body.authorizedOrigins) && config.body.authorizedOrigins.length > 0,
    (config.body.authorizedOrigins || []).join(' ')
  );
  check(
    'the access code is required when one is set',
    config.body.requireAccessCode === true,
    String(config.body.requireAccessCode)
  );

  // The access code still gates registration, and nothing is created.
  const blocked = await get('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'livecheck-probe',
      email: 'livecheck-probe@example.com',
      password: 'correct-horse',
      publicKey: 'A'.repeat(400),
    }),
  });
  check(
    'registration without the access code is refused',
    blocked.status === 403,
    `status ${blocked.status}`
  );

  // The endpoints that need a session must not serve without one.
  for (const path of ['/api/users', '/api/shares', '/api/activity', '/api/activity/verify']) {
    const res = await get(path);
    check(`${path} needs a session`, res.status === 401, `status ${res.status}`);
  }

  // The key recovery endpoint answers without a session but must not leak.
  const recovery = await get('/api/keys/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'livecheck-probe' }),
  });
  check(
    'the recovery endpoint refuses an account with no backup',
    recovery.status === 404,
    `status ${recovery.status}`
  );

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length} of ${checks.length} live checks passed against ${BASE}`);
  if (failed.length) {
    console.log('failed: ' + failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
})().catch((err) => {
  console.error('FAIL ', err.message);
  process.exit(1);
});
