import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { PdfParserService } from '../services/pdf-parser.service';
import { LoggerService } from '../../../common/services/logger.service';
import { PdfProcessingConstants } from '../constants/pdf-processing.constants';
import { ExtractionRepositoryService } from '../../history-laboral/services/extraction-repository.service';
import * as path from 'path';

@Injectable()
@Processor('hlParsing')
export class PdfProcessingConsumer {
  private readonly logger = new Logger(PdfProcessingConsumer.name);

  constructor(
    private readonly pdfParserService: PdfParserService,
    private readonly loggerService: LoggerService,
    private readonly extractionRepository: ExtractionRepositoryService,
  ) {}

  @Process('process-pdf')
  async processPdf(job: Job) {
    const { userId, userName, pdfPath, originalFilename, preliminaryData, uploadId } = job.data;
    
    try {
      this.logger.log(`Iniciando procesamiento detallado del PDF: ${path.basename(pdfPath)}`);
      
      // Si ya tenemos datos preliminares, no es necesario volver a procesar todo el PDF
      // Pero podríamos realizar análisis adicionales o guardar en base de datos

      // Usar los datos preliminares que ya tenemos
      const { document, fullName, totalWeeks, periods, highRiskWeeks, extractionMeta } = preliminaryData;
      
      // Persistir los datos extraídos en la base de datos
      if (uploadId) {
        await this.extractionRepository.markAsProcessed(
          userId,
          uploadId,
          {
            fullName,
            document,
            totalWeeks,
            highRiskWeeks,
            periods,
            extractionMeta,
          }
        );
        
        this.logger.log(`Datos persistidos en BD para upload_id: ${uploadId}`);
      }
      
      // Log de procesamiento completo
      this.loggerService.log(
        PdfProcessingConstants.LOGS.PDF_PROCESSING_COMPLETE,
        `Procesamiento completado: userId: ${userId}, documento: ${document}, nombre: ${fullName?.substring(0, 10)}***, periodos: ${periods?.length || 0}, uploadId: ${uploadId}`
      );
      
      return {
        success: true,
        userId,
        userName,
        document,
        fullName,
        totalWeeks,
        periodsCount: periods?.length || 0,
        fileName: originalFilename,
        uploadId,
      };
    } catch (error) {
      this.logger.error(`Error procesando PDF: ${error.message}`);
      
      // Marcar como error en la base de datos si tenemos uploadId
      if (uploadId) {
        try {
          await this.extractionRepository.markAsError(
            userId,
            uploadId,
            error.message,
            { errorAt: new Date().toISOString(), fileName: originalFilename }
          );
          this.logger.log(`Error persistido en BD para upload_id: ${uploadId}`);
        } catch (dbError) {
          this.logger.error(`Error adicional al persistir en BD: ${dbError.message}`);
        }
      }
      
      this.loggerService.log(
        PdfProcessingConstants.LOGS.ERROR_PROCESSING_PDF,
        `Error procesando PDF en segundo plano: ${error.message}, userId: ${userId}, archivo: ${path.basename(pdfPath)}, uploadId: ${uploadId}`
      );
      
      return {
        success: false,
        error: error.message,
        userId,
        userName,
        fileName: originalFilename,
        uploadId,
      };
    }
  }
} 