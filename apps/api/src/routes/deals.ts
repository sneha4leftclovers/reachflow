import { Router } from 'express';
import { prisma } from '@reachflow/db';
import { createDealSchema, updateDealSchema, updateDealStageSchema, DealStage, ApiResponse } from '@reachflow/shared';
import { requireAuth, requireWorkspace } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';

export const dealRouter = Router();

dealRouter.use(requireAuth, requireWorkspace);

// GET /v1/deals (Returns deals for Kanban, ordered by stage & position)
dealRouter.get('/', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const stage = req.query.stage as DealStage | undefined;

    const where: any = { workspaceId };
    if (stage && Object.values(DealStage).includes(stage)) {
      where.stage = stage;
    }

    const deals = await prisma.deal.findMany({
      where,
      orderBy: [{ stage: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
          },
        },
      },
    });

    const response: ApiResponse = {
      success: true,
      data: deals,
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /v1/deals
dealRouter.post('/', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const input = createDealSchema.parse(req.body);

    if (input.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: input.contactId, workspaceId },
      });
      if (!contact) {
        throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact associated with deal not found in this workspace');
      }
    }

    // Determine default position (append to bottom of stage column)
    const lastDeal = await prisma.deal.findFirst({
      where: { workspaceId, stage: input.stage },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const position = input.position ?? (lastDeal ? lastDeal.position + 1 : 0);

    const deal = await prisma.deal.create({
      data: {
        workspaceId,
        title: input.title,
        value: input.value,
        stage: input.stage,
        position,
        company: input.company,
        contactId: input.contactId,
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
          },
        },
      },
    });

    const response: ApiResponse = {
      success: true,
      data: deal,
    };

    return res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /v1/deals/:id
dealRouter.get('/:id', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const deal = await prisma.deal.findFirst({
      where: { id: req.params.id, workspaceId },
      include: {
        contact: true,
      },
    });

    if (!deal) {
      throw new AppError(404, 'NOT_FOUND', 'Deal not found');
    }

    const response: ApiResponse = {
      success: true,
      data: deal,
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// PATCH /v1/deals/:id (General update)
dealRouter.patch('/:id', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const input = updateDealSchema.parse(req.body);

    const existing = await prisma.deal.findFirst({
      where: { id: req.params.id, workspaceId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Deal not found');
    }

    if (input.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: input.contactId, workspaceId },
      });
      if (!contact) {
        throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact associated with deal not found in this workspace');
      }
    }

    const updated = await prisma.deal.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        value: input.value,
        stage: input.stage,
        company: input.company,
        contactId: input.contactId !== undefined ? input.contactId : existing.contactId,
      },
      include: {
        contact: true,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: updated,
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// PATCH /v1/deals/:id/stage (Kanban drag-and-drop movement)
dealRouter.patch('/:id/stage', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const input = updateDealStageSchema.parse(req.body);

    const deal = await prisma.deal.findFirst({
      where: { id: req.params.id, workspaceId },
    });

    if (!deal) {
      throw new AppError(404, 'NOT_FOUND', 'Deal not found');
    }

    const newPosition = input.position ?? 0;

    const updated = await prisma.deal.update({
      where: { id: deal.id },
      data: {
        stage: input.stage,
        position: newPosition,
      },
      include: {
        contact: true,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: updated,
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// DELETE /v1/deals/:id
dealRouter.delete('/:id', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const deal = await prisma.deal.findFirst({
      where: { id: req.params.id, workspaceId },
    });

    if (!deal) {
      throw new AppError(404, 'NOT_FOUND', 'Deal not found');
    }

    await prisma.deal.delete({
      where: { id: deal.id },
    });

    const response: ApiResponse = {
      success: true,
      data: { message: 'Deal deleted successfully' },
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});
