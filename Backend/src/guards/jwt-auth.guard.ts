import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers['authorization'] as string | undefined;

    if (!authorization) {
      throw new UnauthorizedException(
        'Debes iniciar sesión para acceder a este recurso.',
      );
    }

    const token = this.extractToken(authorization);

    try {
      const payload = this.jwtService.verify<{ sub: string; email: string; name: string }>(
        token,
      );
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }
  }

  private extractToken(authorization: string): string {
    const parts = authorization.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
    return authorization;
  }
}
