import { Injectable, NestMiddleware } from '@nestjs/common';
import * as rateLimit from 'express-rate-limit'; // Se usa importación compatible con CommonJS

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const limiter = rateLimit.default({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100, // Máximo 100 solicitudes por IP en ese período
      message: "Demasiadas solicitudes desde esta IP, intenta más tarde.",
      standardHeaders: true, // Informa límites en headers
      legacyHeaders: false, // Deshabilita los headers obsoletos
    });

    return limiter(req, res, next);
  }
}