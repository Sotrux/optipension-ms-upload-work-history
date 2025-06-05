import { Injectable, Logger } from '@nestjs/common';

export interface Period {
  employerId: string;
  employerName: string;
  from: string;
  to: string;
  weeks: number;
  ibc: number;
  lic: number;
  sim: number;
  total: number;
}

export interface ExtractionResult {
  periods: Period[];
  highRiskWeeks: number;
  totalWeeks: number;
}

@Injectable()
export class PeriodosExtractorService {
  private readonly logger = new Logger(PeriodosExtractorService.name);

  findStartPage(pdfData: any): number {
    for (let idx = 0; idx < pdfData.Pages.length; idx++) {
      const page = pdfData.Pages[idx];
      const pageText = page.Texts
        .map((t: any) => decodeURIComponent(t.R.map((r: any) => r.T).join('')))
        .join(' ');
      if (pageText.includes('REPORTE DE SEMANAS COTIZADAS EN PENSIONES')) {
        this.logger.debug(`Página inicial del reporte encontrada: ${idx}`);
        return idx;
      }
    }
    this.logger.warn('No se encontró la sección "REPORTE DE SEMANAS COTIZADAS EN PENSIONES"');
    return 0;
  }

  findTableStartPage(pdfData: any): number {
    for (let idx = 0; idx < pdfData.Pages.length; idx++) {
      const page = pdfData.Pages[idx];
      const pageText = page.Texts
        .map((t: any) => decodeURIComponent(t.R.map((r: any) => r.T).join('')))
        .join(' ');
      if (
        pageText.includes('RESUMEN DE SEMANAS COTIZADAS POR EMPLEADOR') ||
        pageText.includes('IDENTIFICACIÓN APORTANTE') ||
        pageText.includes('[1]Identificación Aportante')
      ) {
        this.logger.debug(`Página con tabla de períodos encontrada: ${idx}`);
        return idx;
      }
    }
    this.logger.warn('No se encontró página con tabla de períodos, usando página 1');
    return 1;
  }

  debugFindDateLines(pdfData: any): void {
    this.logger.debug('---- INICIANDO DEPURACIÓN DE FECHAS ----');
    for (let pIdx = 0; pIdx < pdfData.Pages.length; pIdx++) {
      this.logger.debug(`---- ANALIZANDO PÁGINA ${pIdx + 1} ----`);
      const page = pdfData.Pages[pIdx];
      const linesByY = new Map<number, string[]>();
      for (const txtItem of page.Texts) {
        const y = Math.round(txtItem.y * 100) / 100;
        const txt = decodeURIComponent(txtItem.R.map((r: any) => r.T).join('')).trim();
        if (!linesByY.has(y)) linesByY.set(y, []);
        linesByY.get(y)!.push(txt);
      }
      const sortedYs = Array.from(linesByY.keys()).sort((a, b) => a - b);
      for (const y of sortedYs) {
        const line = linesByY.get(y)!.join(' ');
        const dateMatches = line.match(/\d{2}\/\d{2}\/\d{4}/g);
        if (dateMatches && dateMatches.length >= 2) {
          this.logger.debug(`FECHAS ENCONTRADAS en página ${pIdx + 1}, Y=${y}: "${line}"`);
        }
      }
    }
    this.logger.debug('---- FIN DEPURACIÓN DE FECHAS ----');
  }

