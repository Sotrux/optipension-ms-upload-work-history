import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { HlExtraction, Prisma } from '@prisma/client';

export interface CreateExtractionData {
  uploadId: number;
  fullName?: string;
  document?: string;
  totalWeeks?: number;
  highRiskWeeks?: number;
  discrepancyOfWeeks?: number;
  summaryJson?: any;
  status: string;
  errorMessage?: string;
  extractionMeta?: any;
}

export interface UpdateExtractionData {
  fullName?: string;
  document?: string;
  totalWeeks?: number;
  highRiskWeeks?: number;
  discrepancyOfWeeks?: number;
  summaryJson?: any;
  status?: string;
  errorMessage?: string;
  extractionMeta?: any;
}

@Injectable()
export class ExtractionRepositoryService {
  private readonly logger = new Logger(ExtractionRepositoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear o actualizar una extracción (idempotente)
   */
  async upsertExtraction(
    userId: string,
    data: CreateExtractionData,
  ): Promise<HlExtraction> {
    try {
      await this.prisma.setCurrentUser(userId);

      const result = await this.prisma.hlExtraction.upsert({
        where: {
          upload_id: data.uploadId,
        },
        update: {
          full_name: data.fullName,
          document: data.document,
          total_weeks: data.totalWeeks ? new Prisma.Decimal(data.totalWeeks) : null,
          high_risk_weeks: data.highRiskWeeks ? new Prisma.Decimal(data.highRiskWeeks) : null,
          discrepancy_of_weeks: data.discrepancyOfWeeks ? new Prisma.Decimal(data.discrepancyOfWeeks) : null,
          summary_json: data.summaryJson,
          status: data.status,
          error_message: data.errorMessage,
          extraction_meta: data.extractionMeta,
        },
        create: {
          upload_id: data.uploadId,
          full_name: data.fullName,
          document: data.document,
          total_weeks: data.totalWeeks ? new Prisma.Decimal(data.totalWeeks) : null,
          high_risk_weeks: data.highRiskWeeks ? new Prisma.Decimal(data.highRiskWeeks) : null,
          discrepancy_of_weeks: data.discrepancyOfWeeks ? new Prisma.Decimal(data.discrepancyOfWeeks) : null,
          summary_json: data.summaryJson,
          status: data.status,
          error_message: data.errorMessage,
          extraction_meta: data.extractionMeta,
        },
        include: {
          upload: true,
        },
      });

      this.logger.log(`Extracción upserted para upload_id: ${data.uploadId}, status: ${data.status}`);
      return result;
    } catch (error) {
      this.logger.error(`Error al hacer upsert de extracción para upload_id ${data.uploadId}: ${error.message}`);
      throw error;
    } finally {
      await this.prisma.clearCurrentUser();
    }
  }

  /**
   * Buscar extracción por upload_id
   */
  async findByUploadId(uploadId: number): Promise<HlExtraction | null> {
    try {
      return await this.prisma.hlExtraction.findUnique({
        where: {
          upload_id: uploadId,
          is_active: true,
        },
        include: {
          upload: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error al buscar extracción por upload_id ${uploadId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Buscar extracción por ID
   */
  async findById(id: number): Promise<HlExtraction | null> {
    try {
      return await this.prisma.hlExtraction.findUnique({
        where: {
          id,
          is_active: true,
        },
        include: {
          upload: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error al buscar extracción por id ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Actualizar estado a ERROR
   */
  async markAsError(
    userId: string,
    uploadId: number,
    errorMessage: string,
    extractionMeta?: any,
  ): Promise<HlExtraction> {
    return this.upsertExtraction(userId, {
      uploadId,
      status: 'ERROR',
      errorMessage,
      extractionMeta,
    });
  }

  /**
   * Marcar como PROCESSED con datos completos
   */
  async markAsProcessed(
    userId: string,
    uploadId: number,
    extractedData: any,
  ): Promise<HlExtraction> {
    // Calcular discrepancia de semanas
    const discrepancyOfWeeks = this.calculateWeeksDiscrepancy(extractedData);

    return this.upsertExtraction(userId, {
      uploadId,
      fullName: extractedData.fullName,
      document: extractedData.document,
      totalWeeks: extractedData.totalWeeks,
      highRiskWeeks: extractedData.highRiskWeeks || 0,
      discrepancyOfWeeks,
      summaryJson: {
        periods: extractedData.periods || [],
        periodsCount: extractedData.periods?.length || 0,
      },
      status: 'PROCESSED',
      extractionMeta: extractedData.extractionMeta,
    });
  }

  /**
   * Calcular discrepancia entre total de semanas y suma de períodos
   */
  private calculateWeeksDiscrepancy(extractedData: any): number {
    if (!extractedData.totalWeeks || !extractedData.periods) {
      return 0;
    }

    const totalFromPeriods = extractedData.periods.reduce(
      (sum: number, period: any) => sum + (period.weeks || 0),
      0,
    );

    return extractedData.totalWeeks - totalFromPeriods;
  }

  /**
   * Obtener estadísticas de extracciones
   */
  async getExtractionStats(): Promise<{
    total: number;
    processed: number;
    error: number;
    pending: number;
  }> {
    try {
      const [total, processed, error, pending] = await Promise.all([
        this.prisma.hlExtraction.count({ where: { is_active: true } }),
        this.prisma.hlExtraction.count({ where: { status: 'PROCESSED', is_active: true } }),
        this.prisma.hlExtraction.count({ where: { status: 'ERROR', is_active: true } }),
        this.prisma.hlExtraction.count({ where: { status: 'PENDING', is_active: true } }),
      ]);

      return { total, processed, error, pending };
    } catch (error) {
      this.logger.error(`Error al obtener estadísticas de extracciones: ${error.message}`);
      throw error;
    }
  }
} 