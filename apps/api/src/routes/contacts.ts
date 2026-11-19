import { Router } from 'express';
import { prisma } from '@reachflow/db';
import { createContactSchema, updateContactSchema, ApiResponse } from '@reachflow/shared';
import { requireAuth, requireWorkspace } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';

export const contactRouter = Router();

contactRouter.use(requireAuth, requireWorkspace);

// GET /v1/contacts (Cursor pagination, search, tag filtering)
contactRouter.get('/', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const cursor = req.query.cursor as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();
    const tag = (req.query.tag as string | undefined)?.trim();

    const where: any = {
      workspaceId,
    };

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { company: { contains: search } },
      ];
    }

    if (tag) {
      where.tags = {
        some: {
          tag: {
            name: tag,
          },
        },
      };
    }

    const items = await prisma.contact.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        tags: {
          include: { tag: true },
        },
      },
    });

    const hasNextPage = items.length > limit;
    const contacts = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? contacts[contacts.length - 1].id : null;

    const formatted = contacts.map((c) => ({
      id: c.id,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      company: c.company,
      title: c.title,
      phone: c.phone,
      status: c.status,
      tags: c.tags.map((t) => t.tag.name),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    const response: ApiResponse = {
      success: true,
      data: formatted,
      meta: {
        cursor: nextCursor,
        hasNextPage,
      },
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /v1/contacts
contactRouter.post('/', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const input = createContactSchema.parse(req.body);

    const existing = await prisma.contact.findUnique({
      where: {
        workspaceId_email: {
          workspaceId,
          email: input.email.toLowerCase(),
        },
      },
    });

    if (existing) {
      throw new AppError(409, 'CONTACT_EXISTS', 'A contact with this email already exists in this workspace');
    }

    const contact = await prisma.$transaction(async (tx) => {
      const created = await tx.contact.create({
        data: {
          workspaceId,
          email: input.email.toLowerCase(),
          firstName: input.firstName,
          lastName: input.lastName,
          company: input.company,
          title: input.title,
          phone: input.phone,
        },
      });

      if (input.tags && input.tags.length > 0) {
        for (const tagName of input.tags) {
          const trimmed = tagName.trim();
          if (!trimmed) continue;

          let tag = await tx.tag.findUnique({
            where: {
              workspaceId_name: {
                workspaceId,
                name: trimmed,
              },
            },
          });

          if (!tag) {
            tag = await tx.tag.create({
              data: { workspaceId, name: trimmed },
            });
          }

          await tx.contactTag.create({
            data: { contactId: created.id, tagId: tag.id },
          });
        }
      }

      return tx.contact.findUnique({
        where: { id: created.id },
        include: { tags: { include: { tag: true } } },
      });
    });

    const response: ApiResponse = {
      success: true,
      data: {
        ...contact,
        tags: contact?.tags.map((t) => t.tag.name) || [],
      },
    };

    return res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /v1/contacts/:id
contactRouter.get('/:id', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const contact = await prisma.contact.findFirst({
      where: {
        id: req.params.id,
        workspaceId,
      },
      include: {
        tags: { include: { tag: true } },
        deals: true,
        enrollments: {
          include: {
            sequence: true,
            emailMessages: true,
          },
        },
      },
    });

    if (!contact) {
      throw new AppError(404, 'NOT_FOUND', 'Contact not found');
    }

    const response: ApiResponse = {
      success: true,
      data: {
        ...contact,
        tags: contact.tags.map((t) => t.tag.name),
      },
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// PATCH /v1/contacts/:id
contactRouter.patch('/:id', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const input = updateContactSchema.parse(req.body);

    const existing = await prisma.contact.findFirst({
      where: { id: req.params.id, workspaceId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Contact not found');
    }

    if (input.email && input.email.toLowerCase() !== existing.email) {
      const emailDuplicate = await prisma.contact.findUnique({
        where: {
          workspaceId_email: {
            workspaceId,
            email: input.email.toLowerCase(),
          },
        },
      });

      if (emailDuplicate) {
        throw new AppError(409, 'CONTACT_EXISTS', 'Email is already used by another contact in this workspace');
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const dataToUpdate: any = {};
      if (input.email) dataToUpdate.email = input.email.toLowerCase();
      if (input.firstName !== undefined) dataToUpdate.firstName = input.firstName;
      if (input.lastName !== undefined) dataToUpdate.lastName = input.lastName;
      if (input.company !== undefined) dataToUpdate.company = input.company;
      if (input.title !== undefined) dataToUpdate.title = input.title;
      if (input.phone !== undefined) dataToUpdate.phone = input.phone;

      await tx.contact.update({
        where: { id: existing.id },
        data: dataToUpdate,
      });

      if (input.tags) {
        await tx.contactTag.deleteMany({
          where: { contactId: existing.id },
        });

        for (const tagName of input.tags) {
          const trimmed = tagName.trim();
          if (!trimmed) continue;

          let tag = await tx.tag.findUnique({
            where: {
              workspaceId_name: {
                workspaceId,
                name: trimmed,
              },
            },
          });

          if (!tag) {
            tag = await tx.tag.create({
              data: { workspaceId, name: trimmed },
            });
          }

          await tx.contactTag.create({
            data: { contactId: existing.id, tagId: tag.id },
          });
        }
      }

      return tx.contact.findUnique({
        where: { id: existing.id },
        include: { tags: { include: { tag: true } } },
      });
    });

    const response: ApiResponse = {
      success: true,
      data: {
        ...updated,
        tags: updated?.tags.map((t) => t.tag.name) || [],
      },
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// DELETE /v1/contacts/:id
contactRouter.delete('/:id', async (req, res, next) => {
  try {
    const workspaceId = req.membership!.workspaceId;
    const existing = await prisma.contact.findFirst({
      where: { id: req.params.id, workspaceId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Contact not found');
    }

    await prisma.contact.delete({
      where: { id: existing.id },
    });

    const response: ApiResponse = {
      success: true,
      data: { message: 'Contact deleted successfully' },
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});
