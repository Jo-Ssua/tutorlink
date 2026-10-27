import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface RequestWithId extends Request {
  id?: string;
}

interface ErrorPayload {
  code?: string;
  message?: string | string[];
  error?: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithId>();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Ocurrio un error inesperado';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      const normalized = typeof payload === 'string' ? { message: payload } : (payload as ErrorPayload);
      const rawMessage = normalized.message;
      const messages = Array.isArray(rawMessage) ? rawMessage : undefined;

      code = normalized.code ?? (messages ? 'VALIDATION_ERROR' : this.defaultCode(status));
      message = messages
        ? 'La solicitud contiene datos invalidos'
        : String(rawMessage ?? exception.message);
      details = normalized.details ?? messages;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'RESOURCE_CONFLICT';
        message = 'Ya existe un registro con los datos enviados';
        details = exception.meta;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'RESOURCE_NOT_FOUND';
        message = 'El recurso solicitado no existe';
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        code = 'RELATED_RESOURCE_INVALID';
        message = 'La relacion con el recurso indicado no es valida';
      } else {
        status = HttpStatus.BAD_REQUEST;
        code = `PRISMA_${exception.code}`;
        message = 'No fue posible completar la operacion en la base de datos';
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `[${request.id ?? 'no-request-id'}] ${exception.message}`,
        exception.stack,
      );
    }

    if (status >= 500) {
      this.logger.error(
        `[${request.id ?? 'no-request-id'}] ${request.method} ${request.originalUrl} -> ${status} ${code}`,
      );
    } else {
      this.logger.warn(
        `[${request.id ?? 'no-request-id'}] ${request.method} ${request.originalUrl} -> ${status} ${code}: ${message}`,
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.originalUrl,
        requestId: request.id,
      },
    });
  }

  private defaultCode(status: number): string {
    const codes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
    };

    return codes[status] ?? 'HTTP_ERROR';
  }
}
