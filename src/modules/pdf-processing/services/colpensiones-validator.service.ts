import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ColpensionesValidatorService {
  private readonly logger = new Logger(ColpensionesValidatorService.name);

  /**
   * Verifica si el texto contiene palabras clave de un informe de Colpensiones.
   * @param fullText Texto concatenado de todo el PDF
   */
  isColpensionesFormat(fullText: string): boolean {
    const keywords = [
      'COLPENSIONES',
      'REPORTE DE SEMANAS COTIZADAS EN PENSIONES',
      'ADMINISTRADORA COLOMBIANA DE PENSIONES',
      'TOTAL SEMANAS COTIZADAS',
      'HISTORIA LABORAL'
    ];
    
    const result = keywords.some(keyword => fullText.includes(keyword));
    
    if (result) {
      this.logger.debug('PDF validado como formato de Colpensiones');
    } else {
      this.logger.warn('El PDF no parece ser un informe de Colpensiones');
    }
    
    return result;
  }
} 