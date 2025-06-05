import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { PdfLoaderService } from './pdf-loader.service';
import { ColpensionesValidatorService } from './colpensiones-validator.service';
import { AfiliadoExtractorService } from './afiliado-extractor.service';
import { PeriodosExtractorService, Period, ExtractionResult } from './periodos-extractor.service';

export { Period };

export interface ExtractedData {
  fullName?: string;
  document?: string;
  totalWeeks?: number;
  highRiskWeeks?: number;
  periods?: Period[];
  extractionMeta?: {
    durationMs: number;
    parserVersion: string;
    pdfSize: number;
  };
  success: boolean;
  errorMessage?: string;
}

@Injectable()
export class PdfParserService {
  private readonly logger = new Logger(PdfParserService.name);
  private readonly PARSER_VERSION = 'v1.0.3';

  constructor(
    private readonly pdfLoader: PdfLoaderService,
    private readonly colpensValidator: ColpensionesValidatorService,
    private readonly afiliadoExtractor: AfiliadoExtractorService,
    private readonly periodosExtractor: PeriodosExtractorService,
  ) {}

  /**
   * Extrae datos estructurados de un PDF de Colpensiones
   */
  async extractDataFromPdf(filePath: string): Promise<ExtractedData> {
    const startTime = Date.now();

    try {
      // 1. Verificar existencia del archivo
      if (!fs.existsSync(filePath)) {
        this.logger.error(`El archivo no existe: ${filePath}`);
        return {
          success: false,
          errorMessage: 'El archivo no existe'
        };
      }

      // Obtener tamaño del archivo
      const stats = fs.statSync(filePath);
      const pdfSize = stats.size;

      // 2. Cargar PDF
      const pdfData = await this.pdfLoader.load(filePath);

      // 3. Concatenar texto completo para validaciones generales
      const fullText = this.pdfLoader.toFullText(pdfData);

      // 4. Validar que es un PDF de Colpensiones
      if (!this.colpensValidator.isColpensionesFormat(fullText)) {
        this.logger.warn(`El archivo no parece ser un PDF de Colpensiones: ${filePath}`);
        return {
          success: false,
          errorMessage: 'El archivo no parece ser un PDF de Historia Laboral de Colpensiones',
          extractionMeta: {
            durationMs: Date.now() - startTime,
            parserVersion: this.PARSER_VERSION,
            pdfSize
          }
        };
      }

      // 5. Extraer documento
      const documento = this.afiliadoExtractor.extractDocument(fullText, pdfData);
      
      // 6. Extraer nombre usando el documento como referencia
      const nombre = documento ? this.afiliadoExtractor.extractFullName(pdfData, documento) : undefined;

      // 7. Extraer total de semanas
      let totalSemanas = this.afiliadoExtractor.extractTotalWeeks(fullText);

      // 8. Extraer períodos y otra información (alto riesgo)
      let periodos: Period[] | undefined = undefined;
      let semanasAltoRiesgo = 0;
      
      if (documento && nombre) {
        const extractionResult: ExtractionResult = this.periodosExtractor.extractAllSummaryPeriods(pdfData, documento, nombre);
        periodos = extractionResult.periods;
        semanasAltoRiesgo = extractionResult.highRiskWeeks;
        
        // Si se extrajo el total de semanas del resumen final, usarlo en lugar del estimado
        if (extractionResult.totalWeeks > 0) {
          totalSemanas = extractionResult.totalWeeks;
        }
        
        this.logger.debug(`Períodos extraídos: ${periodos.length}, Semanas alto riesgo: ${semanasAltoRiesgo}, Total semanas: ${totalSemanas}`);
      } else {
        this.logger.warn('No se pudieron extraer períodos: falta documento o nombre');
      }

      // Calcular duración y agregar metadatos
      const durationMs = Date.now() - startTime;
      
      // 9. Construir y devolver el resultado
      const result: ExtractedData = {
        success: true,
        fullName: nombre,
        document: documento,
        totalWeeks: totalSemanas,
        highRiskWeeks: semanasAltoRiesgo,
        periods: periodos,
        extractionMeta: {
          durationMs,
          parserVersion: this.PARSER_VERSION,
          pdfSize
        }
      };

      this.logger.log(`Extracción completada con éxito para: ${filePath} en ${durationMs}ms`);
      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.logger.error(`Error al extraer datos del PDF: ${error.message}`);
      
      return {
        success: false,
        errorMessage: `Error al procesar el PDF: ${error.message}`,
        extractionMeta: {
          durationMs,
          parserVersion: this.PARSER_VERSION,
          pdfSize: 0
        }
      };
    }
  }
} 