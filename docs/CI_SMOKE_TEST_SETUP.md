# CI Smoke Test Configuration Guide

## Overview

The GhostTrace AI deployment pipeline includes an automated smoke test (`scripts/smoke-deploy.js`) that runs after deployment to Cloud Run. This test verifies that the deployed frontend and backend are functioning correctly.

## What the Smoke Test Does

1. **Frontend Route Testing**: Verifies core frontend routes are accessible
   - `/` (landing page)
   - `/login` (login page)
   - `/dashboard` (user dashboard)
   - `/demo` (demo dashboard)
   - `/admin` (admin dashboard)

2. **Backend Health Check**: Validates backend is running and database is connected

3. **Authentication Flows**: Tests login and MFA verification for multiple user roles:
   - Demo user account
   - Regular user account
   - Admin user account

4. **Authorization Checks**: Validates role-based access control (RBAC)
   - Ensures non-admin users cannot access protected routes

## Required GitHub Secrets

To enable the smoke test in your CI/CD pipeline, configure the following secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

### Deployment Secrets
- `GCP_PROJECT_ID`: Your Google Cloud project ID
- `GCP_SA_KEY`: Service account JSON key with Cloud Run and GCR permissions
- `REGION`: Cloud Run region (e.g., `us-central1`)

### Smoke Test User Credentials

Create test user accounts in your MongoDB instance and configure these secrets:

#### Demo User
- `SMOKE_DEMO_EMAIL`: Email address for demo test account (e.g., `demo@ghosttrace.ai`)
- `SMOKE_DEMO_PASSWORD`: Password for demo account

#### Regular User
- `SMOKE_USER_EMAIL`: Email address for regular user test account (e.g., `user@ghosttrace.ai`)
- `SMOKE_USER_PASSWORD`: Password for regular user account

#### Admin User
- `SMOKE_ADMIN_EMAIL`: Email address for admin test account (e.g., `admin@ghosttrace.ai`)
- `SMOKE_ADMIN_PASSWORD`: Password for admin account

### MFA Secret
- `SMOKE_MFA_CODE`: Fixed MFA code for testing (e.g., `123456`)
  - You may need to modify your MFA validation during testing to accept a fixed code, or use a TOTP library that generates predictable codes

## Setup Steps

### 1. Create Test User Accounts

Before enabling the smoke test, you need to set up test user accounts in your production MongoDB instance:

```javascript
// Use the seed.js script as a template, or run these commands in your MongoDB CLI:

db.users.insertOne({
  email: "demo@ghosttrace.ai",
  password: "<hashed-password>",  // Use bcrypt to hash
  name: "Demo User",
  role: "demo",
  createdAt: new Date(),
  mfaEnabled: true,
  mfaSecret: "<totp-secret-or-fixed-code>"  // For testing
});

db.users.insertOne({
  email: "user@ghosttrace.ai",
  password: "<hashed-password>",
  name: "Test User",
  role: "user",
  createdAt: new Date(),
  mfaEnabled: true,
  mfaSecret: "<totp-secret-or-fixed-code>"
});

db.users.insertOne({
  email: "admin@ghosttrace.ai",
  password: "<hashed-password>",
  name: "Test Admin",
  role: "admin",
  createdAt: new Date(),
  mfaEnabled: true,
  mfaSecret: "<totp-secret-or-fixed-code>"
});
```

### 2. Add Secrets to GitHub

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret** for each of the secrets listed above
4. Enter the secret name and value

### 3. Configure MFA for Testing

The smoke test uses a fixed MFA code. You have two options:

**Option A: Disable MFA verification during CI tests**
```javascript
// In backend/src/api/routes/auth.js - modify MFA verification
if (process.env.NODE_ENV === 'test') {
  // Accept fixed test code
  if (req.body.code === process.env.SMOKE_MFA_CODE) {
    // Accept the code
  }
}
```

**Option B: Use a predictable TOTP generator**
- Store the TOTP secret in the test user's MFA settings
- Generate the MFA code predictably using a TOTP library

### 4. Verify Smoke Test in CI Pipeline

The smoke test runs automatically when code is pushed to `main` branch:

1. Linting passes
2. Backend tests pass
3. Backend deployment to Cloud Run completes
4. Frontend deployment to Cloud Run completes
5. **Smoke test runs** ← You are here
6. Agent Builder manifest deployed

Monitor the smoke test results in the **Actions** tab of your GitHub repository.

## Troubleshooting

### Smoke Test Fails with 401 (Unauthorized)
- **Cause**: Invalid credentials or wrong email/password secrets
- **Fix**: Verify the test user accounts exist and credentials are correct in GitHub secrets

### Smoke Test Fails with MFA Error
- **Cause**: MFA code is invalid or test users don't have MFA enabled
- **Fix**: Ensure `SMOKE_MFA_CODE` matches the expected MFA validation logic

### Smoke Test Fails with 403 (Forbidden)
- **Cause**: RBAC is blocking test users
- **Fix**: Verify user roles are correctly set in MongoDB (`role: 'admin'`, `role: 'user'`, etc.)

### Frontend Routes Return 404
- **Cause**: Frontend deployment failed or hasn't fully started
- **Fix**: Check the frontend deployment logs in Cloud Run console

### Backend Health Check Fails
- **Cause**: Backend deployment failed or database connection is broken
- **Fix**: Verify MongoDB URI and network connectivity in Cloud Run environment

## Next Steps

Once the smoke test is configured and passing:

1. **Enable branch protection** to require passing smoke test before merging
2. **Set up alerts** to notify your team if smoke tests fail
3. **Monitor deployment frequency** to optimize your release cycle
4. **Scale up test coverage** to include more complex workflows as the system grows

## See Also

- [Deployment Guide](./DEPLOYMENT.md)
- [Backend Testing Guide](./BACKEND_TESTING.md)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
