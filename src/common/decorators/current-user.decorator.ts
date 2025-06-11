import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

export interface JwtPayload {
  sub: string;
  name?: string;
  email?: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
} 