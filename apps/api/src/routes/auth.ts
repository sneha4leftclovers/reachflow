import { Router } from 'express';
import { prisma } from '@reachflow/db';
import { Role, signupSchema, loginSchema, ApiResponse } from '@reachflow/shared';
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  generateRefreshToken,
  hashToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  REFRESH_COOKIE_NAME,
} from '../utils/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

// POST /v1/auth/signup
authRouter.post('/signup', async (req, res, next) => {
  try {
    const input = signupSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new AppError(409, 'USER_EXISTS', 'A user with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const workspaceName = input.workspaceName || `${input.firstName}'s Workspace`;
    const slugBase = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const slug = `${slugBase}-${Date.now().toString().slice(-4)}`;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          slug,
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: Role.OWNER,
        },
      });

      const { rawToken, tokenHash, expiresAt, family } = generateRefreshToken();
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          family,
          expiresAt,
        },
      });

      return { user, workspace, rawToken, expiresAt };
    });

    const accessToken = signAccessToken({
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
    });

    setRefreshTokenCookie(res, result.rawToken, result.expiresAt);

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
        workspace: {
          id: result.workspace.id,
          name: result.workspace.name,
          slug: result.workspace.slug,
          role: Role.OWNER,
        },
        accessToken,
      },
    };

    return res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /v1/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        memberships: {
          include: { workspace: true },
        },
      },
    });

    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const isMatch = await comparePassword(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const { rawToken, tokenHash, expiresAt, family } = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        family,
        expiresAt,
      },
    });

    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    setRefreshTokenCookie(res, rawToken, expiresAt);

    const workspaces = user.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role as Role,
    }));

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        workspaces,
        activeWorkspace: workspaces[0] || null,
        accessToken,
      },
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /v1/auth/refresh (Rotating refresh token in httpOnly cookie)
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const rawToken = req.cookies[REFRESH_COOKIE_NAME];
    if (!rawToken) {
      throw new AppError(401, 'TOKEN_MISSING', 'Refresh token cookie is missing');
    }

    const currentHash = hashToken(rawToken);

    const existingToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: currentHash },
      include: { user: true },
    });

    if (!existingToken) {
      clearRefreshTokenCookie(res);
      throw new AppError(401, 'TOKEN_INVALID', 'Refresh token is invalid');
    }

    // Token Family Reuse Detection:
    // If an already-revoked token is used, compromise is detected.
    // Invalidate ALL tokens in this family immediately.
    if (existingToken.isRevoked) {
      await prisma.refreshToken.updateMany({
        where: { family: existingToken.family },
        data: { isRevoked: true },
      });
      clearRefreshTokenCookie(res);
      throw new AppError(401, 'TOKEN_REUSE_DETECTED', 'Compromised refresh token reused. All sessions revoked.');
    }

    if (existingToken.expiresAt < new Date()) {
      clearRefreshTokenCookie(res);
      throw new AppError(401, 'TOKEN_EXPIRED', 'Refresh token has expired');
    }

    // Token Rotation: revoke previous token and issue a fresh one in the same family
    const { rawToken: nextRawToken, tokenHash: nextTokenHash, expiresAt: nextExpiresAt } =
      generateRefreshToken(existingToken.family);

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: existingToken.id },
        data: { isRevoked: true },
      }),
      prisma.refreshToken.create({
        data: {
          userId: existingToken.userId,
          tokenHash: nextTokenHash,
          family: existingToken.family,
          expiresAt: nextExpiresAt,
        },
      }),
    ]);

    setRefreshTokenCookie(res, nextRawToken, nextExpiresAt);

    const accessToken = signAccessToken({
      id: existingToken.user.id,
      email: existingToken.user.email,
      firstName: existingToken.user.firstName,
      lastName: existingToken.user.lastName,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        accessToken,
      },
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /v1/auth/logout
authRouter.post('/logout', async (req, res, next) => {
  try {
    const rawToken = req.cookies[REFRESH_COOKIE_NAME];
    if (rawToken) {
      const currentHash = hashToken(rawToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash: currentHash },
        data: { isRevoked: true },
      });
    }

    clearRefreshTokenCookie(res);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Logged out successfully' },
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /v1/auth/me
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        memberships: {
          include: { workspace: true },
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const workspaces = user.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role as Role,
    }));

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        workspaces,
      },
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /v1/auth/demo
authRouter.post('/demo', async (req, res, next) => {
  try {
    const demoUser = await prisma.user.findUnique({
      where: { email: 'demo@reachflow.io' },
      include: {
        memberships: {
          include: { workspace: true },
        },
      },
    });

    if (!demoUser) {
      throw new AppError(404, 'DEMO_NOT_FOUND', 'Demo user not seeded yet. Please run db:seed.');
    }

    const { rawToken, tokenHash, expiresAt, family } = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: demoUser.id,
        tokenHash,
        family,
        expiresAt,
      },
    });

    const accessToken = signAccessToken({
      id: demoUser.id,
      email: demoUser.email,
      firstName: demoUser.firstName,
      lastName: demoUser.lastName,
    });

    setRefreshTokenCookie(res, rawToken, expiresAt);

    const workspaces = demoUser.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role as Role,
    }));

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: demoUser.id,
          email: demoUser.email,
          firstName: demoUser.firstName,
          lastName: demoUser.lastName,
        },
        workspaces,
        activeWorkspace: workspaces[0] || null,
        accessToken,
      },
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});
