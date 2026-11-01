import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';
import { ok } from '../../common/utils/resp';

/**
 * 后台登录（路由对齐 FastAdmin：/kuyou/index/login）
 */
@Controller('index')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 登录 POST /kuyou/index/login */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto);
    return ok(data, '登录成功');
  }

  /** 退出 POST /kuyou/index/logout */
  @Post('logout')
  async logout() {
    return ok(null, '退出成功');
  }
}
