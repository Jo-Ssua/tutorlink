import { ApiProperty } from '@nestjs/swagger';

export class ApiSuccessResponseDto<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty()
  data: T;

  @ApiProperty({
    example: {
      timestamp: '2026-10-27T12:00:00.000Z',
      path: '/api/v1/auth/login',
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      statusCode: 200,
    },
  })
  meta: Record<string, unknown>;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({
    example: {
      code: 'VALIDATION_ERROR',
      message: 'La solicitud contiene datos invalidos',
      details: ['email must be an email'],
    },
  })
  error: {
    code: string;
    message: string;
    details?: unknown;
  };

  @ApiProperty()
  meta: Record<string, unknown>;
}
