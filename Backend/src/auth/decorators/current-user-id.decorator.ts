import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const sub = request.user?.sub as string | undefined;
    if (!sub) {
      throw new Error('CurrentUserId used without authenticated user');
    }
    return sub;
  },
);
