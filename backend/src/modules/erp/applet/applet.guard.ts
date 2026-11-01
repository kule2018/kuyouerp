import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * 小程序鉴权守卫
 * 小程序在请求头携带 `token`（由登录接口返回的 JWT），此处校验其合法性。
 * 与后台 JwtAuthGuard 共用同一 secret，因此两者签发的 token 互相通用。
 */
@Injectable()
export class AppletGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const headerToken =
      req.headers['token'] ||
      (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    if (!headerToken) {
      throw new UnauthorizedException('请先登录');
    }
    try {
      const payload = this.jwt.verify(headerToken);
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
  }
}
