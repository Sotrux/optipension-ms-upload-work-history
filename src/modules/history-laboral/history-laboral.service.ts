// Este archivo se implementará en la Fase 3
// Contendrá la lógica de negocio para procesar los archivos PDF 

import { Injectable, BadRequestException } from '@nestjs/common';
import { UploadResponseDto, UploadFileData } from './dto/upload-response.dto';
import { ValidationError } from './interfaces/validation-error.interface';
import { LoggerService } from '../../common/services/logger.service';
import { MockSpacesService } from './services/mock-spaces.service';
import { DocumentType } from './dto/upload-request.dto';
import * as path from 'path';
import { PdfProcessingService } from '../pdf-processing/pdf-processing.service';

@Injectable()
export class HistoryLaboralService {
  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
  private readonly ALLOWED_MIME_TYPES = ['application/pdf'];
  private readonly ALLOWED_EXTENSIONS = ['.pdf'];

  constructor(
    private readonly logger: LoggerService,
    private readonly mockSpacesService: MockSpacesService,
    private readonly pdfProcessingService: PdfProcessingService
  ) {}

  private validateFile(file: Express.Multer.File): ValidationError | null {
    // Verificación inicial del archivo
    if (!file || !file.originalname || !file.mimetype) {
      const error = {
        code: 'INVALID_FILE',
        message: 'El archivo proporcionado no es válido',
        details: { received: file ? JSON.stringify(file) : 'undefined' }
      };
      
      this.logger.logError({
        timestamp: new Date().toISOString(),
        context: 'FILE_VALIDATION',
        error: {
          message: error.message,
          code: error.code
        },
        metadata: error.details
      });
      
      return error;
    }
    
    // Log inicio de validación
    this.logger.logFileOperation({
      timestamp: new Date().toISOString(),
      operation: 'validation',
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      status: 'success',
      metadata: {
        allowedMimeTypes: this.ALLOWED_MIME_TYPES,
        allowedExtensions: this.ALLOWED_EXTENSIONS,
        maxSize: this.MAX_FILE_SIZE
      }
    });

    // Validar tipo MIME
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      const error = {
        code: 'INVALID_MIME_TYPE',
        message: 'El archivo debe ser un PDF',
        details: { received: file.mimetype, allowed: this.ALLOWED_MIME_TYPES }
      };

      this.logger.logFileOperation({
        timestamp: new Date().toISOString(),
        operation: 'validation',
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: 'failure',
        failureReason: error.code,
        metadata: error.details
      });

      return error;
    }

    // Validar extensión - asegurándose de que existe un nombre
    const fileExtension = file.originalname.toLowerCase().slice(-4);
    if (!this.ALLOWED_EXTENSIONS.includes(fileExtension)) {
      const error = {
        code: 'INVALID_EXTENSION',
        message: 'El archivo debe tener extensión .pdf',
        details: { received: fileExtension, allowed: this.ALLOWED_EXTENSIONS }
      };

      this.logger.logFileOperation({
        timestamp: new Date().toISOString(),
        operation: 'validation',
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: 'failure',
        failureReason: error.code,
        metadata: error.details
      });

      return error;
    }

    // Validar tamaño
    if (file.size > this.MAX_FILE_SIZE) {
      const error = {
        code: 'FILE_TOO_LARGE',
        message: 'El archivo excede el tamaño máximo permitido (2MB)',
        details: { received: file.size, maxAllowed: this.MAX_FILE_SIZE }
      };

      this.logger.logFileOperation({
        timestamp: new Date().toISOString(),
        operation: 'validation',
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: 'failure',
        failureReason: error.code,
        metadata: error.details
      });

      return error;
    }

    return null;
  }

  async uploadFile(
    file: Express.Multer.File,
    documentType: DocumentType,
    documentNumber: string
  ): Promise<UploadResponseDto> {
    try {
      // Verificación adicional
      if (!file) {
        throw new BadRequestException({
          code: 'FILE_MISSING',
          message: 'No se ha proporcionado ningún archivo'
        });
      }
      
      this.logger.debug(
        `Procesando archivo en servicio: ${file.originalname}`,
        'HistoryLaboralService',
        { fileName: file.originalname, size: file.size, mimetype: file.mimetype }
      );
      
      const validationError = this.validateFile(file);
      
      if (validationError) {
        this.logger.logError({
          timestamp: new Date().toISOString(),
          context: 'UPLOAD_FILE',
          error: {
            message: validationError.message,
            code: validationError.code
          },
          metadata: validationError.details
        });

        throw new BadRequestException(validationError);
      }

      // Subir archivo al mock storage
      const { key, url } = await this.mockSpacesService.uploadFile(
        file,
        documentType,
        documentNumber
      );

      // Log de éxito
      this.logger.logFileOperation({
        timestamp: new Date().toISOString(),
        operation: 'upload',
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: 'success',
        metadata: {
          contentType: file.mimetype,
          encoding: file.encoding,
          spacesKey: key,
          spacesUrl: url
        }
      });

      // Encolar el archivo para procesamiento
      try {
        // TODO: Obtener el uploadId real de la base de datos
        const mockUploadId = new Date().getTime(); // Simulamos un ID por ahora
        await this.pdfProcessingService.enqueueProcessing(mockUploadId, key);
        this.logger.debug(
          `Archivo encolado para procesamiento: ${key}`,
          'HistoryLaboralService'
        );
      } catch (enqueueError) {
        this.logger.logError({
          timestamp: new Date().toISOString(),
          context: 'ENQUEUE_PDF_PROCESSING',
          error: {
            message: `Error al encolar para procesamiento: ${enqueueError.message}`,
            stack: enqueueError.stack
          }
        });
        // No fallaremos la subida si falla el encolado, solo loggeamos el error
      }

      const responseData: UploadFileData = {
        fileName: file.originalname,
        fileSize: file.size,
        spacesUrl: url
      };

      return {
        success: true,
        message: 'Archivo PDF válido recibido correctamente',
        data: responseData
      };
    } catch (error) {
      // Log de error no esperado
      if (!(error instanceof BadRequestException)) {
        this.logger.logError({
          timestamp: new Date().toISOString(),
          context: 'UPLOAD_FILE',
          error: {
            message: 'Error inesperado al procesar el archivo',
            stack: error.stack
          }
        });
      }
      throw error;
    }
  }
} 