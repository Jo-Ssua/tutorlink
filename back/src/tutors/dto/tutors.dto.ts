import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, Modality } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class TutorSubjectApplicationDto {
  @ApiProperty({ example: '4ef1f1f7-1f2f-4d4e-9f1e-2f3a4b5c6d7e' })
  @IsUUID()
  subjectId: string;

  @ApiPropertyOptional({ example: 'https://storage.tutorlink.edu/evidencias/notas.pdf' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  evidenceUrl?: string;
}

export class ApplyTutorDto {
  @ApiPropertyOptional({ example: 'Estudiante de Ingenieria de Sistemas con enfoque en algoritmos.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears: number;

  @ApiProperty({ example: 45000, description: 'Tarifa por hora en COP' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  hourlyRate: number;

  @ApiProperty({ example: [Modality.VIRTUAL, Modality.IN_PERSON], enum: Modality, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsEnum(Modality, { each: true })
  modalities: Modality[];

  @ApiProperty({ type: [TutorSubjectApplicationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TutorSubjectApplicationDto)
  subjects: TutorSubjectApplicationDto[];

  @ApiPropertyOptional({
    type: [String],
    example: ['a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'],
    description: 'Profesores con los que el tutor tiene experiencia',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  professorIds?: string[];
}

export class UpdateTutorProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears?: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  hourlyRate?: number;

  @ApiPropertyOptional({ enum: Modality, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsEnum(Modality, { each: true })
  modalities?: Modality[];

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(80)
  maxWeeklySessions?: number;

  @ApiPropertyOptional({ example: true, description: 'Pausar o reactivar la oferta de tutorias' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddTutorSubjectDto {
  @ApiProperty()
  @IsUUID()
  subjectId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  evidenceUrl?: string;
}

export class CreateAvailabilityDto {
  @ApiProperty({ example: '2026-10-28T14:00:00.000Z' })
  @IsISO8601()
  startAt: string;

  @ApiProperty({ example: '2026-10-28T15:00:00.000Z' })
  @IsISO8601()
  endAt: string;

  @ApiProperty({ enum: Modality, example: Modality.VIRTUAL })
  @IsEnum(Modality)
  modality: Modality;
}

export class UpdateAvailabilityDto {
  @ApiPropertyOptional({ example: '2026-10-28T14:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @ApiPropertyOptional({ example: '2026-10-28T15:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @ApiPropertyOptional({ enum: Modality })
  @IsOptional()
  @IsEnum(Modality)
  modality?: Modality;
}

export class AvailabilityQueryDto {
  @ApiPropertyOptional({ example: '2026-10-27T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-03T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: Modality })
  @IsOptional()
  @IsEnum(Modality)
  modality?: Modality;
}

export enum TutorSortBy {
  RELEVANCE = 'RELEVANCE',
  RATING = 'RATING',
  PRICE = 'PRICE',
  AVAILABILITY = 'AVAILABILITY',
}

export class TutorSearchQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  facultyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  professorId?: string;

  @ApiPropertyOptional({ example: 4.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ example: 80000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxRate?: number;

  @ApiPropertyOptional({ enum: Modality })
  @IsOptional()
  @IsEnum(Modality)
  modality?: Modality;

  @ApiPropertyOptional({ example: 'algoritmos' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: TutorSortBy, default: TutorSortBy.RELEVANCE })
  @IsOptional()
  @IsEnum(TutorSortBy)
  sortBy: TutorSortBy = TutorSortBy.RELEVANCE;
}

export class TutorHistoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}

export class TutorRequestsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}

export enum EarningsGroupBy {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

export class EarningsQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: EarningsGroupBy, default: EarningsGroupBy.MONTH })
  @IsOptional()
  @IsEnum(EarningsGroupBy)
  groupBy: EarningsGroupBy = EarningsGroupBy.MONTH;
}
