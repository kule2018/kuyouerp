-- ============================================================
-- kuyou 重构版 - 种子数据（在 schema.sql 之后执行）
-- 主要补充 FastAdmin 核心 admin 表（install.sql 不含）与演示账号
-- ============================================================

-- 管理员表（对应 FastAdmin 核心表 admin）
CREATE TABLE IF NOT EXISTS `admin` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(20) NOT NULL DEFAULT '' COMMENT '用户名',
  `nickname` varchar(50) NOT NULL DEFAULT '' COMMENT '昵称',
  `password` varchar(32) NOT NULL DEFAULT '' COMMENT '密码(md5(md5(pwd)+salt))',
  `salt` varchar(30) NOT NULL DEFAULT '' COMMENT '密码盐',
  `avatar` varchar(255) DEFAULT NULL COMMENT '头像',
  `email` varchar(100) DEFAULT NULL COMMENT '邮箱',
  `loginfailure` tinyint(4) NOT NULL DEFAULT '0' COMMENT '失败次数',
  `logintime` bigint(16) DEFAULT NULL COMMENT '登录时间',
  `loginip` varchar(50) DEFAULT NULL COMMENT '登录IP',
  `createtime` bigint(16) DEFAULT NULL COMMENT '创建时间',
  `updatetime` bigint(16) DEFAULT NULL COMMENT '更新时间',
  `status` varchar(30) NOT NULL DEFAULT 'normal' COMMENT '状态',
  `token` varchar(59) DEFAULT NULL COMMENT '令牌',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员表';

-- 演示账号：admin / 123456（密码方案与 FastAdmin 完全一致）
INSERT INTO `admin` (`id`, `username`, `nickname`, `password`, `salt`, `status`, `createtime`)
VALUES (1, 'admin', '管理员', '7ff90868365e9295e9a0a673c2bfaafa', 'kuyou', 'normal', UNIX_TIMESTAMP() * 1000)
ON DUPLICATE KEY UPDATE id = id;
