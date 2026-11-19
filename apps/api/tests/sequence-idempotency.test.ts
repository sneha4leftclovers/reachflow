import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '@reachflow/db';
import { processDueEnrollments } from '../src/services/sequence-engine.js';
import { EnrollmentStatus } from '@reachflow/shared';

describe('Sequence Engine & Send Idempotency Suite', () => {
  let userToken: string;
  let workspaceId: string;
  let contactId: string;
  let sequenceId: string;
  let enrollmentId: string;

  beforeAll(async () => {
    // 1. Setup User and Workspace
    const signup = await request(app)
      .post('/v1/auth/signup')
      .send({
        email: `seq_tester_${Date.now()}@drip.test`,
        password: 'Password123!',
        firstName: 'Drip',
        lastName: 'Tester',
        workspaceName: 'Drip Engine Test',
      });
    userToken = signup.body.data.accessToken;
    workspaceId = signup.body.data.workspace.id;

    // 2. Create Contact
    const contactRes = await request(app)
      .post('/v1/contacts')
      .set('Authorization', `Bearer ${userToken}`)
      .set('x-workspace-id', workspaceId)
      .send({
        email: `prospect_${Date.now()}@domain.com`,
        firstName: 'John',
        lastName: 'Doe',
        company: 'Prospect Co',
      });
    contactId = contactRes.body.data.id;

    // 3. Create Sequence with 2 steps
    const seqRes = await request(app)
      .post('/v1/sequences')
      .set('Authorization', `Bearer ${userToken}`)
      .set('x-workspace-id', workspaceId)
      .send({
        name: 'Idempotency Test Sequence',
        steps: [
          {
            stepOrder: 1,
            delayHours: 0,
            subject: 'Hi {{firstName}} from ReachFlow',
            body: 'Welcome {{company}}!',
          },
          {
            stepOrder: 2,
            delayHours: 24,
            subject: 'Following up {{firstName}}',
            body: 'Second note to {{company}}',
          },
        ],
      });
    sequenceId = seqRes.body.data.id;

    // 4. Enroll Contact
    const enrollRes = await request(app)
      .post(`/v1/sequences/${sequenceId}/enroll`)
      .set('Authorization', `Bearer ${userToken}`)
      .set('x-workspace-id', workspaceId)
      .send({
        contactId,
      });
    enrollmentId = enrollRes.body.data.id;
  });

  it('Engine processes due step and dispatches 1 email', async () => {
    const initialRun = await processDueEnrollments(workspaceId);

    expect(initialRun.sent).toBe(1);

    const messages = await prisma.emailMessage.findMany({
      where: { enrollmentId },
    });
    expect(messages.length).toBe(1);
    expect(messages[0].subject).toBe('Hi John from ReachFlow');
    expect(messages[0].body).toBe('Welcome Prospect Co!');
    expect(messages[0].idempotencyKey).toBeDefined();
  });

  it('CRITICAL: Duplicate engine execution is 100% idempotent and dispatches ZERO duplicate emails', async () => {
    // Manually rewind nextRunAt to simulate a worker crash or retry while enrollment was due
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        nextRunAt: new Date(Date.now() - 10000),
        currentStepOrder: 1, // retry the exact same step
      },
    });

    const retryRun = await processDueEnrollments(workspaceId);

    // Should detect existing idempotency key and NOT send again
    expect(retryRun.sent).toBe(0);

    const messages = await prisma.emailMessage.findMany({
      where: { enrollmentId },
    });
    // Count remains exactly 1!
    expect(messages.length).toBe(1);
  });

  it('Simulate Reply stops sequence progression and halts further emails', async () => {
    const res = await request(app)
      .post(`/v1/sequences/enrollments/${enrollmentId}/simulate-reply`)
      .set('Authorization', `Bearer ${userToken}`)
      .set('x-workspace-id', workspaceId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(EnrollmentStatus.REPLIED);

    // Make due again
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { nextRunAt: new Date(Date.now() - 10000) },
    });

    const runAfterReply = await processDueEnrollments(workspaceId);
    expect(runAfterReply.sent).toBe(0);

    const finalMessages = await prisma.emailMessage.findMany({
      where: { enrollmentId },
    });
    expect(finalMessages.length).toBe(1);
  });
});
