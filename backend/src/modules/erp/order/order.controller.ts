import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ok200 } from '../../../common/utils/resp';
import { OrderService } from './order.service';

/* ===================== 购物车 / 商品 / 订单 ===================== */

@Controller('order/index')
export class OrderIndexController {
  constructor(private readonly svc: OrderService) {}

  @Post('getCart')
  @UseGuards(JwtAuthGuard)
  async getCart(@CurrentUser() user: any) {
    return ok200(await this.svc.getCart(user.id));
  }

  @Post('getCartNumber')
  @UseGuards(JwtAuthGuard)
  async getCartNumber(@CurrentUser() user: any) {
    return ok200(await this.svc.getCartNumber(user.id));
  }

  @Post('addCart')
  @UseGuards(JwtAuthGuard)
  async addCart(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.addCart(user.id, Number(body.goods_id), Number(body.goods_unit), Number(body.number), Number(body.goods_attr) || 0));
  }

  @Post('editCart')
  @UseGuards(JwtAuthGuard)
  async editCart(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.editCart(user.id, Number(body.cart_id), Number(body.goods_id), Number(body.number)));
  }

  @Post('delCart')
  @UseGuards(JwtAuthGuard)
  async delCart(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.delCart(user.id, body.cart_id));
  }

  @Post('goodsTypeList')
  async goodsTypeList(@Body() body: any) {
    return ok200(await this.svc.goodsTypeList(body.pid, body.user_id ? Number(body.user_id) : null));
  }

  @Post('goodsGoodsList')
  async goodsGoodsList(@Body() body: any, @CurrentUser() user: any) {
    const userId = user && user.id ? user.id : null;
    return ok200(await this.svc.goodsGoodsList(body, userId));
  }

  @Post('goodsGoodsInfo')
  async goodsGoodsInfo(@Body() body: any, @CurrentUser() user: any) {
    const userId = user && user.id ? user.id : null;
    return ok200(await this.svc.goodsGoodsInfo(Number(body.goods_id), userId, body.goods_unit, body.goods_attr));
  }

  @Post('banner')
  async banner(@Body() body: any) {
    return ok200(await this.svc.banner(Number(body.type)));
  }

  @Post('getHistory')
  @UseGuards(JwtAuthGuard)
  async getHistory(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.getHistory(user.id, Number(body.page) || 1, Number(body.limit) || 10));
  }

  @Post('address_list')
  @UseGuards(JwtAuthGuard)
  async addressList(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.addressList(user.id, Number(body.page) || 1, Number(body.limit) || 10));
  }

  @Post('createOrder')
  @UseGuards(JwtAuthGuard)
  async createOrder(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.createOrder(user.id, body.cart_id, body.address_id, body.diver_type, body.store_id));
  }

  @Post('getOrderList')
  @UseGuards(JwtAuthGuard)
  async getOrderList(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.getOrderList(user.id, body.status, Number(body.page) || 1, Number(body.limit) || 10));
  }

  @Post('orderInfo')
  @UseGuards(JwtAuthGuard)
  async orderInfo(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.orderInfo(user.id, body.order_num));
  }

  @Post('cancelOrder')
  @UseGuards(JwtAuthGuard)
  async cancelOrder(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.cancelOrder(user.id, body.order_num));
  }

  @Post('receiving')
  @UseGuards(JwtAuthGuard)
  async receiving(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.receiving(user.id, body.order_num));
  }

  @Post('wxpay')
  @UseGuards(JwtAuthGuard)
  async wxpay(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.wxpay(user.id, body.order_num));
  }

  @Post('notify')
  async notify(@Body() body: string, @Res() res: any) {
    const xml = typeof body === 'string' ? body : '';
    res.set('Content-Type', 'text/xml');
    res.send(await this.svc.wxNotify(xml));
  }
}

/* ===================== 配置 ===================== */

@Controller('order/config')
export class OrderConfigController {
  constructor(private readonly svc: OrderService) {}

  @Post('getdetail')
  async getdetail(@Body() body: any) {
    return ok200(await this.svc.configGetdetail(body.name));
  }

  @Post('getSet')
  async getSet(@Body() body: any) {
    return ok200(await this.svc.configGetSet(body.name));
  }

  @Post('getConfig')
  async getConfig(@Body() body: any) {
    const names = Array.isArray(body.name) ? body.name : [body.name];
    return ok200(await this.svc.configGetConfig(names));
  }
}

