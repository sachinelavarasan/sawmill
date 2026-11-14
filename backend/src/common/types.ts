import type { Role } from '@sawmill/shared';

/** The authenticated user attached to every request (always re-loaded from the DB). */
export interface AuthUser {
  id: string;
  millId: string;
  name: string;
  username: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  /** users.tokenVersion when the token was issued; tokens from before a bump are refused */
  tv?: number;
}
