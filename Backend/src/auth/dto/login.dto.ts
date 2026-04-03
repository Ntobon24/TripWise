import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Debes indicar un correo electrónico válido.' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'La contraseña es obligatoria.' })
  password: string;
}