/* ===================== 地址（用户级） ===================== */

@Controller('order/address')
export class OrderAddressController {
  constructor(private readonly svc: OrderService) {}

  @Post('getlist')
  @UseGuards(JwtAuthGuard)
  async getlist(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.addressList(user.id, Number(body.page) || 1, Number(body.limit) || 10));
  }

  @Post('getdetail')
  @UseGuards(JwtAuthGuard)
  async getdetail(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.addressDetail(Number(body.id), user.id));
  }

  @Post('adddetail')
  @UseGuards(JwtAuthGuard)
  async adddetail(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.addressSave(body, user.id));
  }

  @Post('editdetail')
  @UseGuards(JwtAuthGuard)
  async editdetail(@CurrentUser() user: any, @Body() body: any) {
    const id = Number(body.id);
    delete body.id;
    return ok200(await this.svc.addressSave(body, user.id, id));
  }

  @Post('deldetail')
  @UseGuards(JwtAuthGuard)
  async deldetail(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.addressDelete(Number(body.id), user.id));
  }

  @Post('area')
  async area(@Body() body: any) {
    return ok200(await this.svc.getArea(body.id));
  }
}

/* ===================== 用户 ===================== */

@Controller('order/user')
export class OrderUserController {
  constructor(private readonly svc: OrderService) {}

  @Post('login')
  async login(@Body() body: any) {
    return ok200(await this.svc.login(body.account, body.password));
  }

  @Post('mobilelogin')
  @UseGuards(JwtAuthGuard)
  async mobilelogin(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.mobilelogin(body.mobile, user && user.id ? user.id : null));
  }

  @Post('register')
  async register(@Body() body: any) {
    return ok200(await this.svc.register(body.username, body.password, body.email, body.mobile));
  }

  @Post('userInfo')
  @UseGuards(JwtAuthGuard)
  async userInfo(@CurrentUser() user: any) {
    return ok200(await this.svc.userInfo(user.id));
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.profile(user.id, body.nickname, body.avatar));
  }

  @Post('changeemail')
  @UseGuards(JwtAuthGuard)
  async changeemail(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.bind(user.id, body.email));
  }

  @Post('changemobile')
  @UseGuards(JwtAuthGuard)
  async changemobile(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.changemobile(user.id, body.mobile));
  }

  @Post('resetpwd')
  @UseGuards(JwtAuthGuard)
  async resetpwd(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.resetpwd(user.id, body.newpassword));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: any) {
    return ok200(null, '退出成功');
  }
}

/* ===================== 公共（上传） ===================== */

@Controller('order/common')
export class OrderCommonController {
  constructor(private readonly svc: OrderService) {}

  @Post('init')
  async init() {
    return ok200({ status: 'ok' });
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: any) {
    const res = await this.svc.saveUpload(file);
    return ok200(res);
  }
}

/* ===================== 微信 ===================== */

@Controller('order/weixin')
export class OrderWeixinController {
  constructor(private readonly svc: OrderService) {}

  @Post('getWxMiniProgramSessionKey')
  async sessionKey(@Body() body: any) {
    return ok200(await this.svc.wxSessionKey(body.code, body.autoLogin !== false));
  }

  @Post('wxMiniProgramOauth')
  async oauth(@Body() body: any) {
    return ok200(
      await this.svc.wxOauth({
        openid: body.openid,
        session_key: body.session_key,
        iv: body.iv,
        encryptedData: body.encryptedData,
        userInfo: body.userInfo,
      }),
    );
  }

  @Post('bind')
  @UseGuards(JwtAuthGuard)
  async bind(@CurrentUser() user: any, @Body() body: any) {
    return ok200(await this.svc.bind(user.id, body.mobile));
  }

  @Post('thirdOauthInfo')
  async thirdOauthInfo() {
    throw new BadRequestException('暂未实现');
  }

  @Post('unbindThirdOauth')
  @UseGuards(JwtAuthGuard)
  async unbindThirdOauth(@CurrentUser() user: any) {
    return ok200(true);
  }
}

/* ===================== 短信验证码 ===================== */

@Controller('order/sms')
export class OrderSmsController {
  constructor(private readonly svc: OrderService) {}

  @Post('send')
  async send(@Body() body: any) {
    return ok200(await this.svc.sendSms(body.mobile));
  }
}
