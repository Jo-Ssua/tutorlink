import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, UserStatus, VerificationStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AdminApplicationsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: VerificationStatus, default: VerificationStatus.PENDING })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status: VerificationStatus = VerificationStatus.PENDING;

  @ApiPropertyOptional({ example: 'ana' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class RejectTutorApplicationDto {
  @ApiProperty({ example: 'La evidencia academica no corresponde a la materia declarada' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string;
}

export class AdminSubjectsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: VerificationStatus, default: VerificationStatus.PENDING })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status: VerificationStatus = VerificationStatus.PENDING;
}

export class RejectTutorSubjectDto {
  @ApiPropertyOptional({ example: 'El soporte no es legible' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class AdminUsersQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: 'ana' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}
