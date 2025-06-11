// Este archivo se implementará en la Fase 3
// Contendrá el controlador con la ruta POST /optipension/api/history-laboral/upload 

import { Controller, Post, BadRequestException, UseInterceptors, UploadedFile, InternalServerErrorException, UseGuards, Body } from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { HistoryLaboralService } from './history-laboral.service';
import { UploadResponseDto } from './dto/upload-response.dto';
import { UploadRequestDto } from './dto/upload-request.dto';
import { LoggerService } from '../../common/services/logger.service';
import { AuthGuard, generateTestToken } from '../../common/guards/auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import * as path from 'path';

@ApiTags('Historia Laboral')
@Controller('history-laboral')
@ApiBearerAuth('JWT-auth')
export class HistoryLaboralController {
  constructor(
    private readonly historyLaboralService: HistoryLaboralService,
    private readonly logger: LoggerService
  ) {}

  @Post('upload')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { 
        fileSize: 2 * 1024 * 1024 // 2MB - Multer lanzará excepciones para archivos que excedan este tamaño
      },
      fileFilter: (req, file, callback) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedMimeTypes = ['application/pdf'];
        const allowedExtensions = ['.pdf'];
        
        // Validar si es un PDF
        if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
          return callback(null, true);
        }
        
        // Registrar rechazo del archivo
        const logger = new LoggerService(req.app.get('ConfigService'));
        logger.warn(
          'Archivo rechazado: formato no válido',
          'FileFilter',
          { 
            filename: file.originalname,
            mimetype: file.mimetype,
            extension: ext
          }
        );
        
        // En lugar de callback(null, false), lanzar un error explícitamente
        return callback(
          new BadRequestException({
            code: !allowedMimeTypes.includes(file.mimetype) ? 'INVALID_MIME_TYPE' : 'INVALID_EXTENSION',
            message: !allowedMimeTypes.includes(file.mimetype) 
              ? 'El archivo debe ser un PDF' 
              : 'El archivo debe tener extensión .pdf',
            details: { 
              received: !allowedMimeTypes.includes(file.mimetype) ? file.mimetype : ext, 
              allowed: !allowedMimeTypes.includes(file.mimetype) ? allowedMimeTypes : allowedExtensions 
            }
          }), 
          false
        );
      },
    })
  )
  @ApiOperation({ summary: 'Subir archivo PDF de historia laboral' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo PDF de historia laboral (máximo 2MB)'
        },
        documentType: {
          type: 'string',
          description: 'Tipo de documento'
        },
        documentNumber: {
          type: 'string',
          description: 'Número de documento'
        }
      },
      required: ['file', 'documentType', 'documentNumber']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Archivo PDF válido recibido correctamente',
    type: UploadResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Error de validación del archivo' 
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o expirado'
  })
  @ApiResponse({
    status: 429,
    description: 'Demasiadas solicitudes. Por favor, espere antes de intentar nuevamente.'
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadRequestDto: UploadRequestDto,
    @CurrentUser() user: JwtPayload
  ): Promise<UploadResponseDto> {
    try {
      this.logger.debug(
        'Procesando solicitud de carga de archivo', 
        'HistoryLaboralController',
        { fileReceived: !!file }
      );
      
      if (!file) {
        throw new BadRequestException('No se ha proporcionado ningún archivo');
      }
      
      this.logger.debug(
        `Archivo recibido: ${file.originalname}`,
        'HistoryLaboralController',
        { 
          fileDetails: { 
            name: file.originalname, 
            size: file.size, 
            mimetype: file.mimetype 
          } 
        }
      );
      
      return await this.historyLaboralService.uploadFile(
        file,
        uploadRequestDto.documentType,
        uploadRequestDto.documentNumber,
        user.sub // user_id del token JWT
      );
    } catch (error) {
      this.logger.error(
        `Error en uploadFile: ${error.message}`,
        error.stack,
        'HistoryLaboralController',
        { errorName: error.name, errorCode: error.code }
      );
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException('Error interno al procesar el archivo');
    }
  }

  // Endpoint temporal para generar tokens de prueba (solo desarrollo)
  @Post('generate-test-token')
  @ApiOperation({ summary: 'Generar token de prueba (solo desarrollo)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Token de prueba generado',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        userId: { type: 'string' },
        message: { type: 'string' }
      }
    }
  })
  generateTestToken() {
    const token = generateTestToken();
    
    return {
      success: true,
      message: 'Token de prueba generado (solo para desarrollo)',
      data: {
        token,
        userId: 'usuario-prueba',
        instructions: 'Usa este token en el header Authorization: Bearer <token>'
      }
    };
  }
} 