import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, Modality } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
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

export class QuoteBookingDto {
  @ApiProperty({ description: 'ID del perfil de tutor' })
  @IsUUID('all', { message: 'Debes seleccionar un tutor valido' })
  tutorProfileId: string;

  @ApiProperty({ description: 'ID de la franja disponible (fecha y hora)' })
  @IsUUID('all', { message: 'Debes seleccionar una fecha y hora disponibles' })
  slotId: string;
}

export class CreateBookingDto extends QuoteBookingDto {
  @ApiProperty({ example: '4ef1f1f7-1f2f-4d4e-9f1e-2f3a4b5c6d7e' })
  @IsUUID('all', { message: 'Debes seleccionar la materia de la tutoria' })
  subjectId: string;

  @ApiProperty({ example: 'Preparacion para el parcial de estructuras de datos' })
  @Transform(trim)
  @IsString({ message: 'Debes indicar el tema o la necesidad academica' })
  @MinLength(3, { message: 'El tema o necesidad debe tener al menos 3 caracteres' })
  @MaxLength(200, { message: 'El tema o necesidad no puede superar los 200 caracteres' })
  topic: string;

  @ApiProperty({
    enum: [Modality.VIRTUAL, Modality.IN_PERSON],
    example: Modality.VIRTUAL,
    description:
      'Modalidad elegida por el estudiante. Debe ser compatible con la franja: si la franja es HYBRID puede ser VIRTUAL o IN_PERSON.',
  })
  @IsIn([Modality.VIRTUAL, Modality.IN_PERSON], {
    message: 'Debes elegir la modalidad de la tutoria (VIRTUAL o IN_PERSON)',
  })
  modality: Modality;

  @ApiPropertyOptional({ example: 'Necesito repasar arboles AVL y grafos.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000, { message: 'La descripcion no puede superar los 2000 caracteres' })
  description?: string;
}

export class BookingListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class SimulatedPaymentDto {
  @ApiProperty({
    example: true,
    description: 'Confirma el pago simulado. No se procesan datos bancarios reales.',
  })
  @Type(() => Boolean)
  @IsBoolean()
  simulatePayment: boolean;
}

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Cambio de horario academico' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RejectBookingDto {
  @ApiPropertyOptional({ example: 'No tengo disponibilidad para ese tema' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string;
}
