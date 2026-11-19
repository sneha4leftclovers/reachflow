import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '@reachflow/db';

describe('Tenant Isolation & Cross-Workspace Security Suite', () => {
  let userAToken: string;
  let workspaceAId: string;
  let userBToken: string;
  let workspaceBId: string;

  let contactAId: string;
  let dealAId: string;
  let sequenceAId: string;

  beforeAll(async () => {
    // 1. Setup Workspace A
    const signupA = await request(app)
      .post('/v1/auth/signup')
      .send({
        email: `tenant_a_${Date.now()}@alpha.corp`,
        password: 'Password123!',
        firstName: 'Alice',
        lastName: 'Alpha',
        workspaceName: 'Alpha Corp',
      });
    userAToken = signupA.body.data.accessToken;
    workspaceAId = signupA.body.data.workspace.id;

    // 2. Setup Workspace B
    const signupB = await request(app)
      .post('/v1/auth/signup')
      .send({
        email: `tenant_b_${Date.now()}@beta.inc`,
        password: 'Password123!',
        firstName: 'Bob',
        lastName: 'Beta',
        workspaceName: 'Beta Inc',
      });
    userBToken = signupB.body.data.accessToken;
    workspaceBId = signupB.body.data.workspace.id;

    // 3. User A creates resources in Workspace A
    const contactRes = await request(app)
      .post('/v1/contacts')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-workspace-id', workspaceAId)
      .send({
        email: 'secret_lead@target.com',
        firstName: 'Target',
        lastName: 'Lead',
        company: 'Target Corp',
      });
    contactAId = contactRes.body.data.id;

    const dealRes = await request(app)
      .post('/v1/deals')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-workspace-id', workspaceAId)
      .send({
        title: 'Alpha Strategic Deal',
        value: 100000,
        stage: 'LEAD',
      });
    dealAId = dealRes.body.data.id;

    const seqRes = await request(app)
      .post('/v1/sequences')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-workspace-id', workspaceAId)
      .send({
        name: 'Alpha Secret Drip',
        steps: [
          {
            stepOrder: 1,
            delayHours: 0,
            subject: 'Alpha Outreach',
            body: 'Hello {{firstName}}',
          },
        ],
      });
    sequenceAId = seqRes.body.data.id;
  });

  it('BOLA Prevention: User B passing Workspace A ID directly receives 403 Forbidden', async () => {
    const res = await request(app)
      .get('/v1/contacts')
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-workspace-id', workspaceAId);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('IDOR Prevention: User B in Workspace B cannot read User A Contact (expects 404)', async () => {
    const res = await request(app)
      .get(`/v1/contacts/${contactAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-workspace-id', workspaceBId);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('IDOR Prevention: User B in Workspace B cannot update User A Contact (expects 404)', async () => {
    const res = await request(app)
      .patch(`/v1/contacts/${contactAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-workspace-id', workspaceBId)
      .send({
        firstName: 'Hacked',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);

    // Verify contact was NOT modified
    const original = await prisma.contact.findUnique({
      where: { id: contactAId },
    });
    expect(original?.firstName).toBe('Target');
  });

  it('IDOR Prevention: User B in Workspace B cannot delete User A Contact (expects 404)', async () => {
    const res = await request(app)
      .delete(`/v1/contacts/${contactAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-workspace-id', workspaceBId);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);

    // Verify contact still exists
    const original = await prisma.contact.findUnique({
      where: { id: contactAId },
    });
    expect(original).not.toBeNull();
  });

  it('IDOR Prevention: User B in Workspace B cannot read User A Deal (expects 404)', async () => {
    const res = await request(app)
      .get(`/v1/deals/${dealAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-workspace-id', workspaceBId);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('IDOR Prevention: User B in Workspace B cannot update User A Deal Stage (expects 404)', async () => {
    const res = await request(app)
      .patch(`/v1/deals/${dealAId}/stage`)
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-workspace-id', workspaceBId)
      .send({
        stage: 'WON',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);

    // Verify deal stage unchanged
    const original = await prisma.deal.findUnique({
      where: { id: dealAId },
    });
    expect(original?.stage).toBe('LEAD');
  });

  it('IDOR Prevention: User B in Workspace B cannot read User A Sequence (expects 404)', async () => {
    const res = await request(app)
      .get(`/v1/sequences/${sequenceAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-workspace-id', workspaceBId);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
