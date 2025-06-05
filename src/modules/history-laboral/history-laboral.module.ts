import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { HistoryLaboralController } from './history-laboral.controller';
import { HistoryLaboralService } from './history-laboral.service';
import { LoggerService } from '../../common/services/logger.service';
import { MockSpacesService } from './services/mock-spaces.service';
import { PdfProcessingModule } from '../pdf-processing/pdf-processing.module';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
      },
    }),
    PdfProcessingModule,
  ],
  controllers: [HistoryLaboralController],
  providers: [HistoryLaboralService, LoggerService, MockSpacesService],
  exports: [HistoryLaboralService],
})
export class HistoryLaboralModule {} 