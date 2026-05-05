import { IsEmail, IsOptional, IsString, Matches, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsEmail({}, { message: 'Debes indicar un correo electrónico válido.' })
  email?: string;

  @ValidateIf((o) => Boolean((o.newPassword ?? '').trim()))
  @IsString({ message: 'Indica tu contraseña actual.' })
  @MinLength(1, { message: 'Indica tu contraseña actual.' })
  currentPassword?: string;

  @ValidateIf((o) => Boolean((o.newPassword ?? '').trim()))
  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'La nueva contraseña debe incluir al menos una letra y un número.',
  })
  newPassword?: string;
}
