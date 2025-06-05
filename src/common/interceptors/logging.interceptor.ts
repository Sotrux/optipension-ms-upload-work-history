import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../services/logger.service';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url, ip, headers } = req;
    const userId = req['user']?.sub; // Si tenemos un usuario autenticado
    
    const startTime = Date.now();
    
    this.logger.debug(
      `Request ${method} ${url}`,
      'HTTP',
      {
        method,
        url,
        ip,
        userId,
        userAgent: headers['user-agent']
      }
    );
    
    return next.handle().pipe(
      tap({
        next: (data: any) => {
          const response = context.switchToHttp().getResponse<Response>();
          const statusCode = response.statusCode;
          const duration = Date.now() - startTime;
          
          this.logger.logPerformance({
            timestamp: new Date().toISOString(),
            operation: `${method} ${url}`,
            duration,
            endpoint: url,
            status: statusCode,
            userId,
            metadata: {
              responseSize: JSON.stringify(data)?.length || 0,
              ip
            }
          });
          
          this.logger.debug(
            `Response ${method} ${url} ${statusCode}`,
            'HTTP',
            {
              statusCode,
              duration: `${duration}ms`,
              userId
            }
          );
        },
        error: (error: any) => {
          const duration = Date.now() - startTime;
          
          this.logger.logPerformance({
            timestamp: new Date().toISOString(),
            operation: `${method} ${url}`,
            duration,
            endpoint: url,
            status: error.status || 500,
            userId,
            metadata: {
              error: error.message,
              ip
            }
          });
          
          this.logger.error(
            `Error ${method} ${url}: ${error.message}`,
            error.stack,
            'HTTP',
            {
              duration: `${duration}ms`,
              statusCode: error.status || 500,
              userId
            }
          );
        }
      })
    );
  }
} 