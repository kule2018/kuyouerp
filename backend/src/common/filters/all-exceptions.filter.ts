import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * 全局异常过滤器
 * 统一返回结构，与原 FastAdmin 错误返回保持一致：
 *   { code: 0, msg: <错误信息>, data: null }
 * 成功返回由业务层自行包装 { code:1, msg, data } 或 { total, rows }。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let msg = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res: any = exception.getResponse();
      if (typeof res === 'string') {
        msg = res;
      } else if (res && typeof res === 'object') {
        msg = res.message || res.error || exception.message;
        if (Array.isArray(msg)) msg = msg.join('; ');
      }
      // 小程序端以 msg === '请先登陆' 触发自动重新登录
      if (status === 401) msg = '请先登陆';
    } else if (exception instanceof Error) {
      msg = exception.message;
    }

    response.status(HttpStatus.OK).json({
      code: 0,
      msg,
      data: null,
    });
  }
}
