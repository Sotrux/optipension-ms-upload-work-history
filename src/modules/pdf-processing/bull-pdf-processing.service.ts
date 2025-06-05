import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PdfProcessingService } from './pdf-processing.service';
import { UploadPdfResponseDto } from './dto/upload-pdf-response.dto';
import { PdfParserService } from './services/pdf-parser.service';
import { LoggerService } from '../../common/services/logger.service';
import * as path from 'path';
import { PdfProcessingConstants } from './constants/pdf-processing.constants';

@Injectable()
export class BullPdfProcessingService implements PdfProcessingService {
  private readonly logger = new Logger(BullPdfProcessingService.name);

  constructor(
    @InjectQueue('hlParsing') private readonly hlParsingQueue: Queue,
    private readonly loggerService: LoggerService,
    private readonly pdfParserService: PdfParserService,
  ) {}

  async processUploadedPdf(
    userId: string,
    userName: string,
    pdfPath: string,
    originalFilename: string,
  ): Promise<UploadPdfResponseDto> {
    try {
      // Obtener datos preliminares del PDF
      const preliminaryData = await this.pdfParserService.extractDataFromPdf(pdfPath);
      
      // Si no se pudo extraer información básica, devolver error
      if (!preliminaryData.success) {
        this.loggerService.log(
          PdfProcessingConstants.LOGS.ERROR_PROCESSING_PDF,
          `Error procesando PDF: ${preliminaryData.errorMessage}, userId: ${userId}, archivo: ${path.basename(pdfPath)}`
        );
        
        return {
          success: false,
          errorMessage: preliminaryData.errorMessage || 'Error al procesar el PDF',
          userId,
          userName,
          fileName: originalFilename,
        };
      }

      // Log de datos básicos extraídos
      this.loggerService.log(
        PdfProcessingConstants.LOGS.PRELIMINARY_DATA_EXTRACTED,
        `Datos preliminares extraídos: userId: ${userId}, documento: ${preliminaryData.document}, nombre: ${preliminaryData.fullName}, semanas: ${preliminaryData.totalWeeks}, archivo: ${originalFilename}`
      );

      // Encolar para procesamiento detallado en segundo plano
      const job = await this.hlParsingQueue.add(
        'process-pdf',
        {
          userId,
          userName,
          pdfPath,
          originalFilename,
          preliminaryData,
        },
        {
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      // Respuesta inmediata para el usuario
      return {
        success: true,
        message: 'PDF recibido y en procesamiento',
        userId,
        userName,
        document: preliminaryData.document,
        fullName: preliminaryData.fullName,
        totalWeeks: preliminaryData.totalWeeks,
        fileName: originalFilename,
        jobId: job.id.toString(),
      };
    } catch (error) {
      this.loggerService.log(
        PdfProcessingConstants.LOGS.ERROR_PROCESSING_PDF,
        `Error interno al procesar PDF: ${error.message}, userId: ${userId}, archivo: ${path.basename(pdfPath)}`
      );

      return {
        success: false,
        errorMessage: 'Error interno al procesar el PDF',
        userId,
        userName,
        fileName: originalFilename,
      };
    }
  }

  async enqueueProcessing(uploadId: number, s3Key: string): Promise<string> {
    try {
      this.logger.log(`Encolando procesamiento para uploadId: ${uploadId}, s3Key: ${s3Key}`);
      
      const job = await this.hlParsingQueue.add(
        'process-pdf', 
        { 
          uploadId, 
          s3Key,
          enqueueTime: new Date().toISOString() 
        }
      );
      
      this.logger.log(`Job encolado correctamente, jobId: ${job.id}`);
      return job.id.toString();
    } catch (error) {
      this.logger.error(`Error al encolar job: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.hlParsingQueue.getJob(jobId);
      
      if (!job) {
        return { status: 'not_found' };
      }

      const state = await job.getState();
      const progress = await job.progress();
      const result = job.returnvalue;
      const failReason = job.failedReason;
      
      return {
        id: job.id,
        status: state,
        progress: progress,
        result: result,
        failReason: failReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      };
    } catch (error) {
      this.logger.error(`Error al obtener status del job ${jobId}: ${error.message}`, error.stack);
      throw error;
    }
  }
} 