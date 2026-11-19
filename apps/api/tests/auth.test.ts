import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '@reachflow/db';

describe('Authentication & Token Lifecycle', () => {
  const testEmail = `auth_test_${Date.now()}@reachflow.dev`;
  const testPassword = 'Password123!';
  let refreshTokenCookie: string;
  let accessToken: string;

  it('POST /v1/auth/signup - creates user, default workspace, returns access token & cookie', async () => {
    const res = await request(app)
      .post('/v1/auth/signup')
      .send({
        email: testEmail,
        password: testPassword,
        firstName: 'Tester',
        lastName: 'Account',
        workspaceName: 'Test Org',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.workspace.name).toBe('Test Org');
    expect(res.body.data.accessToken).toBeDefined();

    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(cookies).toBeDefined();
    const refreshCookie = cookies?.find((c) => c.includes('reachflow_refresh_token'));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
  });

  it('POST /v1/auth/login - validates credentials and returns tokens', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.workspaces.length).toBeGreaterThan(0);

    accessToken = res.body.data.accessToken;

    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    const refreshCookie = cookies?.find((c) => c.includes('reachflow_refresh_token'));
    expect(refreshCookie).toBeDefined();
    refreshTokenCookie = refreshCookie!;
  });

  it('POST /v1/auth/login - rejects invalid credentials with 401', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /v1/auth/refresh - rotates refresh token cookie and returns fresh access token', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .set('Cookie', refreshTokenCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();

    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    const newRefreshCookie = cookies?.find((c) => c.includes('reachflow_refresh_token'));
    expect(newRefreshCookie).toBeDefined();
  });

  it('POST /v1/auth/refresh - REUSE DETECTION: Reusing an old/revoked token revokes all family tokens', async () => {
    // Attempting to reuse the original refreshTokenCookie (now revoked) triggers reuse detection
    const res = await request(app)
      .post('/v1/auth/refresh')
      .set('Cookie', refreshTokenCookie);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TOKEN_REUSE_DETECTED');
  });

  it('GET /v1/auth/me - returns user profile with valid Bearer token', async () => {
    const res = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
  });
});
