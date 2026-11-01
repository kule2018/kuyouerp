-- ============================================================
-- kuyou 重构版 - 收付款核销 / 库存盘点 / 操作日志 建表
-- 在 schema.sql 之后执行（与后端新增业务模块对应）。
-- 收付款单据表(kuyou_collection/kuyou_payment)已在 schema.sql 中，
-- 这里补充：库存盘点单、操作日志。
-- ============================================================

CREATE TABLE IF NOT EXISTS `kuyou_stocktake` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) DEFAULT NULL,
  `purchase_code` varchar(50) DEFAULT NULL COMMENT '盘点单号',
  `purchase_time` bigint(16) DEFAULT NULL COMMENT '盘点日期',
  `stores_id` int(11) DEFAULT NULL COMMENT '仓库',
  `examine_status` enum('0','1') DEFAULT '0' COMMENT '审核状态:0=未审核,1=已审核',
  `examine_id` int(11) DEFAULT NULL COMMENT '审核人',
  `examine_time` bigint(16) DEFAULT NULL COMMENT '审核时间',
  `preparation_id` int(11) DEFAULT NULL COMMENT '制单人',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `createtime` bigint(16) DEFAULT NULL COMMENT '创建时间',
  `updatetime` bigint(16) DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `purchase_code` (`purchase_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存盘点单';

CREATE TABLE IF NOT EXISTS `kuyou_stocktake_info` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) DEFAULT NULL,
  `stocktake_id` int(11) DEFAULT NULL COMMENT '盘点单ID',
  `purchase_code` varchar(50) DEFAULT NULL COMMENT '盘点单号',
  `goods_id` int(11) DEFAULT NULL COMMENT '商品',
  `goods_code` varchar(30) DEFAULT NULL COMMENT '商品编号',
  `goods_name` varchar(255) DEFAULT NULL COMMENT '商品名称',
  `stores_id` int(11) DEFAULT NULL COMMENT '仓库',
  `system_stock` double(15,4) DEFAULT '0.0000' COMMENT '系统库存',
  `actual_stock` double(15,4) DEFAULT '0.0000' COMMENT '实盘库存',
  `profit_loss` double(15,4) DEFAULT '0.0000' COMMENT '盘盈(正)/盘亏(负)',
  `unit_cost` double(15,4) DEFAULT '0.0000' COMMENT '单位成本',
  `createtime` bigint(16) DEFAULT NULL COMMENT '创建时间',
  `updatetime` bigint(16) DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `stocktake_id` (`stocktake_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存盘点明细';

CREATE TABLE IF NOT EXISTS `kuyou_operate_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) DEFAULT NULL COMMENT '操作员ID',
  `username` varchar(100) DEFAULT NULL COMMENT '操作员',
  `module` varchar(100) DEFAULT NULL COMMENT '模块',
  `action` varchar(100) DEFAULT NULL COMMENT '操作',
  `ip` varchar(50) DEFAULT NULL COMMENT 'IP',
  `content` text COMMENT '操作内容',
  `createtime` bigint(16) DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `createtime` (`createtime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志';
