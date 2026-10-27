import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Modality, TutoringRequestStatus, Urgency } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateStudyMatchRequestDto {
  @ApiProperty({ description: 'Materia del pensum oficial' })
  @IsUUID()
  subjectId: string;

  @ApiPropertyOptional({ description: 'Profesor indicado por el estudiante' })
  @IsOptional()
  @IsUUID()
  professorId?: string;

  @ApiProperty({ example: 'Parcial de estructuras de datos manana' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  topic: string;

  @ApiPropertyOptional({ example: 'Necesito repasar arboles AVL y recorridos.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: Urgency, example: Urgency.CRITICAL })
  @IsEnum(Urgency)
  urgency: Urgency;

  @ApiProperty({ enum: Modality, example: Modality.VIRTUAL })
  @IsEnum(Modality)
  modality: Modality;

  @ApiProperty({ example: '2026-10-27T15:00:00.000Z' })
  @IsISO8601()
  availableFrom: string;

  @ApiProperty({ example: '2026-10-27T21:00:00.000Z' })
  @IsISO8601()
  availableTo: string;
}

export enum ProposalResponseAction {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
}

export class RespondProposalDto {
  @ApiProperty({ enum: ProposalResponseAction, example: ProposalResponseAction.ACCEPT })
  @IsEnum(ProposalResponseAction)
  action: ProposalResponseAction;

  @ApiPropertyOptional({ example: 'No cubro ese tema con ese nivel de urgencia' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ConfirmProposalDto {
  @ApiProperty({ example: true, description: 'Aceptar o rechazar la propuesta del tutor' })
  @Type(() => Boolean)
  @IsBoolean()
  accept: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Confirmar pago simulado. Obligatorio cuando accept=true.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  simulatePayment?: boolean;

  @ApiPropertyOptional({ example: 'El horario ya no me sirve' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

export class StudyMatchRequestListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TutoringRequestStatus })
  @IsOptional()
  @IsEnum(TutoringRequestStatus)
  status?: TutoringRequestStatus;
}
