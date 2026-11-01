import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppletService } from './applet.service';

/**
 * 生产小程序后端接口
 * 路由前缀：/kuyou/applet/<group>/<action>
 * 与小程序端 request/apis 的相对路径一一对应（小程序 BASE_URL 改为 /kuyou/applet/）。
 * 鉴权：Bearer Token（与后台一致）；未登录返回 { code: 401, msg: '请先登陆' }。
 * 返回：{ code: 200, data, msg }（与小程序 request.js 的 code === 200 约定一致）。
 */
@Controller('applet')
export class AppletController {
  constructor(private readonly svc: AppletService) {}

  @Post('commons/upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: any) {
    return this.svc.saveUpload(file);
  }

  @Post(':group/:action')
  async dispatch(
    @Param('group') group: string,
    @Param('action') action: string,
    @Body() body: any,
    @Headers('authorization') auth: string,
    @Headers('token') token: string,
  ) {
    const header = auth || token || '';
    return this.svc.dispatch(group, action, body, header);
  }
}
