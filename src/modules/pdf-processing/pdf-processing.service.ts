import { Injectable } from '@nestjs/common';
import { UploadPdfResponseDto } from './dto/upload-pdf-response.dto';

@Injectable()
export abstract class PdfProcessingService {
  /**
   * Procesa un PDF recién subido para extraer datos preliminares
   * @param userId ID del usuario
   * @param userName Nombre del usuario
   * @param pdfPath Ruta del archivo PDF
   * @param originalFilename Nombre original del archivo
   */
  abstract processUploadedPdf(
    userId: string,
    userName: string,
    pdfPath: string,
    originalFilename: string,
  ): Promise<UploadPdfResponseDto>;

  /**
   * Encola un trabajo para procesar un PDF de historia laboral
   * @param uploadId ID del archivo subido
   * @param s3Key Clave del archivo en DigitalOcean Spaces
   * @returns JobId del trabajo encolado
   */
  abstract enqueueProcessing(uploadId: number, s3Key: string): Promise<string>;

  /**
   * Obtiene el estado de un trabajo de procesamiento
   * @param jobId ID del trabajo
   * @returns Estado del trabajo
   */
  abstract getJobStatus(jobId: string): Promise<any>;
} 