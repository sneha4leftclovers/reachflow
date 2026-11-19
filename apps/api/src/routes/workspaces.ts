import { Router } from 'express';
import { prisma } from '@reachflow/db';
import { Role, createWorkspaceSchema, ApiResponse } from '@reachflow/shared';
import { z } from 'zod';
import { requireAuth, requireWorkspace, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);

// GET /v1/workspaces
workspaceRouter.get('/', async (req, res, next) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.user!.id },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                memberships: true,
                contacts: true,
                deals: true,
                sequences: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const workspaces = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role as Role,
      counts: m.workspace._count,
      createdAt: m.workspace.createdAt,
    }));

    const response: ApiResponse = {
      success: true,
      data: workspaces,
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /v1/workspaces
workspaceRouter.post('/', async (req, res, next) => {
  try {
    const input = createWorkspaceSchema.parse(req.body);

    const slugBase = input.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const slug = `${slugBase}-${Date.now().toString().slice(-4)}`;

    const result = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: input.name,
          slug,
        },
      });

      await tx.membership.create({
        data: {
          userId: req.user!.id,
          workspaceId: workspace.id,
          role: Role.OWNER,
        },
      });

      return workspace;
    });

    const response: ApiResponse = {
      success: true,
      data: {
        id: result.id,
        name: result.name,
        slug: result.slug,
        role: Role.OWNER,
      },
    };

    return res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /v1/workspaces/:workspaceId/members (Owner only)
const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Role).default(Role.MEMBER),
});

workspaceRouter.post('/:workspaceId/members', requireWorkspace, requireRole([Role.OWNER]), async (req, res, next) => {
  try {
    const input = addMemberSchema.parse(req.body);
    const workspaceId = req.membership!.workspaceId;

    const targetUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!targetUser) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User with this email does not exist');
    }

    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUser.id,
          workspaceId,
        },
      },
    });

    if (existingMembership) {
      throw new AppError(409, 'MEMBERSHIP_EXISTS', 'User is already a member of this workspace');
    }

    const membership = await prisma.membership.create({
      data: {
        userId: targetUser.id,
        workspaceId,
        role: input.role,
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        id: membership.id,
        role: membership.role,
        user: membership.user,
      },
    };

    return res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});
