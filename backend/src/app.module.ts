import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';

import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { AiModule } from './modules/ai/ai.module';
import { DynamicCrudModule } from './modules/erp/dynamic-crud/dynamic-crud.module';
import { DocumentModule } from './modules/erp/document/document.module';
import { ReportModule } from './modules/erp/report/report.module';
import { SpecialModule } from './modules/erp/special/special.module';
import { InvoicingModule } from './modules/erp/invoicing/invoicing.module';
import { PrintModule } from './modules/erp/print/print.module';
import { StatsModule } from './modules/erp/stats/stats.module';
import { BomModule } from './modules/erp/bom/bom.module';
import { RelationModule } from './modules/erp/relation/relation.module';
import { LinkModule } from './modules/erp/link/link.module';
import { ImportModule } from './modules/erp/import/import.module';
import { RecycleModule } from './modules/erp/recycle/recycle.module';
import { MiscModule } from './modules/erp/misc/misc.module';
import { RetailModule } from './modules/erp/retail/retail.module';
import { ReconModule } from './modules/erp/recon/recon.module';
import { SummaryModule } from './modules/erp/summary/summary.module';
import { OrderModule } from './modules/erp/order/order.module';
import { AppletModule } from './modules/erp/applet/applet.module';
import { FinanceModule } from './modules/erp/finance/finance.module';
import { StocktakeModule } from './modules/erp/stocktake/stocktake.module';
import { DataModule } from './modules/erp/data/data.module';
import { CustomerGoodscodingModule } from './modules/erp/customer-goodscoding/customer-goodscoding.module';

/**
 * 根模块
 * 数据库使用 autoLoadEntities，各业务模块通过 forFeature 注册实体即可自动加载，
 * 与原 kuyou 的 156 张 kuyou_ 前缀表一一对应。
 * ERP 增删改查统一由 DynamicCrudModule 动态路由覆盖全部 156 表。
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '.env.example'] }),
    TypeOrmModule.forRoot(databaseConfig),
    AuthModule,
    RbacModule,
    AiModule,
    DocumentModule,
    ReportModule,
    SpecialModule,
    InvoicingModule,
    PrintModule,
    StatsModule,
    BomModule,
    RelationModule,
    LinkModule,
    ImportModule,
    RecycleModule,
    MiscModule,
    RetailModule,
    ReconModule,
    SummaryModule,
    OrderModule,
    AppletModule,
    FinanceModule,
    StocktakeModule,
    DataModule,
    CustomerGoodscodingModule,
    // 动态 CRUD 是 :table/* 通配路由，必须放在最后注册，
    // 否则会劫持 stats 等具体控制器的静态路由（如 /datainfo/index、/intercourse/index）
    DynamicCrudModule,
  ],
})
export class AppModule {}
