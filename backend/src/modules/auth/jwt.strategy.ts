import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * JWT 策略：校验 Bearer Token，并回写当前用户到 request.user
 * 同时携带角色信息（roleId / dataScope），供接口权限与数据权限使用。
 * roleId 为 0 表示未分配角色（按超级管理员处理）。
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'kuyou-nestjs-rebuild-secret',
    });
  }

  async validate(payload: { sub: number; username: string; roleId?: number; dataScope?: string }) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('无效的登录状态');
    }
    return {
      id: payload.sub,
      username: payload.username,
      roleId: payload.roleId ?? 0,
      dataScope: payload.dataScope ?? 'all',
    };
  }
}
