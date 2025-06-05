import { Controller, Post, Body, Get, Param, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { PdfProcessingService } from './pdf-processing.service';
import { PdfParserService } from './services/pdf-parser.service';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('PDF Processing')
@Controller('pdf-processing')
export class PdfProcessingController {
  constructor(
    private readonly pdfProcessingService: PdfProcessingService,
    private readonly pdfParserService: PdfParserService,
  ) {}

  @Post('process')
  @ApiOperation({ summary: 'Encolar un PDF para procesamiento' })
  @ApiResponse({ status: 201, description: 'PDF encolado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async enqueuePdfProcessing(
    @Body() data: { uploadId: number; s3Key: string },
  ) {
    const jobId = await this.pdfProcessingService.enqueueProcessing(
      data.uploadId,
      data.s3Key,
    );
    
    return {
      success: true,
      message: 'PDF encolado para procesamiento',
      data: {
        jobId,
        uploadId: data.uploadId,
        s3Key: data.s3Key,
      },
    };
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(process.cwd(), 'test-uploads');
          
          // Crear el directorio si no existe
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          // Formato esperado: <tipo_de_documento>-<numero_documento>-HL-<AAAAMMDD>.pdf
          const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          
          // Conservar la extensión del archivo original
          const extension = path.extname(file.originalname);
          
          // Valores por defecto
          let tipoDocumento = 'CC';  // Por defecto Cédula de Ciudadanía
          let numeroDocumento = 'PENDIENTE';
          
          // Intentar extraer información del nombre original si ya sigue el patrón
          const originalNameMatch = file.originalname.match(/^([A-Z]+)-(\d+)-HL-/);
          if (originalNameMatch) {
            tipoDocumento = originalNameMatch[1];
            numeroDocumento = originalNameMatch[2];
          }
          
          // Crear el nombre temporal siguiendo la convención
          // Nota: El número de documento será actualizado después del procesamiento
          const newFilename = `${tipoDocumento}-${numeroDocumento}-HL-${currentDate}${extension}`;
          
          cb(null, newFilename);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Solo aceptar archivos PDF
        if (file.mimetype !== 'application/pdf') {
          return cb(new Error('Solo se permiten archivos PDF'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo PDF de Historia Laboral de Colpensiones',
        },
        userId: {
          type: 'string',
          description: 'ID del usuario',
        },
        userName: {
          type: 'string',
          description: 'Nombre del usuario',
        },
      },
      required: ['file', 'userId', 'userName'],
    },
  })
  @ApiOperation({ summary: 'Subir y procesar un archivo PDF' })
  @ApiResponse({ status: 201, description: 'PDF procesado correctamente' })
  @ApiResponse({ status: 400, description: 'Archivo inválido' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async uploadAndProcessPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { userId: string; userName: string },
  ) {
    if (!file) {
      return {
        success: false,
        message: 'No se ha proporcionado un archivo',
      };
    }

    // Procesar el PDF
    const result = await this.pdfProcessingService.processUploadedPdf(
      body.userId,
      body.userName,
      file.path,
      file.originalname,
    );
    
    // Si se extrajo el número de documento, renombrar el archivo con el formato correcto
    if (result.success && result.document) {
      try {
        const directory = path.dirname(file.path);
        const extension = path.extname(file.path);
        const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        // Crear el nuevo nombre siguiendo la convención
        const newFilename = `CC-${result.document}-HL-${currentDate}${extension}`;
        const newPath = path.join(directory, newFilename);
        
        // Renombrar el archivo
        if (file.path !== newPath) {
          fs.renameSync(file.path, newPath);
          console.log(`Archivo renombrado a: ${newFilename}`);
        }
      } catch (error) {
        console.error(`Error al renombrar el archivo: ${error.message}`);
      }
    }
    
    return result;
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Obtener el estado de un procesamiento' })
  @ApiResponse({ status: 200, description: 'Estado del procesamiento' })
  @ApiResponse({ status: 400, description: 'ID de trabajo inválido' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getJobStatus(@Param('jobId') jobId: string) {
    const status = await this.pdfProcessingService.getJobStatus(jobId);
    
    return {
      success: true,
      message: 'Estado del procesamiento',
      data: status,
    };
  }
} 