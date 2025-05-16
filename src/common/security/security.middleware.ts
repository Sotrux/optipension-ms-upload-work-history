import { Injectable, NestMiddleware } from '@nestjs/common';
import helmet from 'helmet';
import xssClean from 'xss-clean';
import expressSanitizer from 'express-sanitizer';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    helmet()(req, res, () => {
      xssClean()(req, res, () => {
        expressSanitizer()(req, res, next);
      });
    });
  }
}