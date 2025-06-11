// Este archivo se implementará en la Fase 3
// Contendrá la lógica de negocio para procesar los archivos PDF 

import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { UploadResponseDto, UploadFileData } from './dto/upload-response.dto';
import { ValidationError } from './interfaces/validation-error.interface';
import { LoggerService } from '../../common/services/logger.service';
import { MockSpacesService } from './services/mock-spaces.service';
import { UploadRepositoryService, CreateUploadData } from './services/upload-repository.service';
import { DocumentType } from './dto/upload-request.dto';
import { PdfProcessingService } from '../pdf-processing/pdf-processing.service';
import { HlHistoryLaboralUpload } from '@prisma/client';

@Injectable()
export class HistoryLaboralService {
  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
  private readonly ALLOWED_MIME_TYPES = ['application/pdf'];
  private readonly ALLOWED_EXTENSIONS = ['.pdf'];

  constructor(
    private readonly logger: LoggerService,
    private readonly mockSpacesService: MockSpacesService,
    private readonly uploadRepository: UploadRepositoryService,
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
    documentNumber: string,
    userId: string // ID del usuario obtenido del token JWT
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

      // Usar el userId real del token JWT
      const currentUserId = userId;

      // Verificar duplicados antes de procesar
      const existingUpload = await this.uploadRepository.findDuplicate(
        currentUserId,
        documentType,
        documentNumber,
        file.originalname
      );

      if (existingUpload) {
        this.logger.logFileOperation({
          timestamp: new Date().toISOString(),
          operation: 'upload',
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          status: 'failure',
          failureReason: 'DUPLICATE_FILE',
          userId: currentUserId,
          metadata: { existingUploadId: existingUpload.id }
        });

        throw new BadRequestException({
          code: 'DUPLICATE_FILE',
          message: 'Ya existe un archivo con el mismo nombre para este documento',
          details: { 
            existingFile: existingUpload.original_filename,
            uploadedAt: existingUpload.created_at 
          }
        });
      }

      // Subir archivo al mock storage
      const { key, url } = await this.mockSpacesService.uploadFile(
        file,
        documentType,
        documentNumber
      );

      // Persistir en base de datos
      let savedUpload: HlHistoryLaboralUpload;
      try {
        const uploadData: CreateUploadData = {
          userId: currentUserId,
          documentType,
          documentNumber,
          originalFilename: file.originalname,
          fileSize: file.size,
          spacesKey: key,
          spacesUrl: url,
          createdBy: currentUserId,
        };

        savedUpload = await this.uploadRepository.create(uploadData);
        
        this.logger.log(
          `Upload guardado en BD con ID: ${savedUpload.id}`,
          'HistoryLaboralService',
          { uploadId: savedUpload.id, spacesKey: key }
        );
      } catch (dbError) {
        // Si falla el guardado en BD, intentar limpiar el archivo subido
        try {
          await this.mockSpacesService.deleteFile(key);
        } catch (cleanupError) {
          this.logger.error(
            `Error limpiando archivo tras fallo de BD: ${cleanupError.message}`,
            cleanupError.stack,
            'HistoryLaboralService'
          );
        }

        this.logger.logError({
          timestamp: new Date().toISOString(),
          context: 'DATABASE_SAVE',
          error: {
            message: `Error guardando en BD: ${dbError.message}`,
            stack: dbError.stack
          },
          userId: currentUserId,
          metadata: { spacesKey: key, spacesUrl: url }
        });

        throw new InternalServerErrorException({
          code: 'DATABASE_ERROR',
          message: 'Error al guardar el archivo en la base de datos'
        });
      }

      // Log de éxito
      this.logger.logFileOperation({
        timestamp: new Date().toISOString(),
        operation: 'upload',
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: 'success',
        userId: currentUserId,
        metadata: {
          contentType: file.mimetype,
          encoding: file.encoding,
          spacesKey: key,
          spacesUrl: url,
          uploadId: savedUpload.id
        }
      });

      // Encolar el archivo para procesamiento usando el ID real
      try {
        await this.pdfProcessingService.enqueueProcessing(savedUpload.id, key);
        this.logger.debug(
          `Archivo encolado para procesamiento: ${key}`,
          'HistoryLaboralService',
          { uploadId: savedUpload.id }
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
        message: 'Archivo PDF válido recibido y guardado correctamente',
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

  /**
   * Obtener uploads por usuario
   */
  async getUserUploads(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      documentType?: DocumentType;
      documentNumber?: string;
    }
  ): Promise<HlHistoryLaboralUpload[]> {
    try {
      return await this.uploadRepository.findByUser(userId, options);
    } catch (error) {
      this.logger.logError({
        timestamp: new Date().toISOString(),
        context: 'GET_USER_UPLOADS',
        error: {
          message: `Error obteniendo uploads del usuario: ${error.message}`,
          stack: error.stack
        },
        userId,
        metadata: options
      });
      throw error;
    }
  }

  /**
   * Obtener upload por ID
   */
  async getUploadById(uploadId: number, userId?: string): Promise<HlHistoryLaboralUpload | null> {
    try {
      const upload = await this.uploadRepository.findById(uploadId);
      
      // Verificar ownership si se proporciona userId
      if (upload && userId && upload.user_id !== userId) {
        this.logger.logError({
          timestamp: new Date().toISOString(),
          context: 'UNAUTHORIZED_ACCESS',
          error: {
            message: 'Usuario intenta acceder a upload que no le pertenece'
          },
          userId,
          metadata: { uploadId, ownerId: upload.user_id }
        });
        return null; // No revelar que existe
      }

      return upload;
    } catch (error) {
      this.logger.logError({
        timestamp: new Date().toISOString(),
        context: 'GET_UPLOAD_BY_ID',
        error: {
          message: `Error obteniendo upload por ID: ${error.message}`,
          stack: error.stack
        },
        userId,
        metadata: { uploadId }
      });
      throw error;
    }
  }

  /**
   * Obtener estadísticas de uploads
   */
  async getUploadStatistics() {
    try {
      return await this.uploadRepository.getStatistics();
    } catch (error) {
      this.logger.logError({
        timestamp: new Date().toISOString(),
        context: 'GET_UPLOAD_STATISTICS',
        error: {
          message: `Error obteniendo estadísticas: ${error.message}`,
          stack: error.stack
        }
      });
      throw error;
    }
  }
} 