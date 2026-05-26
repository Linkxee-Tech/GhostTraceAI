'use strict';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    body = null;
  }
  return { res, body };
}

async function run() {
  const frontendUrl = process.env.SMOKE_FRONTEND_URL;
  const backendUrl = process.env.SMOKE_BACKEND_URL;
  const roleUsers = [
    { label: 'demo', email: process.env.SMOKE_DEMO_EMAIL, password: process.env.SMOKE_DEMO_PASSWORD },
    { label: 'user', email: process.env.SMOKE_USER_EMAIL, password: process.env.SMOKE_USER_PASSWORD },
    { label: 'admin', email: process.env.SMOKE_ADMIN_EMAIL, password: process.env.SMOKE_ADMIN_PASSWORD },
  ].filter((u) => u.email && u.password);
  const mfaCode = process.env.SMOKE_MFA_CODE || '123456';

  if (!frontendUrl || !backendUrl) {
    throw new Error('SMOKE_FRONTEND_URL and SMOKE_BACKEND_URL are required');
  }

  const pages = ['/', '/login', '/dashboard', '/demo', '/admin'];
  for (const page of pages) {
    const r = await fetch(`${frontendUrl}${page}`);
    if (!r.ok) throw new Error(`Frontend route failed: ${page} => ${r.status}`);
  }

  const health = await fetchJson(`${backendUrl}/api/v1/health`);
  if (!health.res.ok) throw new Error(`Backend health failed: ${health.res.status}`);

  for (const account of roleUsers) {
    const login = await fetchJson(`${backendUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: account.password }),
    });
    if (!login.res.ok || !login.body?.data?.token) {
      throw new Error(`${account.label} login failed`);
    }

    const initialToken = login.body.data.token;
    const mfa = await fetchJson(`${backendUrl}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${initialToken}`,
      },
      body: JSON.stringify({ code: mfaCode }),
    });
    if (!mfa.res.ok || !mfa.body?.data?.token) {
      throw new Error(`${account.label} mfa failed`);
    }
    const token = mfa.body.data.token;

    const me = await fetchJson(`${backendUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!me.res.ok) throw new Error(`${account.label} /me failed`);

    const meRefresh = await fetchJson(`${backendUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meRefresh.res.ok) throw new Error(`${account.label} /me refresh failed`);
  }

  if (roleUsers.length) {
    const nonAdmin = roleUsers.find((r) => r.label !== 'admin');
    if (nonAdmin) {
      const login = await fetchJson(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: nonAdmin.email, password: nonAdmin.password }),
      });
      const mfa = await fetchJson(`${backendUrl}/api/v1/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${login.body.data.token}`,
        },
        body: JSON.stringify({ code: mfaCode }),
      });
      const usersEndpoint = await fetchJson(`${backendUrl}/api/v1/users`, {
        headers: { Authorization: `Bearer ${mfa.body.data.token}` },
      });
      if (usersEndpoint.res.status !== 403) {
        throw new Error(`Protected route check failed: expected 403 got ${usersEndpoint.res.status}`);
      }
    }
  }

  console.log('SMOKE_TEST_OK');
}

run().catch((err) => {
  console.error('SMOKE_TEST_FAILED', err.message);
  process.exit(1);
});

