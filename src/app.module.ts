import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HistoryLaboralModule } from './modules/history-laboral/history-laboral.module';
import { PdfProcessingModule } from './modules/pdf-processing/pdf-processing.module';
import { LoggerService } from './common/services/logger.service';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    HistoryLaboralModule,
    PdfProcessingModule,
  ],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimitMiddleware)
      .exclude('docs')
      .forRoutes('history-laboral/upload');
  }
} 