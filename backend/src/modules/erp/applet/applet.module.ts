import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DynamicCrudModule } from '../dynamic-crud/dynamic-crud.module';
import { AppletController } from './applet.controller';
import { AppletService } from './applet.service';

/**
 * 生产小程序（MES）后端模块
 * 复用动态 CRUD 与 JWT，统一在 /kuyou/applet 下暴露移动端接口。
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'kuyou-nestjs-rebuild-secret',
      signOptions: { expiresIn: 7200 },
    }),
    DynamicCrudModule,
  ],
  controllers: [AppletController],
  providers: [AppletService],
})
export class AppletModule {}
