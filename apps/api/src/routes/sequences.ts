import { Router } from 'express';
import { prisma } from '@reachflow/db';
import { createSequenceSchema, enrollContactSchema, EnrollmentStatus, ApiResponse } from '@reachflow/shared';
import { requireAuth, requireWorkspace } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { processDueEnrollments } from '../services/sequence-engine.js';

export const sequenceRouter = Router();

sequenceRouter.use(requireAuth, requireWorkspace);

// GET /v1/sequences
sequenceRouter.get('/', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;

    const sequences = await prisma.sequence.findMany({
      where: { workspaceId },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const response: ApiResponse = {
      success: true,
      data: sequences,
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /v1/sequences
sequenceRouter.post('/', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const input = createSequenceSchema.parse(req.body);

    const sequence = await prisma.$transaction(async (tx) => {
      const seq = await tx.sequence.create({
        data: {
          workspaceId,
          name: input.name,
        },
      });

      await tx.sequenceStep.createMany({
        data: input.steps.map((step, idx) => ({
          sequenceId: seq.id,
          stepOrder: step.stepOrder || idx + 1,
          delayHours: step.delayHours || 0,
          subject: step.subject,
          body: step.body,
        })),
      });

      return tx.sequence.findUnique({
        where: { id: seq.id },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });
    });

    const response: ApiResponse = {
      success: true,
      data: sequence,
    };

    return res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /v1/sequences/:id
sequenceRouter.get('/:id', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;

    const sequence = await prisma.sequence.findFirst({
      where: { id: req.params.id, workspaceId },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        enrollments: {
          include: {
            contact: true,
            emailMessages: { orderBy: { sentAt: 'desc' } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!sequence) {
      throw new AppError(404, 'NOT_FOUND', 'Sequence not found');
    }

    const response: ApiResponse = {
      success: true,
      data: sequence,
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /v1/sequences/:id/enroll
sequenceRouter.post('/:id/enroll', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const sequenceId = req.params.id;
    const input = enrollContactSchema.parse(req.body);

    const sequence = await prisma.sequence.findFirst({
      where: { id: sequenceId, workspaceId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!sequence) {
      throw new AppError(404, 'SEQUENCE_NOT_FOUND', 'Sequence not found');
    }

    if (sequence.steps.length === 0) {
      throw new AppError(400, 'NO_STEPS', 'Cannot enroll contacts into a sequence with no steps');
    }

    const contact = await prisma.contact.findFirst({
      where: { id: input.contactId, workspaceId },
    });

    if (!contact) {
      throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found');
    }

    // Check if contact already has an active enrollment in this sequence
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        sequenceId,
        contactId: contact.id,
        status: EnrollmentStatus.ACTIVE,
      },
    });

    if (existingEnrollment) {
      throw new AppError(409, 'ALREADY_ENROLLED', 'Contact is already actively enrolled in this sequence');
    }

    // Create enrollment due immediately
    const enrollment = await prisma.enrollment.create({
      data: {
        workspaceId,
        sequenceId,
        contactId: contact.id,
        currentStepOrder: 1,
        status: EnrollmentStatus.ACTIVE,
        nextRunAt: new Date(),
      },
      include: {
        contact: true,
        sequence: true,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: enrollment,
    };

    return res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /v1/sequences/enrollments/:enrollmentId/simulate-reply
sequenceRouter.post('/enrollments/:enrollmentId/simulate-reply', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const enrollmentId = req.params.enrollmentId;

    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, workspaceId },
      include: { contact: true, sequence: true },
    });

    if (!enrollment) {
      throw new AppError(404, 'NOT_FOUND', 'Enrollment not found in this workspace');
    }

    const updated = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: EnrollmentStatus.REPLIED,
      },
      include: { contact: true, sequence: true },
    });

    console.log(
      `💬 [Simulate Reply] Recorded inbound reply from ${enrollment.contact.email} for sequence "${enrollment.sequence.name}". Enrollment marked REPLIED and halted.`
    );

    const response: ApiResponse = {
      success: true,
      data: updated,
      meta: {
        message: 'Inbound reply simulated. Sequence progression halted.',
      },
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /v1/sequences/process-due (Immediate manual trigger for testing and demo execution)
sequenceRouter.post('/process-due', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const result = await processDueEnrollments(workspaceId);

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});
