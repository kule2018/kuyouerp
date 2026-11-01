import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { Admin } from './admin.entity';
import { RbacModule } from '../rbac/rbac.module';

/**
 * JWT 有效期固定 2 小时（7200 秒）。早期因环境变量 JWT_EXPIRES_IN 被误配成 7 秒，
 * 导致登录后几秒 token 即过期、一进任意页面就被后端判失效并跳回登录。
 * 此处直接固定 7200，彻底杜绝该问题（与 order/applet 等模块保持一致）。
 */
// 注意：expiresIn 必须是数字（秒）或带单位的字符串（如 '2h'）；
// 若传无单位字符串 '7200'，jsonwebtoken 会经 ms() 解析成 7200 毫秒≈7 秒，导致 token 秒级过期。
const JWT_EXPIRES_IN = Number(process.env.JWT_EXPIRES_IN) || 7200;

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'kuyou-nestjs-rebuild-secret',
      signOptions: { expiresIn: JWT_EXPIRES_IN },
    }),
    RbacModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
