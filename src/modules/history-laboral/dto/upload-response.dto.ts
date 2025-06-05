// Este archivo se implementará en la Fase 3
// Contendrá la estructura de la respuesta para la carga de archivos 

import { ApiProperty } from '@nestjs/swagger';
import { IServiceResponse } from '../../../common/interfaces/service-response.interface';

export class UploadFileData {
  @ApiProperty({
    description: 'Nombre original del archivo',
    example: 'documento.pdf'
  })
  fileName: string;

  @ApiProperty({
    description: 'Tamaño del archivo en bytes',
    example: 1024
  })
  fileSize: number;

  @ApiProperty({
    description: 'URL pública del archivo en Spaces',
    example: 'https://optipension.nyc3.digitaloceanspaces.com/history-laboral/01-12345678-HL-20240315.pdf'
  })
  spacesUrl: string;
}

export class UploadResponseDto implements IServiceResponse<UploadFileData> {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'Mensaje descriptivo del resultado',
    example: 'Archivo subido correctamente'
  })
  message: string;

  @ApiProperty({
    description: 'Datos del archivo subido',
    type: UploadFileData,
    required: false
  })
  data?: UploadFileData;

  @ApiProperty({
    description: 'Mensaje de error en caso de fallo',
    required: false
  })
  error?: string;
} 