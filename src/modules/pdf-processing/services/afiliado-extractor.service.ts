import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AfiliadoExtractorService {
  private readonly logger = new Logger(AfiliadoExtractorService.name);

  /**
   * Extrae el número de documento:
   * 1) Busca patrón "C <documentNumber>" en todo el texto.
   * 2) Si no lo encuentra, busca la primera secuencia de 7–12 dígitos en la primera página.
   * @param fullText Texto completo del PDF
   * @param pdfData Objeto retornado por pdf2json
   */
  extractDocument(fullText: string, pdfData: any): string | undefined {
    // 1. Intentar "C <número>"
    const docPattern = /\bC\s+(\d{7,12})\b/;
    const m = fullText.match(docPattern);
    if (m && m[1]) {
      this.logger.debug(`Documento encontrado con patrón 'C <número>': ${m[1]}`);
      return m[1];
    }

    // 2. Si no aparece, buscar en la primera página
    if (pdfData.Pages.length > 0) {
      for (const txtItem of pdfData.Pages[0].Texts) {
        const txt = decodeURIComponent(txtItem.R.map((r: any) => r.T).join('')).trim();
        const mm = txt.match(/\b(\d{7,12})\b/);
        if (mm && mm[1]) {
          this.logger.debug(`Documento encontrado en primera página: ${mm[1]}`);
          return mm[1];
        }
      }
    }
    
    this.logger.warn('No se pudo extraer el número de documento');
    return undefined;
  }

  /**
   * Extrae el nombre completo del afiliado desde la primera página:
   * 1) Agrupa TextItems por coordenada Y (líneas).
   * 2) Busca "Nombre:" en cada línea. 
   * 3) Retorna el texto que aparece justo a la derecha del rótulo.
   * @param pdfData Objeto retornado por pdf2json
   * @param documentNumber Número de documento extraído (para validar ubicación opcional)
   */
  extractFullName(pdfData: any, documentNumber: string): string | undefined {
    try {
      if (pdfData.Pages.length === 0) {
        this.logger.warn('PDF sin páginas, no se puede extraer el nombre');
        return undefined;
      }
      
      const page = pdfData.Pages[0]; // Solo primera página

      // 1. Agrupar TextItems por Y
      const linesByY = new Map<number, { text: string; x: number }[]>();
      for (const t of page.Texts) {
        const y = Math.round(t.y * 100) / 100;
        const txt = decodeURIComponent(t.R.map((r: any) => r.T).join('')).trim();
        if (!linesByY.has(y)) linesByY.set(y, []);
        linesByY.get(y)!.push({ text: txt, x: t.x });
      }

      // 2. Ordenar por Y y luego por X
      for (const [y, items] of Array.from(linesByY.entries()).sort((a, b) => a[0] - b[0])) {
        items.sort((a, b) => a.x - b.x);
        const texts = items.map(i => i.text);
        const joined = texts.join(' ');
        
        this.logger.debug(`Analizando línea en Y=${y}: "${joined}"`);
        
        if (!joined.includes('Nombre:')) continue;

        // 3. Ubicar índice de "Nombre:" o "Nombre:<algo>"
        const idx = texts.findIndex(t => t === 'Nombre:' || t.startsWith('Nombre:'));
        if (idx < 0) continue;

        // 4. Extraer el texto después de "Nombre:"
        let candidate = texts[idx].replace(/^Nombre:\s*/, '').trim();
        if (!candidate && idx + 1 < texts.length) {
          candidate = texts[idx + 1].trim();
        }

        // 5. Validar: solo mayúsculas y espacios; al menos dos palabras
        if (/^[A-ZÁÉÍÓÚÑ ]{8,}$/.test(candidate) && candidate.includes(' ')) {
          this.logger.debug(`Nombre encontrado: ${candidate}`);
          return candidate; // Ej: "GERMAN TABARES CARREÑO"
        }
      }
      
      // Intento alternativo: buscar cerca del documento
      if (documentNumber) {
        this.logger.debug(`Buscando nombre cerca del documento ${documentNumber}`);
        
        // Buscar el texto que contiene el documento
        for (const [y, items] of Array.from(linesByY.entries())) {
          const joined = items.map(i => i.text).join(' ');
          
          if (joined.includes(`C ${documentNumber}`)) {
            // Si la línea contiene "C [documento] [posible nombre]"
            const parts = joined.split(documentNumber);
            if (parts.length > 1) {
              const afterDoc = parts[1].trim();
              // Verificar que parece un nombre (letras mayúsculas, al menos 2 palabras)
              if (/^[A-ZÁÉÍÓÚÑ ]{8,}$/.test(afterDoc) && afterDoc.includes(' ')) {
                this.logger.debug(`Nombre encontrado después del documento: ${afterDoc}`);
                return afterDoc;
              }
            }
            
            // Si no está en la misma línea, buscar en la línea siguiente
            const nextY = Array.from(linesByY.keys())
              .filter(k => k > y)
              .sort((a, b) => a - b)[0];
              
            if (nextY) {
              const nextLine = linesByY.get(nextY)!.map(i => i.text).join(' ');
              if (/^[A-ZÁÉÍÓÚÑ ]{8,}$/.test(nextLine) && nextLine.includes(' ')) {
                this.logger.debug(`Nombre encontrado en línea siguiente al documento: ${nextLine}`);
                return nextLine;
              }
            }
          }
        }
      }
      
      this.logger.warn('No se encontró "Nombre:" en la primera página.');
      return undefined;
    } catch (e) {
      this.logger.error(`Error en extractFullName: ${e.message}`);
      return undefined;
    }
  }

  /**
   * Extrae el total de semanas cotizadas desde el texto completo:
   * Usa un regex que capture "TOTAL SEMANAS COTIZADAS: <número>".
   * @param fullText Texto completo del PDF
   */
  extractTotalWeeks(fullText: string): number | undefined {
    const patterns = [
      /TOTAL\s+SEMANAS\s+COTIZADAS:?[ \t]*([0-9.,]+)/i,
      /TOTAL\s+SEMANAS:?[ \t]*([0-9.,]+)/i,
      /GRAN\s+TOTAL:?[ \t]*([0-9.,]+)/i
    ];
    
    for (const pattern of patterns) {
      const m = fullText.match(pattern);
      if (m && m[1]) {
        const value = parseFloat(m[1].replace(',', '.'));
        this.logger.debug(`Total de semanas extraído: ${value}`);
        return value;
      }
    }
    
    this.logger.warn('No se pudo extraer el total de semanas cotizadas');
    return undefined;
  }
} 