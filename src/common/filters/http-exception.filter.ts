import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../services/logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Si el error no es una HttpException, lo registramos en detalle
    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `Excepción no manejada: ${exception.message || 'Error desconocido'}`,
        exception.stack,
        'ExceptionFilter',
        {
          path: request.url,
          method: request.method,
          ip: request.ip,
          exception: exception.name || 'Error desconocido'
        }
      );
    }

    // Prepara la respuesta de error
    const errorResponse = {
      success: false,
      statusCode: status,
      message: exception.message || 'Error interno del servidor',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Envía la respuesta
    response.status(status).json(errorResponse);
  }
} 