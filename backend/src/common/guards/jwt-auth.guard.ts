import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT 鉴权守卫
 * 作用于需要登录的接口；未携带有效 token 时返回 401。
 * 原 kuyou 后台通过 session/cookie 鉴权，这里以 JWT Bearer 等价替换。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
