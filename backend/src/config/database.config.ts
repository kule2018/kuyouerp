import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { config as loadDotenv } from 'dotenv';

/**
 * 数据库配置（MySQL）
 * 对应原 kuyou 的 MySQL 库，表名前缀为 kuyou_。
 *
 * 注意：@nestjs/config 的 dotenv 是在 ConfigModule 初始化时才加载 .env，
 * 而本配置对象在模块导入阶段就会读取 process.env，此时 .env 尚未生效，
 * 会意外使用「系统/Shell 中残留的 DB_* 环境变量」并忽略 .env。
 * 因此这里显式用 dotenv 加载 .env，并让其对 DB_* 具备最高优先级。
 */
const dot = loadDotenv({ path: join(__dirname, '..', '..', '.env') });
const env = (dot.parsed || {}) as Record<string, string | undefined>;
const pick = (key: string, fallback?: string): string => {
  const v = env[key];
  return v !== undefined && v !== '' ? v : process.env[key] || fallback || '';
};

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: pick('DB_HOST', '127.0.0.1'),
  port: Number(pick('DB_PORT', '3306')),
  username: pick('DB_USERNAME', 'root'),
  password: pick('DB_PASSWORD', 'root'),
  database: pick('DB_DATABASE', 'kuyou'),
  charset: 'utf8mb4',
  timezone: '+08:00',
  autoLoadEntities: true,
  entities: [join(__dirname, '..', 'entities', '*.entity.{ts,js}')],
  // 生产环境应为 false，由 db/schema.sql 建表；本地调试可改为 true
  synchronize: pick('DB_SYNCHRONIZE') === 'true',
  logging: false,
};
