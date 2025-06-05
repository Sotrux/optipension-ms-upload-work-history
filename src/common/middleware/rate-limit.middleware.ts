import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { LoggerService } from '../services/logger.service';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly limiter: RateLimitRequestHandler;

  constructor(private readonly logger: LoggerService) {
    this.limiter = rateLimit({
      windowMs: 60000, // 1 minuto
      max: 3, // límite de 3 peticiones por minuto
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        this.logger.warn('Rate limit exceeded', 'RATE_LIMIT', {
          ip: req.ip,
          endpoint: req.url,
          method: req.method
        });
        
        res.status(429).json({
          statusCode: 429,
          message: 'Too many requests, please try again later.',
          retryAfter: res.getHeader('Retry-After') || 60
        });
      }
    });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.limiter(req, res, next);
  }
} 