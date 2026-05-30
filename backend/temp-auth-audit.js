const request = require('supertest');
const createApp = require('./src/app');

process.env.NODE_ENV = 'test';
process.env.BYPASS_AUTH = 'true';
process.env.MONGODB_URI = 'mongodb://localhost:27017';
process.env.MONGODB_DB_NAME = 'ghosttrace_test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.MCP_AUTH_SECRET = 'test-mcp-secret';

const app = createApp();

async function run() {
  const scenarios = [
    { label: 'Demo login', email: 'demo@ghosttrace.ai', password: 'demo' },
    { label: 'Admin login', email: 'admin@ghosttrace.ai', password: 'admin-password' },
    { label: 'User login', email: 'user@ghosttrace.ai', password: 'user-password' },
  ];

  for (const scenario of scenarios) {
    console.log(`--- ${scenario.label} ---`);
    try {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: scenario.email, password: scenario.password });
      console.log('login status', loginRes.status);
      console.log('login body', loginRes.body);
      const token = loginRes.body?.data?.token;
      if (!token) {
        console.log('skipping due to missing token');
        continue;
      }
      const verifyRes = await request(app)
        .post('/api/v1/auth/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: '123456' });
      console.log('mfa status', verifyRes.status);
      console.log('mfa body', verifyRes.body);
      const finalToken = verifyRes.body?.data?.token;
      if (!finalToken) {
        console.log('skipping /me due to missing final token');
        continue;
      }
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${finalToken}`);
      console.log('/me status', meRes.status);
      console.log('/me body', meRes.body);
    } catch (err) {
      console.error('error', err);
    }
    console.log('');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
