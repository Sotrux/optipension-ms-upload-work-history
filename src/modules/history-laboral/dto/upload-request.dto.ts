import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Matches, Length } from 'class-validator';

export enum DocumentType {
  CEDULA_CIUDADANIA = 'CC',
  CEDULA_EXTRANJERIA = 'CE',
  PASAPORTE = 'PA'
}

export class UploadRequestDto {
  @ApiProperty({
    description: 'Tipo de documento de identidad',
    enum: DocumentType,
    example: DocumentType.CEDULA_CIUDADANIA
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({
    description: 'Número de documento de identidad',
    example: '1234567890',
    minLength: 8,
    maxLength: 12
  })
  @IsString()
  @Length(8, 12)
  @Matches(/^[0-9A-Za-z-]+$/, {
    message: 'El número de documento solo puede contener números, letras y guiones'
  })
  documentNumber: string;
} 