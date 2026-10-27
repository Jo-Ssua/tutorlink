import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'Ana Maria Torres' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ example: 'ana.torres@universidad.edu.co' })
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'TutorLink123*', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'password debe incluir mayuscula, minuscula y numero',
  })
  password: string;

  @ApiPropertyOptional({ example: '20231001' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  studentCode?: string;

  @ApiPropertyOptional({ example: '8c0f2a50-6f7a-4d3d-a4a5-6b1e8f0d9c11' })
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  semester?: number;
}

export class VerifyEmailDto {
  @ApiProperty({ example: 'ana.torres@universidad.edu.co' })
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code debe tener 6 digitos' })
  code: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'ana.torres@universidad.edu.co' })
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;
}

export class LoginDto {
  @ApiProperty({ example: 'ana.torres@universidad.edu.co' })
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'TutorLink123*' })
  @IsString()
  @MinLength(8)
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token entregado por /auth/login' })
  @IsString()
  refreshToken: string;
}
