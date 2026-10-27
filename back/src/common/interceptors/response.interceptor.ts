import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface RequestWithId extends Request {
  id?: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data ?? null,
        meta: {
          timestamp: new Date().toISOString(),
          path: request.originalUrl,
          requestId: request.id,
          statusCode: response.statusCode,
        },
      })),
    );
  }
}
