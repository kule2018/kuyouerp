import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ImportService } from './import.service';
import { ok } from '../../../common/utils/resp';

/**
 * 基础资料导入控制器
 *
 * 路由与源 kuyou 前端调用路径逐一对应：
 *   ajax/upload              上传（返回 /uploads/xxx.xlsx）
 *   kuyou/<实体>/import       导入（body 或 query 传 file；editstatus 控制是否允许更新）
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class ImportController {
  constructor(private readonly svc: ImportService) {}

  /* ---------------- 上传 ---------------- */

  /**
   * 上传导入文件（对应源 ajax/upload）
   * 返回结构与 FastAdmin 一致：{ code: 1, data: { url: '/uploads/xx.xlsx' } }
   */
  @Post('ajax/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req: any, _file: any, cb: any) => {
          const dir = path.join(process.cwd(), 'uploads');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req: any, file: any, cb: any) => {
          const ext = path.extname(file.originalname || '').toLowerCase() || '.xlsx';
          cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('未接收到上传文件');
    return { code: 1, msg: '上传成功', data: { url: `/uploads/${file.filename}` } };
  }

  /* ---------------- 各实体导入 ---------------- */

  /** 客户导入 */
  @Post('customers/import')
  async customers(@Body() body: any) {
    return this.svc.run('customers', body.file, this.editstatus(body), body.skulist || []);
  }

  /** 供应商导入 */
  @Post('suppliers/import')
  async suppliers(@Body() body: any) {
    return this.svc.run('suppliers', body.file, this.editstatus(body));
  }

  /** 商品导入（skulist 为选定的辅助属性 ID） */
  @Post('goods/import')
  async goods(@Body() body: any) {
    return this.svc.run('goods', body.file, this.editstatus(body), this.toArray(body.skulist));
  }

  /** 职员导入 */
  @Post('staff_member/import')
  async staffMember(@Body() body: any) {
    return this.svc.run('staff_member', body.file, this.editstatus(body));
  }

  /** 仓库导入 */
  @Post('stores/import')
  async stores(@Body() body: any) {
    return this.svc.run('stores', body.file, this.editstatus(body));
  }

  /** 客户物料编码导入 */
  @Post('customer_goodscoding/import')
  async customerGoodscoding(@Body() body: any) {
    return this.svc.run('customer_goodscoding', body.file, this.editstatus(body));
  }

  /** 工厂导入 */
  @Post('factory/import')
  async factory(@Body() body: any) {
    return this.svc.run('factory', body.file, this.editstatus(body));
  }

  /** 车间导入 */
  @Post('workshop/import')
  async workshop(@Body() body: any) {
    return this.svc.run('workshop', body.file, this.editstatus(body));
  }

  /**
   * 盘点单导入
   * 源前端以 GET ?file=xxx 调用，此处同时兼容 POST。
   */
  @Get('inventory/import')
  async inventoryGet(@Query() q: any) {
    return this.svc.run('inventory', q.file, 1);
  }

  @Post('inventory/import')
  async inventoryPost(@Body() body: any) {
    return this.svc.run('inventory', body.file, 1);
  }

  /**
   * 单据级 Excel 导入（购货单 / 销货单等）
   * body: { docType: 'kuyou_goods_purchase' | 'kuyou_goods_sales' | ..., file: '/uploads/xxx.xlsx', headRow?, dataStart? }
   * 解析后按「单据编号」分组，逐组调用 saveDoc 生成待审核单据。
   */
  @Post('document/import')
  async documentImport(@CurrentUser() user: any, @Body() body: any) {
    return ok(
      await this.svc.importDocument(body.docType, body.file, user, {
        headRow: body.headRow,
        dataStart: body.dataStart,
      }),
      '单据导入完成',
    );
  }

  /**
   * 通用导入（FastAdmin 默认导入行为）：按表头中文注释匹配数据库列
   * 声明在专用导入之后，保证 customers/goods 等专用路由优先命中。
   */
  @Post(':table/import')
  async generic(@Param('table') t: string, @Body() body: any) {
    return this.svc.run(t, body.file, this.editstatus(body), this.toArray(body.skulist));
  }

  /** editstatus 归一化：源默认 1（允许更新） */
  private editstatus(body: any): number {
    const v = body?.editstatus;
    return v === undefined || v === null || v === '' ? 1 : Number(v);
  }

  /** skulist 可能是数组或逗号串 */
  private toArray(v: any): any[] {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    return String(v)
      .split(',')
      .filter((x) => x !== '')
      .map((x) => Number(x));
  }
}

