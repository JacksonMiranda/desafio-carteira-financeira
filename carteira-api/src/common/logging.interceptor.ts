import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// Loga cada requisição HTTP com método, rota, status e latência. Dá rastro
// mínimo de observabilidade sem acoplar a uma stack externa.
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const { method, url } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = http.getResponse<Response>();
        const elapsed = Date.now() - startedAt;
        this.logger.log(`${method} ${url} ${response.statusCode} - ${elapsed}ms`);
      }),
    );
  }
}
