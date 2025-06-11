import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PdfParserService } from './services/pdf-parser.service';
import { PdfLoaderService } from './services/pdf-loader.service';
import { ColpensionesValidatorService } from './services/colpensiones-validator.service';
import { AfiliadoExtractorService } from './services/afiliado-extractor.service';
import { PeriodosExtractorService } from './services/periodos-extractor.service';
import { PdfProcessingController } from './pdf-processing.controller';
import { PdfProcessingService } from './pdf-processing.service';
import { BullPdfProcessingService } from './bull-pdf-processing.service';
import { PdfProcessingConsumer } from './queue/pdf-processing.consumer';
import { LoggerService } from '../../common/services/logger.service';
import { ExtractionRepositoryService } from '../history-laboral/services/extraction-repository.service';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: parseInt(configService.get('REDIS_PORT', '6379')),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'hlParsing',
    }),
  ],
  controllers: [PdfProcessingController],
  providers: [
    // Servicios base
    LoggerService,
    PrismaService,
    PdfLoaderService,
    ColpensionesValidatorService,
    AfiliadoExtractorService,
    PeriodosExtractorService,
    PdfParserService,
    
    // Repositorios
    ExtractionRepositoryService,
    
    // Procesamiento de cola
    PdfProcessingConsumer,
    
    // Servicio de procesamiento de PDFs
    {
      provide: PdfProcessingService,
      useClass: BullPdfProcessingService,
    },
  ],
  exports: [PdfProcessingService, PdfParserService]
})
export class PdfProcessingModule {} 