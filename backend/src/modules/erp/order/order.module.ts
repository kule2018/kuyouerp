import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrderService } from './order.service';
import {
  OrderIndexController,
  OrderConfigController,
  OrderAddressController,
  OrderUserController,
  OrderCommonController,
  OrderWeixinController,
  OrderSmsController,
} from './order.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'kuyou-nestjs-rebuild-secret',
      signOptions: { expiresIn: 7200 },
    }),
  ],
  controllers: [
    OrderIndexController,
    OrderConfigController,
    OrderAddressController,
    OrderUserController,
    OrderCommonController,
    OrderWeixinController,
    OrderSmsController,
  ],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
