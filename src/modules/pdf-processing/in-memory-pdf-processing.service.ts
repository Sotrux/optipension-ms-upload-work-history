import { Injectable, Logger } from '@nestjs/common';
import { PdfProcessingService } from './pdf-processing.service';
import { UploadPdfResponseDto } from './dto/upload-pdf-response.dto';
import * as fs from 'fs';
import * as path from 'path';

interface Job {
  id: string;
  data: {
    uploadId: number;
    s3Key: string;
    enqueueTime: string;
  };
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  result?: any;
  failReason?: string;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

@Injectable()
export class InMemoryPdfProcessingService implements PdfProcessingService {
  private readonly logger = new Logger(InMemoryPdfProcessingService.name);
  private jobs: Map<string, Job> = new Map();
  
  /**
   * Procesa un PDF recién subido para extraer datos preliminares (simulación)
   */
  async processUploadedPdf(
    userId: string,
    userName: string,
    pdfPath: string,
    originalFilename: string,
  ): Promise<UploadPdfResponseDto> {
    try {
      this.logger.log(`Procesando PDF para usuario ${userId}: ${pdfPath}`);
      
      // Verificar si el archivo existe
      if (!fs.existsSync(pdfPath)) {
        this.logger.error(`El archivo no existe: ${pdfPath}`);
        return {
          success: false,
          errorMessage: 'El archivo no existe',
          userId,
          userName,
          fileName: originalFilename,
        };
      }

      // Simular extracción de datos
      const document = '12345678';
      const fullName = 'USUARIO SIMULADO';
      const totalWeeks = 520.5;
      
      // Encolar para procesamiento detallado
      const jobId = await this.enqueueProcessing(
        parseInt(userId.replace(/\D/g, '')) || 999, // Convertir userId a número o usar 999 como fallback
        path.basename(pdfPath)
      );
      
      // Respuesta inmediata
      return {
        success: true,
        message: 'PDF recibido y en procesamiento (simulación)',
        userId,
        userName,
        document,
        fullName,
        totalWeeks,
        fileName: originalFilename,
        jobId,
      };
    } catch (error) {
      this.logger.error(`Error al procesar PDF: ${error.message}`);
      
      return {
        success: false,
        errorMessage: `Error interno al procesar el PDF: ${error.message}`,
        userId,
        userName,
        fileName: originalFilename,
      };
    }
  }
  
  async enqueueProcessing(uploadId: number, s3Key: string): Promise<string> {
    try {
      this.logger.log(`Encolando procesamiento para uploadId: ${uploadId}, s3Key: ${s3Key}`);
      
      const id = Date.now().toString();
      const job: Job = {
        id,
        data: {
          uploadId,
          s3Key,
          enqueueTime: new Date().toISOString(),
        },
        status: 'waiting',
        progress: 0,
        timestamp: Date.now(),
      };
      
      this.jobs.set(id, job);
      
      // Simular procesamiento asíncrono
      setTimeout(() => this.processPdf(id), 500);
      
      this.logger.log(`Job encolado correctamente, jobId: ${id}`);
      return id;
    } catch (error) {
      this.logger.error(`Error al encolar job: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = this.jobs.get(jobId);
      
      if (!job) {
        return { status: 'not_found' };
      }
      
      return {
        id: job.id,
        status: job.status,
        progress: job.progress,
        result: job.result,
        failReason: job.failReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      };
    } catch (error) {
      this.logger.error(`Error al obtener status del job ${jobId}: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  // Método privado para procesar el PDF
  private async processPdf(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      this.logger.error(`Job no encontrado: ${jobId}`);
      return;
    }
    
    try {
      job.status = 'active';
      job.processedOn = Date.now();
      job.progress = 10;
      
      this.logger.log(`Iniciando procesamiento del PDF: uploadId=${job.data.uploadId}, s3Key=${job.data.s3Key}`);
      
      // Verificar si el archivo existe en test-uploads (para pruebas locales)
      const localPath = path.join(process.cwd(), 'test-uploads', path.basename(job.data.s3Key));
      let fileExists = false;
      
      try {
        fileExists = fs.existsSync(localPath);
        if (fileExists) {
          this.logger.log(`Archivo encontrado localmente en: ${localPath}`);
        } else {
          this.logger.warn(`Archivo no encontrado localmente: ${localPath}`);
        }
      } catch (error) {
        this.logger.error(`Error al verificar archivo local: ${error.message}`);
      }
      
      // Simular procesamiento
      job.progress = 50;
      this.logger.log('Simulando procesamiento del PDF...');
      
      // Simular tiempo de procesamiento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      job.progress = 100;
      
      const durationMs = Date.now() - job.processedOn;
      
      this.logger.log(`Procesamiento completado en ${durationMs}ms`);
      
      // Actualizar el job con resultado
      job.status = 'completed';
      job.finishedOn = Date.now();
      job.result = {
        uploadId: job.data.uploadId,
        s3Key: job.data.s3Key,
        processingTimeMs: durationMs,
        success: true,
        fileFound: fileExists,
        // Aquí agregaríamos los datos extraídos en una implementación real
      };
    } catch (error) {
      this.logger.error(`Error procesando PDF: ${error.message}`, error.stack);
      
      job.status = 'failed';
      job.failReason = error.message;
      job.finishedOn = Date.now();
    }
  }
} 