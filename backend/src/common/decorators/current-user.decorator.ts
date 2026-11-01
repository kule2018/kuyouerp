import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 取出当前登录用户（由 JwtAuthGuard 注入到 request.user）
 * 用法：@CurrentUser() user: JwtPayload
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
