import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export function requestIdMiddleware(
  request: Request & { id?: string },
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.header('x-request-id');
  const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
  request.id = requestId;
  response.setHeader('x-request-id', requestId);
  next();
}
