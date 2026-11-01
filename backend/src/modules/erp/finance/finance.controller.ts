import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ok } from '../../../common/utils/resp';
import { FinanceService } from './finance.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly svc: FinanceService) {}

  @Post('collection/add')
  collectionAdd(@Body() body: any, @CurrentUser() user: any) {
    return ok(this.svc.addCollection({ ...body, admin_id: user?.id ?? body.admin_id }));
  }

  @Post('payment/add')
  paymentAdd(@Body() body: any, @CurrentUser() user: any) {
    return ok(this.svc.addPayment({ ...body, admin_id: user?.id ?? body.admin_id }));
  }
}

