import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Admin } from './admin.entity';
import { LoginDto } from './auth.dto';
import { RbacService } from '../rbac/rbac.service';

/**
 * 鉴权服务
 * - 校验用户名/密码（复刻 FastAdmin：password = md5(md5(pwd)+salt)）
 * - 签发 JWT（携带 roleId / dataScope）
 * - 登录时一并返回权限码、数据范围、授权仓库，供前端做菜单/按钮/数据权限
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
    private readonly jwtService: JwtService,
    private readonly rbac: RbacService,
  ) {}

  /** md5 工具 */
  private md5(s: string): string {
    return createHash('md5').update(s).digest('hex');
  }

  /** 校验用户，成功返回脱敏后的用户对象 */
  async validateUser(username: string, password: string): Promise<Admin> {
    const user = await this.adminRepo.findOne({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('账号不存在');
    }
    if (user.status !== 'normal') {
      throw new UnauthorizedException('账号已被禁用');
    }
    const hash = this.md5(this.md5(password) + user.salt);
    if (hash !== user.password) {
      // 失败次数累加
      await this.adminRepo.update(user.id, { loginfailure: (user.loginfailure || 0) + 1 });
      throw new UnauthorizedException('密码错误');
    }
    // 登录成功：更新登录信息
    await this.adminRepo.update(user.id, {
      loginfailure: 0,
      logintime: Date.now(),
      token: this.md5(String(Date.now()) + user.salt),
    });
    return user;
  }

  /** 登录并签发 token，返回用户与权限信息 */
  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.username, dto.password);
    const roleId = user.roleId || 0;
    const perms = await this.rbac.getPermissions(roleId);
    const scope = await this.rbac.getDataScope(roleId);
    const role = await this.rbac.getRole(roleId);

    const payload = {
      sub: user.id,
      username: user.username,
      roleId,
      dataScope: scope.dataScope,
    };
    // 显式指定 2 小时有效期（数字=秒），避免字符串 '7200' 被 jsonwebtoken 解析成 7200 毫秒≈7 秒
    const token = this.jwtService.sign(payload, { expiresIn: 7200 });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        roleId,
        roleName: role?.name || (roleId ? '' : '超级管理员'),
      },
      // 权限码集合（含 '*' 表示全部）
      permissions: perms,
      // 数据范围：all=全部；custom=仅授权仓库
      dataScope: scope.dataScope,
      // 授权仓库 id 列表（dataScope=custom 时有效，all 时为 null）
      stores: scope.storeIds,
    };
  }
}
