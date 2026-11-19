import { z } from 'zod';

// Roles & Status Enums
export const Role = {
  OWNER: 'OWNER',
  MEMBER: 'MEMBER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ContactStatus = {
  ACTIVE: 'ACTIVE',
  BOUNCED: 'BOUNCED',
  UNSUBSCRIBED: 'UNSUBSCRIBED',
} as const;
export type ContactStatus = (typeof ContactStatus)[keyof typeof ContactStatus];

export const DealStage = {
  LEAD: 'LEAD',
  QUALIFIED: 'QUALIFIED',
  DEMO: 'DEMO',
  NEGOTIATION: 'NEGOTIATION',
  WON: 'WON',
  LOST: 'LOST',
} as const;
export type DealStage = (typeof DealStage)[keyof typeof DealStage];

export const SequenceStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
} as const;
export type SequenceStatus = (typeof SequenceStatus)[keyof typeof SequenceStatus];

export const EnrollmentStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  REPLIED: 'REPLIED',
} as const;
export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];

// Response Envelopes
export interface ApiResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    cursor?: string | null;
    hasNextPage?: boolean;
    total?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
  meta?: {
    requestId?: string;
  };
}

// Zod Validation Schemas
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  workspaceName: z.string().min(2, 'Workspace name must be at least 2 characters').optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters'),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const createContactSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = createContactSchema.partial();
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export const createDealSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  value: z.number().nonnegative('Value must be a positive number').default(0),
  stage: z.nativeEnum(DealStage).default(DealStage.LEAD),
  contactId: z.string().optional().nullable(),
  company: z.string().optional(),
  position: z.number().int().default(0),
});
export type CreateDealInput = z.infer<typeof createDealSchema>;

export const updateDealSchema = createDealSchema.partial();
export type UpdateDealInput = z.infer<typeof updateDealSchema>;

export const updateDealStageSchema = z.object({
  stage: z.nativeEnum(DealStage),
  position: z.number().int().nonnegative().optional(),
});
export type UpdateDealStageInput = z.infer<typeof updateDealStageSchema>;

export const sequenceStepSchema = z.object({
  stepOrder: z.number().int().positive(),
  delayHours: z.number().int().nonnegative().default(0), // simple hours/delay representation
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
});
export type SequenceStepInput = z.infer<typeof sequenceStepSchema>;

export const createSequenceSchema = z.object({
  name: z.string().min(1, 'Sequence name is required'),
  steps: z.array(sequenceStepSchema).min(1, 'At least one step is required'),
});
export type CreateSequenceInput = z.infer<typeof createSequenceSchema>;

export const enrollContactSchema = z.object({
  contactId: z.string().min(1, 'Contact ID is required'),
});
export type EnrollContactInput = z.infer<typeof enrollContactSchema>;
