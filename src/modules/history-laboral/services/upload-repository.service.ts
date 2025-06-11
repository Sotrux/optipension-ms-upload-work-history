import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { HlHistoryLaboralUpload, Prisma } from '@prisma/client';
import { DocumentType } from '../dto/upload-request.dto';

export interface CreateUploadData {
  userId: string;
  documentType: DocumentType;
  documentNumber: string;
  originalFilename: string;
  fileSize: number;
  spacesKey: string;
  spacesUrl: string;
  createdBy?: string;
}

export interface UpdateUploadData {
  spacesKey?: string;
  spacesUrl?: string;
  updatedBy?: string;
}

@Injectable()
export class UploadRepositoryService {
  private readonly logger = new Logger(UploadRepositoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo registro de upload
   */
  async create(data: CreateUploadData): Promise<HlHistoryLaboralUpload> {
    try {
      this.logger.debug(`Creando registro de upload para usuario: ${data.userId}`);
      
      // Convertir userId a número para compatibilidad con trigger
      const numericUserId = this.stringToNumericId(data.userId);
      this.logger.debug(`Usuario convertido: ${data.userId} -> ${numericUserId}`);
      
      // Usar transacción para establecer user_id y crear el registro en la misma conexión
      const upload = await this.prisma.$transaction(async (tx) => {
        // Establecer el usuario actual en esta transacción
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${numericUserId.toString()}, true)`;
        
        // Crear el registro en la misma transacción
        return await tx.hlHistoryLaboralUpload.create({
          data: {
            user_id: data.userId,
            document_type: data.documentType,
            document_number: data.documentNumber,
            original_filename: data.originalFilename,
            file_size: data.fileSize,
            spaces_key: data.spacesKey,
            spaces_url: data.spacesUrl,
            // Omitimos createdBy y updatedBy para que los triggers automáticos los manejen
          },
        });
      });

      this.logger.log(`Upload creado exitosamente con ID: ${upload.id}`);
      return upload;
    } catch (error) {
      this.logger.error(`Error creando upload: ${error.message}`, error.stack);
      throw new Error(`Error al guardar el archivo en la base de datos: ${error.message}`);
    }
  }

  /**
   * Convertir string userId a ID numérico determinístico
   */
  private stringToNumericId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32-bit integer
    }
    // Asegurar que el resultado sea positivo y dentro del rango de PostgreSQL integer
    const positiveHash = Math.abs(hash) || 1;
    return positiveHash > 2147483647 ? positiveHash % 2147483647 : positiveHash;
  }

  /**
   * Encontrar un upload por ID
   */
  async findById(id: number): Promise<HlHistoryLaboralUpload | null> {
    try {
      return await this.prisma.hlHistoryLaboralUpload.findUnique({
        where: { 
          id,
          is_active: true 
        },
      });
    } catch (error) {
      this.logger.error(`Error buscando upload por ID ${id}: ${error.message}`, error.stack);
      throw new Error(`Error al buscar el archivo: ${error.message}`);
    }
  }

  /**
   * Encontrar un upload por UUID
   */
  async findByUuid(uu: string): Promise<HlHistoryLaboralUpload | null> {
    try {
      return await this.prisma.hlHistoryLaboralUpload.findFirst({
        where: { 
          uu,
          is_active: true 
        },
      });
    } catch (error) {
      this.logger.error(`Error buscando upload por UUID ${uu}: ${error.message}`, error.stack);
      throw new Error(`Error al buscar el archivo: ${error.message}`);
    }
  }

  /**
   * Encontrar uploads por usuario
   */
  async findByUser(userId: string, options?: {
    limit?: number;
    offset?: number;
    documentType?: DocumentType;
    documentNumber?: string;
  }): Promise<HlHistoryLaboralUpload[]> {
    try {
      const where: Prisma.HlHistoryLaboralUploadWhereInput = {
        user_id: userId,
        is_active: true,
      };

      if (options?.documentType) {
        where.document_type = options.documentType;
      }

      if (options?.documentNumber) {
        where.document_number = options.documentNumber;
      }

      return await this.prisma.hlHistoryLaboralUpload.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: options?.limit,
        skip: options?.offset,
      });
    } catch (error) {
      this.logger.error(`Error buscando uploads del usuario ${userId}: ${error.message}`, error.stack);
      throw new Error(`Error al buscar los archivos del usuario: ${error.message}`);
    }
  }

  /**
   * Verificar si existe un upload duplicado
   */
  async findDuplicate(
    userId: string,
    documentType: DocumentType,
    documentNumber: string,
    filename: string
  ): Promise<HlHistoryLaboralUpload | null> {
    try {
      return await this.prisma.hlHistoryLaboralUpload.findFirst({
        where: {
          user_id: userId,
          document_type: documentType,
          document_number: documentNumber,
          original_filename: filename,
          is_active: true,
        },
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Error verificando duplicado: ${error.message}`, error.stack);
      return null; // No lanzamos error para no interrumpir el flujo
    }
  }

  /**
   * Actualizar un upload
   */
  async update(id: number, data: UpdateUploadData, userId?: string): Promise<HlHistoryLaboralUpload> {
    try {
      this.logger.debug(`Actualizando upload con ID: ${id}`);
      
      // Establecer el usuario actual si se proporciona
      if (userId) {
        await this.prisma.setCurrentUser(userId);
      }
      
      const upload = await this.prisma.hlHistoryLaboralUpload.update({
        where: { id },
        data: {
          spaces_key: data.spacesKey,
          spaces_url: data.spacesUrl,
          // updatedAt será manejado por el trigger
        },
      });

      this.logger.log(`Upload actualizado exitosamente con ID: ${upload.id}`);
      return upload;
    } catch (error) {
      this.logger.error(`Error actualizando upload ${id}: ${error.message}`, error.stack);
      throw new Error(`Error al actualizar el archivo: ${error.message}`);
    } finally {
      // Limpiar el usuario actual después de la operación
      if (userId) {
        await this.prisma.clearCurrentUser();
      }
    }
  }

  /**
   * Desactivar un upload (soft delete)
   */
  async deactivate(id: number, userId?: string): Promise<HlHistoryLaboralUpload> {
    try {
      this.logger.debug(`Desactivando upload con ID: ${id}`);
      
      // Establecer el usuario actual si se proporciona
      if (userId) {
        await this.prisma.setCurrentUser(userId);
      }
      
      const upload = await this.prisma.hlHistoryLaboralUpload.update({
        where: { id },
        data: {
          is_active: false,
          // updatedBy y updatedAt serán manejados por el trigger
        },
      });

      this.logger.log(`Upload desactivado exitosamente con ID: ${upload.id}`);
      return upload;
    } catch (error) {
      this.logger.error(`Error desactivando upload ${id}: ${error.message}`, error.stack);
      throw new Error(`Error al desactivar el archivo: ${error.message}`);
    } finally {
      // Limpiar el usuario actual después de la operación
      if (userId) {
        await this.prisma.clearCurrentUser();
      }
    }
  }

  /**
   * Contar uploads por usuario
   */
  async countByUser(userId: string, documentType?: DocumentType): Promise<number> {
    try {
      const where: Prisma.HlHistoryLaboralUploadWhereInput = {
        user_id: userId,
        is_active: true,
      };

      if (documentType) {
        where.document_type = documentType;
      }

      return await this.prisma.hlHistoryLaboralUpload.count({ where });
    } catch (error) {
      this.logger.error(`Error contando uploads del usuario ${userId}: ${error.message}`, error.stack);
      return 0;
    }
  }

  /**
   * Obtener estadísticas generales
   */
  async getStatistics(): Promise<{
    totalUploads: number;
    totalActiveUploads: number;
    totalFileSize: bigint;
    uploadsToday: number;
  }> {
    try {
      const [totalUploads, totalActiveUploads, totalFileSizeResult, uploadsToday] = await Promise.all([
        this.prisma.hlHistoryLaboralUpload.count(),
        this.prisma.hlHistoryLaboralUpload.count({ where: { is_active: true } }),
        this.prisma.hlHistoryLaboralUpload.aggregate({
          where: { is_active: true },
          _sum: { file_size: true },
        }),
        this.prisma.hlHistoryLaboralUpload.count({
          where: {
            created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            is_active: true,
          },
        }),
      ]);

      return {
        totalUploads,
        totalActiveUploads,
        totalFileSize: BigInt(totalFileSizeResult._sum.file_size || 0),
        uploadsToday,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo estadísticas: ${error.message}`, error.stack);
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  }
} 