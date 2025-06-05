import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { PdfParserService } from '../services/pdf-parser.service';
import { LoggerService } from '../../../common/services/logger.service';
import { PdfProcessingConstants } from '../constants/pdf-processing.constants';
import * as path from 'path';

@Injectable()
@Processor('hlParsing')
export class PdfProcessingConsumer {
  private readonly logger = new Logger(PdfProcessingConsumer.name);

  constructor(
    private readonly pdfParserService: PdfParserService,
    private readonly loggerService: LoggerService,
  ) {}

  @Process('process-pdf')
  async processPdf(job: Job) {
    const { userId, userName, pdfPath, originalFilename, preliminaryData } = job.data;
    
    try {
      this.logger.log(`Iniciando procesamiento detallado del PDF: ${path.basename(pdfPath)}`);
      
      // Si ya tenemos datos preliminares, no es necesario volver a procesar todo el PDF
      // Pero podríamos realizar análisis adicionales o guardar en base de datos

      // Usar los datos preliminares que ya tenemos
      const { document, fullName, totalWeeks, periods } = preliminaryData;
      
      // Log de procesamiento completo
      this.loggerService.log(
        PdfProcessingConstants.LOGS.PDF_PROCESSING_COMPLETE,
        `Procesamiento completado: userId: ${userId}, documento: ${document}, nombre: ${fullName}, periodos: ${periods?.length || 0}`
      );
      
      // Aquí podríamos guardar en base de datos los resultados
      
      return {
        success: true,
        userId,
        userName,
        document,
        fullName,
        totalWeeks,
        periodsCount: periods?.length || 0,
        fileName: originalFilename,
      };
    } catch (error) {
      this.loggerService.log(
        PdfProcessingConstants.LOGS.ERROR_PROCESSING_PDF,
        `Error procesando PDF en segundo plano: ${error.message}, userId: ${userId}, archivo: ${path.basename(pdfPath)}`
      );
      
      return {
        success: false,
        error: error.message,
        userId,
        userName,
        fileName: originalFilename,
      };
    }
  }
} 