  /**
   * Extrae el valor de semanas cotizadas con tarifa de alto riesgo
   * @param textLines Arreglo de líneas de texto
   * @param startLineIdx Índice de la línea donde se encontró "TOTAL SEMANAS COTIZADAS"
   * @returns Valor numérico de semanas de alto riesgo o 0 si no se encuentra
   */
  findHighRiskWeeks(
    textLines: { y: number; text: string; items: string[] }[],
    startLineIdx: number
  ): number {
    // Patrones que podrían contener el valor de alto riesgo
    const highRiskPatterns = [
      'SEMANAS COTIZADAS CON TARIFA DE ALTO RIESGO',
      'ALTO RIESGO'
    ];

    // Buscar en las 5 líneas siguientes al total
    const endLineIdx = Math.min(startLineIdx + 5, textLines.length);
    
    for (let i = startLineIdx; i < endLineIdx; i++) {
      const line = textLines[i];
      const upperLineText = line.text.toUpperCase();
      
      // Verificar si la línea contiene alguno de los patrones de alto riesgo
      const hasHighRiskPattern = highRiskPatterns.some(pattern => 
        upperLineText.includes(pattern.toUpperCase())
      );
      
      if (hasHighRiskPattern) {
        this.logger.debug(`Encontrada línea de alto riesgo: "${line.text}"`);
        
        // Buscar en las 2 líneas siguientes por si el valor está en otra línea
        for (let j = i; j < Math.min(i + 2, textLines.length); j++) {
          const checkLine = textLines[j];
          
          // Buscar por el patrón que incluye los dos puntos y el valor
          if (checkLine.text.includes(':')) {
            const parts = checkLine.text.split(':');
            if (parts.length >= 2) {
              const valueText = parts[parts.length - 1].trim();
              
              // Extraer los valores numéricos con formato decimal local (0,00)
              const numericMatches = valueText.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/g) || [];
              
              if (numericMatches.length > 0) {
                // Tomar el primer número después de los dos puntos
                const valueStr = numericMatches[0];
                // Convertir de formato local (0,00) a float
                const value = parseFloat(valueStr.replace(/\./g, '').replace(',', '.'));
                
                this.logger.debug(`Valor de semanas de alto riesgo encontrado: ${value} (extraído de "${valueText}")`);
                return value;
              }
            }
          } else {
            // Si no hay dos puntos, buscar directamente valores numéricos de formato 0,00
            const decimalPattern = /\d+,\d{2}/g;
            const decimalMatches = checkLine.text.match(decimalPattern) || [];
            
            if (decimalMatches.length > 0) {
              // Buscar el valor que tiene el formato 0,00 (dos decimales)
              const valueStr = decimalMatches[decimalMatches.length - 1];
              const value = parseFloat(valueStr.replace(',', '.'));
              
              this.logger.debug(`Valor de semanas de alto riesgo encontrado: ${value} (extraído de "${checkLine.text}")`);
              return value;
            }
          }
        }
      }
    }
    
