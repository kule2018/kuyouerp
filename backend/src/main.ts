import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * 应用启动入口
 * - 全局前缀 kuyou（与原 FastAdmin 路由 kuyou/模块/方法 对齐）
 * - 开启 CORS（前端 Vite 默认 5173 端口跨域访问）
 * - 全局参数校验管道（class-validator）
 * - 全局异常过滤器（统一返回 {code,msg,data} 结构）
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 与原系统路由前缀保持一致
  app.setGlobalPrefix('kuyou');

  // 允许前端跨域
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // 全局校验：自动剔除未声明字段，禁止未知属性
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 统一异常返回结构
  app.useGlobalFilters(new AllExceptionsFilter());

  // 微信支付回调为 text/xml 文本，需单独启用文本解析器（不影响其余 JSON 接口）
  app.useBodyParser('text', {
    type: ['text/xml', 'application/xml'],
    limit: '2mb',
  });

  // 上传文件静态目录（头像等）
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`kuyou-nestjs backend listening on http://localhost:${port}/kuyou`);
}

bootstrap();
