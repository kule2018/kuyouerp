-- ============================================================
-- kuyou 重构版 - AI 能力层建表（schema.sql 之后执行）
-- 这些表为新增能力，原始 install.sql 不含，需单独建表。
-- 与 src/modules/ai/ai.entities.ts 一一对应。
-- ============================================================

CREATE TABLE IF NOT EXISTS `kuyou_ai_model_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL DEFAULT '' COMMENT '配置名称',
  `provider` varchar(50) NOT NULL DEFAULT 'openai' COMMENT '供应商(openai/deepseek/...)',
  `base_url` varchar(255) NOT NULL DEFAULT '' COMMENT 'OpenAI 兼容接口地址',
  `api_key` varchar(255) NOT NULL DEFAULT '' COMMENT 'API Key',
  `model` varchar(100) NOT NULL DEFAULT '' COMMENT '模型名称',
  `temperature` double(10,4) NOT NULL DEFAULT '0.7000' COMMENT '温度',
  `max_tokens` int(11) NOT NULL DEFAULT '2048' COMMENT '最大 token',
  `enabled` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `createtime` bigint(20) DEFAULT NULL COMMENT '创建时间',
  `updatetime` bigint(20) DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 模型配置（数据库化）';

CREATE TABLE IF NOT EXISTS `kuyou_ai_prompt_template` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(100) NOT NULL DEFAULT '' COMMENT '模板编码(唯一)',
  `name` varchar(100) NOT NULL DEFAULT '' COMMENT '模板名称',
  `content` text COMMENT '模板内容，支持 {{var}} 占位',
  `variables` varchar(255) DEFAULT '' COMMENT '变量名(逗号分隔)',
  `description` varchar(255) DEFAULT '' COMMENT '说明',
  `createtime` bigint(20) DEFAULT NULL COMMENT '创建时间',
  `updatetime` bigint(20) DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI Prompt 模板';

CREATE TABLE IF NOT EXISTS `kuyou_ai_tool` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL DEFAULT '' COMMENT '工具名称(函数名)',
  `description` varchar(500) NOT NULL DEFAULT '' COMMENT '工具描述',
  `parameters` text COMMENT 'JSON Schema 参数定义',
  `enabled` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `createtime` bigint(20) DEFAULT NULL COMMENT '创建时间',
  `updatetime` bigint(20) DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 工具注册元数据';

CREATE TABLE IF NOT EXISTS `kuyou_ai_knowledge` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL DEFAULT '' COMMENT '标题',
  `content` text COMMENT '正文',
  `keywords` varchar(500) DEFAULT '' COMMENT '关键词(逗号分隔)',
  `source` varchar(255) DEFAULT '' COMMENT '来源',
  `createtime` bigint(20) DEFAULT NULL COMMENT '创建时间',
  `updatetime` bigint(20) DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 知识库（关键词检索语料）';

CREATE TABLE IF NOT EXISTS `kuyou_ai_call_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `model_config_id` int(11) DEFAULT NULL COMMENT '模型配置ID',
  `model` varchar(100) DEFAULT NULL COMMENT '实际模型',
  `prompt` text COMMENT '系统提示/目标',
  `request` text COMMENT '请求体(JSON)',
  `response` text COMMENT '响应内容',
  `prompt_tokens` int(11) DEFAULT NULL COMMENT '输入token',
  `completion_tokens` int(11) DEFAULT NULL COMMENT '输出token',
  `total_tokens` int(11) DEFAULT NULL COMMENT '总token',
  `duration_ms` int(11) DEFAULT NULL COMMENT '耗时(ms)',
  `status` tinyint(4) NOT NULL DEFAULT '1' COMMENT '状态:1成功,0失败',
  `error` text COMMENT '错误信息',
  `createtime` bigint(20) DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 调用日志';

CREATE TABLE IF NOT EXISTS `kuyou_ai_tool_call_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `call_log_id` int(11) DEFAULT NULL COMMENT '关联AI调用日志ID',
  `tool_name` varchar(100) DEFAULT NULL COMMENT '工具名',
  `arguments` text COMMENT '入参(JSON)',
  `result` text COMMENT '返回结果',
  `status` tinyint(4) NOT NULL DEFAULT '1' COMMENT '状态:1成功,0失败',
  `duration_ms` int(11) DEFAULT NULL COMMENT '耗时(ms)',
  `createtime` bigint(20) DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 工具调用日志';
