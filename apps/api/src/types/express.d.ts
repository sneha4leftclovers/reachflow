import { Role } from '@reachflow/shared';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface WorkspaceMembershipContext {
  id: string;
  workspaceId: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: AuthUser;
      membership?: WorkspaceMembershipContext;
    }
  }
}