    this.logger.debug('No se encontró información de semanas cotizadas con tarifa de alto riesgo');
    return 0;
  }

  /**
   * Extrae el valor total de semanas cotizadas
   * @param textLines Arreglo de líneas de texto
   * @param startLineIdx Índice de la línea donde se encontró "TOTAL SEMANAS COTIZADAS"
   * @returns Valor numérico del total de semanas o 0 si no se encuentra
   */
  findTotalWeeks(
    textLines: { y: number; text: string; items: string[] }[],
    startLineIdx: number
  ): number {
    const line = textLines[startLineIdx];
    
    // Verificar si la línea actual contiene el valor después de dos puntos
    if (line.text.includes(':')) {
      const parts = line.text.split(':');
      if (parts.length >= 2) {
        const valueText = parts[parts.length - 1].trim();
        
        // Extraer los valores numéricos con formato decimal local (1.306,57)
        const numericMatches = valueText.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/g) || [];
        
        if (numericMatches.length > 0) {
          // Tomar el primer número después de los dos puntos
          const valueStr = numericMatches[0];
          // Convertir de formato local (1.306,57) a float (1306.57)
          const value = parseFloat(valueStr.replace(/\./g, '').replace(',', '.'));
          
          this.logger.debug(`Valor total de semanas cotizadas: ${value} (extraído de "${valueText}")`);
          return value;
        }
      }
    }
    
    // Si no se encontró en la línea actual, buscar en la siguiente
    if (startLineIdx + 1 < textLines.length) {
      const nextLine = textLines[startLineIdx + 1];
      
      // Buscar específicamente un formato de número con decimales (1.306,57)
      const decimalPattern = /\d{1,3}(?:\.\d{3})*,\d{2}/g;
      const decimalMatches = nextLine.text.match(decimalPattern) || [];
      
      if (decimalMatches.length > 0) {
        // Usar el número con formato de miles y decimales
        const valueStr = decimalMatches[0];
        const value = parseFloat(valueStr.replace(/\./g, '').replace(',', '.'));
        
        this.logger.debug(`Valor total de semanas cotizadas: ${value} (extraído de línea siguiente)`);
        return value;
      }
    }
    
    this.logger.debug('No se encontró valor total de semanas cotizadas');
    return 0;
  }

  extractAllSummaryPeriods(
    pdfData: any,
    documentNumber: string,
    fullName: string
  ): ExtractionResult {
    // 1) Depuración de fechas (solo para debug)
    this.debugFindDateLines(pdfData);

    const periods: Period[] = [];
    let highRiskWeeks = 0;
    let totalWeeks = 0;
    
    const tableStartPage = this.findTableStartPage(pdfData);
    const headerPatterns = [
      'IDENTIFICACIÓN APORTANTE',
      'RESUMEN DE SEMANAS COTIZADAS POR EMPLEADOR',
      '[1]Identificación Aportante'
    ];
    const endPatterns = [
      'TOTAL SEMANAS COTIZADAS',
      '[10] TOTAL SEMANAS',
      'GRAN TOTAL',
      'RESUMEN DE TIEMPOS PÚBLICOS NO COTIZADOS A COLPENSIONES'
    ];

    this.logger.debug(`Buscando tablas de períodos a partir de la página ${tableStartPage + 1}`);

    let inTable = false;
    let currentEmployerId = '';
    let currentEmployerName = '';

    const defaultEmployerId = documentNumber;
    const defaultEmployerName = fullName || 'AFILIADO';

    for (let pIdx = tableStartPage; pIdx < pdfData.Pages.length; pIdx++) {
      this.logger.debug(`Procesando página ${pIdx + 1}`);
      const page = pdfData.Pages[pIdx];

      // Agrupar cada página en líneas por Y y ordenar elementos por X
      const linesByY = new Map<number, { texts: string[]; xs: number[] }>();
      for (const txtItem of page.Texts) {
        const y = Math.round(txtItem.y * 100) / 100;
        const txt = decodeURIComponent(txtItem.R.map((r: any) => r.T).join('')).trim();
        if (!linesByY.has(y)) {
          linesByY.set(y, { texts: [], xs: [] });
        }
        linesByY.get(y)!.texts.push(txt);
        linesByY.get(y)!.xs.push(txtItem.x);
      }

      const sortedYs = Array.from(linesByY.keys()).sort((a, b) => a - b);
      const textLines: { y: number; text: string; items: string[] }[] = [];
      for (const y of sortedYs) {
        const line = linesByY.get(y)!;
        const sortedItems = line.texts
          .map((text, idx) => ({ text, x: line.xs[idx] }))
          .sort((a, b) => a.x - b.x)
          .map((item) => item.text);
        const fullLine = sortedItems.join(' ');
        textLines.push({ y, text: fullLine, items: sortedItems });
      }

      for (let lineIdx = 0; lineIdx < textLines.length; lineIdx++) {
        const line = textLines[lineIdx];
        const upperLineText = line.text.toUpperCase();

        // 1) Detectar encabezado de tabla
        for (const pattern of headerPatterns) {
          if (upperLineText.includes(pattern.toUpperCase())) {
            inTable = true;
            this.logger.debug(`Encabezado de tabla encontrado: "${pattern}"`);
            if (!currentEmployerId) {
              currentEmployerId = defaultEmployerId;
              currentEmployerName = defaultEmployerName;
              this.logger.debug(
                `Usando empleador predeterminado: ${currentEmployerId} - ${currentEmployerName}`
              );
            }
            break;
          }
        }

        // 2) Detectar fin de tabla
        for (const pattern of endPatterns) {
          if (upperLineText.includes(pattern.toUpperCase())) {
            inTable = false;
            this.logger.debug(`Final de tabla encontrado: "${pattern}". Buscando información adicional...`);
            
            // Extraer total de semanas cotizadas de la línea actual
            totalWeeks = this.findTotalWeeks(textLines, lineIdx);
            
            // Buscar semanas de alto riesgo en las próximas líneas
            highRiskWeeks = this.findHighRiskWeeks(textLines, lineIdx);
            
            this.logger.debug(`Total semanas: ${totalWeeks}, Semanas alto riesgo: ${highRiskWeeks}`);
            this.printPeriodsDebugTable(periods, totalWeeks, highRiskWeeks);
            
            return {
              periods,
              highRiskWeeks,
              totalWeeks
            };
          }
        }

        // Si estamos dentro de la tabla, procesar
        if (inTable) {
          // a) ¿Línea de empleador?
          const employerIdMatch = line.text.match(/\b(\d{7,12})\b/);
          if (employerIdMatch) {
            const possibleEmployerId = employerIdMatch[1];
            const hasDate = line.text.includes('/');
            const isIdAtStart = line.text.indexOf(possibleEmployerId) < 10;
            if (!hasDate || isIdAtStart) {
              // Es sinónimo de "esta línea define el empleador actual"
              currentEmployerId = possibleEmployerId;
              let possibleName = line.text.replace(currentEmployerId, '').trim();
              if (!possibleName && lineIdx + 1 < textLines.length) {
                possibleName = textLines[lineIdx + 1].text;
              }
              possibleName = possibleName
                .replace(/\d{2}\/\d{2}\/\d{4}/g, '')
                .replace(/\d+([.,]\d+)?/g, '')
                .trim();
              currentEmployerName = possibleName || 'EMPLEADOR SIN NOMBRE';
              this.logger.debug(`Empleador detectado: ${currentEmployerId} - ${currentEmployerName}`);
              // NOTA: no hacemos `continue;` porque quizá la misma línea contiene fechas
            }
          }

          // b) ¿Línea con fechas?
          const dateMatches = line.text.match(/\d{2}\/\d{2}\/\d{4}/g);
          if (dateMatches && dateMatches.length >= 2) {
            this.logger.debug(`Procesando línea con fechas: "${line.text}"`);
            if (!currentEmployerId) {
              currentEmployerId = defaultEmployerId;
              currentEmployerName = defaultEmployerName;
              this.logger.debug(
                `Usando empleador predeterminado para período: ${currentEmployerId} - ${currentEmployerName}`
              );
            }
            const fromDate = dateMatches[0];
            const toDate = dateMatches[1];
            const remaining = line.text
              .replace(fromDate, '')
              .replace(toDate, '')
              .trim();

            // ===== REGEX QUE AGRUPA MILES Y DECIMALES LOCALES =====
            // Captura "2.000.000", "99,29", "4,29", etc., en un solo match.
            const numericMatches = remaining.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/g) || [];

            // Convertir "2.000.000" → "2000000", "99,29" → "99.29"
            const numericValues = numericMatches.map((val) => {
              const cleaned = val.replace(/\./g, '').replace(',', '.');
              return parseFloat(cleaned);
            });

            this.logger.debug(`Valores numéricos transformados: ${JSON.stringify(numericValues)}`);

            // Si tenemos al menos 5 valores → [IBC, Semanas, Lic, Sim, Total]
            if (numericValues.length >= 5) {
              const ibc = numericValues[0];
              const weeks = numericValues[1];
              const lic = numericValues[2];
              const sim = numericValues[3];
              const total = numericValues[4];

              periods.push({
                employerId: currentEmployerId,
                employerName: currentEmployerName,
                from: this.formatDate(fromDate),
                to: this.formatDate(toDate),
                weeks,
                ibc,
                lic,
                sim,
                total
              });

              this.logger.debug(
                `${currentEmployerId} | ${currentEmployerName} | ${this.formatDate(fromDate)} | ${this.formatDate(toDate)}` +
                  ` | IBC=${ibc} | Semanas=${weeks} | Lic=${lic} | Sim=${sim} | Total=${total}`
              );
            }
            // Si sólo hay dos valores → [IBC, Semanas], tomamos lic=0, sim=0, total=weeks
            else if (numericValues.length >= 2) {
              const ibc = numericValues[0];
              const weeks = numericValues[1];
              const lic = 0;
              const sim = 0;
              const total = weeks;

              periods.push({
                employerId: currentEmployerId,
                employerName: currentEmployerName,
                from: this.formatDate(fromDate),
                to: this.formatDate(toDate),
                weeks,
                ibc,
                lic,
                sim,
                total
              });

              this.logger.debug(
                `${currentEmployerId} | ${currentEmployerName} | ${this.formatDate(fromDate)} | ${this.formatDate(toDate)}` +
                  ` | IBC=${ibc} | Semanas=${weeks} | Lic=${lic} | Sim=${sim} | Total=${total}`
              );
            } else {
              this.logger.debug(
                `Línea con fechas descartada (no suficientes valores financieros): "${line.text}"`
              );
            }
          }
        }
      }
    }

    this.logger.debug(`Total de períodos encontrados: ${periods.length}`);
    this.printPeriodsDebugTable(periods, totalWeeks, highRiskWeeks);
    
    return {
      periods,
      highRiskWeeks,
      totalWeeks
    };
  }

  formatDate(dateString: string): string {
    const m = dateString.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : dateString;
  }

  printPeriodsDebugTable(periods: Period[], totalWeeks: number = 0, highRiskWeeks: number = 0): void {
    console.log('\n======== TABLA DE PERIODOS EXTRAIDOS (INICIO) ========');
    console.log(
      'EMPLEADOR ID | EMPLEADOR NOMBRE       | DESDE      | HASTA      | IBC       | SEMANAS  | LIC | SIM | TOTAL'
    );
    console.log('----------------------------------------------------------------------------------------------');

    periods.forEach((period) => {
      const fromDate = period.from.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
      const toDate = period.to.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');

      console.log(
        `${period.employerId.padEnd(12)} | ` +
          `${period.employerName.substring(0, 20).padEnd(20)} | ` +
          `${fromDate.padEnd(10)} | ` +
          `${toDate.padEnd(10)} | ` +
          `${period.ibc.toString().padEnd(10)} | ` +
          `${period.weeks.toString().padEnd(8)} | ` +
          `${period.lic.toString().padEnd(3)} | ` +
          `${period.sim.toString().padEnd(3)} | ` +
          `${period.total.toString().padEnd(6)}`
      );
    });

    console.log('----------------------------------------------------------------------------------------------');
    console.log(`TOTAL PERIODOS: ${periods.length}`);
    
    if (totalWeeks > 0) {
      console.log(`TOTAL SEMANAS COTIZADAS: ${totalWeeks}`);
    }
    
    if (highRiskWeeks > 0 || totalWeeks > 0) {
      console.log(`SEMANAS COTIZADAS CON TARIFA DE ALTO RIESGO: ${highRiskWeeks}`);
    }
    
    console.log('======== TABLA DE PERIODOS EXTRAIDOS (FIN) ========\n');
    
    this.logger.debug(`Total de períodos extraídos: ${periods.length}`);
    if (totalWeeks > 0) {
      this.logger.debug(`Total semanas cotizadas: ${totalWeeks}`);
    }
    if (highRiskWeeks > 0) {
      this.logger.debug(`Semanas cotizadas con tarifa de alto riesgo: ${highRiskWeeks}`);
    }
  }
}
