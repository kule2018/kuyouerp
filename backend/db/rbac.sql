-- RBAC 权限系统建表与种子数据（无反引号，便于命令行执行）
-- 在 kuyou 库执行；所有语句幂等（IF NOT EXISTS / ON DUPLICATE KEY UPDATE）。

CREATE TABLE IF NOT EXISTS rbac_role (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(50) NOT NULL DEFAULT '',
  code varchar(50) NOT NULL DEFAULT '',
  data_scope varchar(20) NOT NULL DEFAULT 'all' COMMENT 'all=全部数据; custom=仅授权仓库',
  status varchar(20) NOT NULL DEFAULT 'normal',
  sort int NOT NULL DEFAULT 0,
  remark varchar(255) DEFAULT NULL,
  createtime bigint DEFAULT NULL,
  updatetime bigint DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rbac_permission (
  id int NOT NULL AUTO_INCREMENT,
  type varchar(20) NOT NULL DEFAULT 'menu' COMMENT 'menu|button|api|*',
  code varchar(120) NOT NULL DEFAULT '',
  name varchar(100) NOT NULL DEFAULT '',
  parent_id int NOT NULL DEFAULT 0,
  sort int NOT NULL DEFAULT 0,
  remark varchar(255) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rbac_role_permission (
  id int NOT NULL AUTO_INCREMENT,
  role_id int NOT NULL,
  permission_id int NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_role_perm (role_id, permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rbac_role_store (
  id int NOT NULL AUTO_INCREMENT,
  role_id int NOT NULL,
  store_id int NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_role_store (role_id, store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO rbac_role (id, name, code, data_scope, status, sort, createtime, updatetime)
VALUES (1, 'Super Admin', 'super_admin', 'all', 'normal', 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE name=VALUES(name), data_scope=VALUES(data_scope);

INSERT INTO rbac_permission (type, code, name, parent_id, sort)
VALUES ('*', '*', 'All Permissions', 0, 0)
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO rbac_role_permission (role_id, permission_id)
SELECT 1, p.id FROM rbac_permission p WHERE p.code='*'
ON DUPLICATE KEY UPDATE permission_id=permission_id;

UPDATE admin SET role_id=1 WHERE username='admin';
