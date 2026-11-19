import { Request, Response, NextFunction } from 'express';
import { prisma } from '@reachflow/db';
import { Role } from '@reachflow/shared';
import { verifyAccessToken } from '../utils/auth.js';
import { AppError } from './error-handler.js';

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication token missing or invalid');
    }

    const token = authHeader.substring(7);
    const user = verifyAccessToken(token);

    // Verify user exists in database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!dbUser) {
      throw new AppError(401, 'UNAUTHORIZED', 'User associated with token no longer exists');
    }

    req.user = dbUser;
    next();
  } catch (error: any) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError(401, 'INVALID_TOKEN', 'Session expired or token invalid'));
  }
}

export async function requireWorkspace(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required prior to workspace validation');
    }

    const workspaceId =
      (req.headers['x-workspace-id'] as string) ||
      (req.query.workspaceId as string) ||
      req.body.workspaceId;

    if (!workspaceId) {
      throw new AppError(400, 'WORKSPACE_REQUIRED', 'Header x-workspace-id is required for tenant context');
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: req.user.id,
          workspaceId,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!membership) {
      // 404/403: Zero-trust tenant isolation. The caller does not belong to this workspace
      throw new AppError(403, 'FORBIDDEN', 'Access denied: You are not a member of this workspace');
    }

    req.membership = {
      id: membership.id,
      workspaceId: membership.workspaceId,
      role: membership.role as Role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.membership) {
      return next(new AppError(400, 'WORKSPACE_REQUIRED', 'Workspace tenant context missing'));
    }

    if (!allowedRoles.includes(req.membership.role)) {
      return next(
        new AppError(
          403,
          'FORBIDDEN',
          `Insufficient permissions. Requires one of: [${allowedRoles.join(', ')}]`
        )
      );
    }

    next();
  };
}
