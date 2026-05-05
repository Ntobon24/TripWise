import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../user/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con este correo.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.users.create({
      email,
      name: dto.name.trim(),
      passwordHash,
    });
    const saved = await this.users.save(user);

    return {
      success: true,
      message: 'Registro completado correctamente.',
      user: {
        id: saved.id,
        email: saved.email,
        name: saved.name,
      },
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    const payload = { sub: user.id, email: user.email, name: user.name };
    const token = await this.jwt.signAsync(payload);

    return {
      success: true,
      message: 'Inicio de sesión correcto.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  logout() {
    return {
      success: true,
      message: 'Sesión cerrada (elimina el token en el cliente).',
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const newPwd = dto.newPassword?.trim();
    const currentPwd = dto.currentPassword?.trim();
    const wantsPwd = Boolean(newPwd);
    const hasCurrent = Boolean(currentPwd);
    if (wantsPwd !== hasCurrent) {
      throw new BadRequestException(
        wantsPwd
          ? 'Indica tu contraseña actual para cambiar la contraseña.'
          : 'Indica la nueva contraseña para completar el cambio.',
      );
    }

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const other = await this.users.findOne({ where: { email } });
      if (other && other.id !== userId) {
        throw new ConflictException('Ya existe una cuenta con este correo.');
      }
      user.email = email;
    }

    if (newPwd && currentPwd) {
      const withHash = await this.users
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.id = :id', { id: userId })
        .getOne();

      if (!withHash) {
        throw new NotFoundException('Usuario no encontrado.');
      }

      const ok = await bcrypt.compare(currentPwd, withHash.passwordHash);
      if (!ok) {
        throw new ForbiddenException('Credenciales no válidas.');
      }
      user.passwordHash = await bcrypt.hash(newPwd, 10);
    }

    const saved = await this.users.save(user);
    return {
      success: true,
      message: 'Perfil actualizado correctamente.',
      user: {
        id: saved.id,
        email: saved.email,
        name: saved.name,
      },
    };
  }
}
