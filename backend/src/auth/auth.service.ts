import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role, User } from './entities/user.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { login: dto.login } });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return {
      token: this.jwt.sign({
        sub: user.id,
        login: user.login,
        role: user.role,
      }),
      user: this.safeUser(user),
    };
  }

  async createUser(dto: CreateUserDto) {
    const exists = await this.userRepo.findOne({ where: { login: dto.login } });
    if (exists) throw new ConflictException('Login already taken');

    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      login: dto.login,
      password: hash,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      role: dto.role ?? Role.CLIENT_ADMIN,
      clientId: dto.clientId ?? null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.userRepo.save(user);

    this.logger.log(`User created: ${saved.login} (${saved.role})`);
    return this.safeUser(saved);
  }

  async findAll() {
    const users = await this.userRepo.find({ order: { createdAt: 'DESC' } });
    return users.map((u) => this.safeUser(u));
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async resetPassword(id: number, newPassword: string): Promise<void> {
    const user = await this.findOne(id);
    user.password = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
    this.logger.log(`Password reset for user #${id} (${user.login})`);
  }

  async changePassword(
    id: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findOne(id);
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
  }

  async toggleActive(id: number): Promise<{ isActive: boolean }> {
    const user = await this.findOne(id);
    user.isActive = !user.isActive;
    await this.userRepo.save(user);
    return { isActive: user.isActive };
  }

  /** Auto-create super admin on first boot if no users exist */
  async seedSuperAdmin() {
    const count = await this.userRepo.count();
    if (count > 0) return;

    await this.createUser({
      login: 'admin',
      password: 'admin123',
      role: Role.SUPER_ADMIN,
    });
    this.logger.warn(
      'Default super admin created: login=admin / password=admin123',
    );
  }

  /** Strip password from user object before returning */
  private safeUser(user: User) {
    return {
      id: user.id,
      login: user.login,
      email: user.email,
      phone: user.phone,
      role: user.role,
      clientId: user.clientId,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
