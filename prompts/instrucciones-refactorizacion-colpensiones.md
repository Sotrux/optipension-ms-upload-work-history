# Instrucciones de Refactorización y Ajustes para el Parser de Colpensiones

Estas instrucciones detallan cómo refactorizar el parser actual de pdf2json en varios servicios modulares y cómo ajustar la lógica de extracción para corregir errores. El objetivo es que el equipo de desarrollo pueda implementar los cambios de forma clara y correcta.

---

## 1. Objetivos Generales

1. **Modularizar el código** en servicios con responsabilidades únicas, evitando un archivo monolítico de ~1000 líneas.  
2. **Extraer el nombre del afiliado** (`fullName`) únicamente desde la primera página, usando el rótulo `Nombre:`.  
3. **Detectar el inicio de la tabla de períodos** en cada página mediante la aparición de `<documentNumber> <fullName>`, sin suponer un prefijo fijo `"C"`.  
4. **Recolectar todas las filas de la tabla** (que pueden abarcar varias páginas) hasta llegar a la línea `"[10] TOTAL SEMANAS COTIZADAS"`.  
5. **Descartar filas vacías** donde `employerId === documentNumber` y `weeks === 0`.  
6. **No validar un número fijo de períodos**, dejando que cada informe devuelva tantos registros como tenga al completo.

---

## 2. Estructura de Servicios y Clases

Separar el parser en al menos cinco componentes/service providres:

1. **PdfLoaderService**  
   - Función: Cargar el PDF usando pdf2json y devolver el objeto `pdfData`.  
   - Métodos:
     - `load(filePath: string): Promise<any>`  
     - `toFullText(pdfData: any): string` (opcional: convierte todas las páginas a un bloque de texto)

2. **ColpensionesValidatorService**  
   - Función: Validar si un texto completo pertenece a un informe de Colpensiones.  
   - Métodos:
     - `isColpensionesFormat(fullText: string): boolean`

3. **AfiliadoExtractorService**  
   - Función: Extraer `documentNumber` y `fullName` desde la primera página.  
   - Métodos:
     - `extractDocument(fullText: string, pdfData: any): string | undefined`  
     - `extractFullName(pdfData: any, documentNumber: string): string | undefined`  
     - `extractTotalWeeks(fullText: string): number | undefined` (opcional)

4. **PeriodosExtractorService**  
   - Función: Extraer todos los períodos cotizados (que pueden estar repartidos en varias páginas) desde el bloque de resumen hasta `[10] TOTAL SEMANAS COTIZADAS`.  
   - Métodos:
     - `findStartPage(pdfData: any): number`  
     - `extractAllSummaryPeriods(pdfData: any, documentNumber: string, fullName: string): Period[]`  
     - `formatDate(dateString: string): string` (ayuda a convertir `DD/MM/AAAA` → `YYYY-MM-DD`)  
     - `parseNumericValue(value: string): number` (convierte `"$665.070"` → `665070` o `"286,43"` → `286.43`)

5. **PdfParserService** (orquestador en NestJS)  
   - Función: Orquestar la lógica, invocando los servicios anteriores en el orden adecuado y generando el objeto `ExtractedData`.  
   - Dependencias a inyectar:
     - `PdfLoaderService`  
     - `ColpensionesValidatorService`  
     - `AfiliadoExtractorService`  
     - `PeriodosExtractorService`

---

## 3. PdfLoaderService

### Descripción
Carga y parsea el PDF. Devuelve el objeto `pdfData` que genera `pdf2json`, así como una función auxiliar para concatenar todo el texto.

```ts
import { Injectable } from '@nestjs/common';
const PDFParser = require('pdf2json');

@Injectable()
export class PdfLoaderService {
  /**
   * Carga el PDF en memoria y devuelve el objeto pdfData.
   * @param filePath Ruta al archivo PDF
   */
  async load(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const parser = new PDFParser();
      parser.on('pdfParser_dataError', (err: any) => {
        reject(new Error(err.parserError));
      });
      parser.on('pdfParser_dataReady', (pdfData: any) => {
        resolve(pdfData);
      });
      parser.loadPDF(filePath);
    });
  }

  /**
   * Concatena todo el texto de cada página en un solo bloque.
   * @param pdfData Objeto retornado por pdf2json
   */
  toFullText(pdfData: any): string {
    let text = '';
    for (const page of pdfData.Pages) {
      for (const txtItem of page.Texts) {
        const decoded = decodeURIComponent(txtItem.R.map((r: any) => r.T).join(''));
        text += decoded + ' ';
      }
      text += '\n';
    }
    return text;
  }
}
```

---

## 4. ColpensionesValidatorService

### Descripción
Revisa si el informe pertenece al formato de Colpensiones, buscando palabras clave en el texto completo.

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class ColpensionesValidatorService {
  /**
   * Verifica si el texto contiene palabras clave de un informe de Colpensiones.
   * @param fullText Texto concatenado de todo el PDF
   */
  isColpensionesFormat(fullText: string): boolean {
    const keywords = [
      'COLPENSIONES',
      'REPORTE DE SEMANAS COTIZADAS EN PENSIONES',
      'ADMINISTRADORA COLOMBIANA DE PENSIONES',
      'TOTAL SEMANAS COTIZADAS'
    ];
    return keywords.some(keyword => fullText.includes(keyword));
  }
}
```

---

## 5. AfiliadoExtractorService

### Descripción
Extrae el `documentNumber` y el `fullName` únicamente de la primera página. También puede extraer el total de semanas desde el texto completo.

```ts
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
    if (m && m[1]) return m[1];

    // 2. Si no aparece, buscar en la primera página
    for (const txtItem of pdfData.Pages[0].Texts) {
      const txt = decodeURIComponent(txtItem.R.map((r: any) => r.T).join('')).trim();
      const mm = txt.match(/\b(\d{7,12})\b/);
      if (mm && mm[1]) return mm[1];
    }
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
      for (const [_, items] of Array.from(linesByY.entries()).sort((a,b) => a[0] - b[0])) {
        items.sort((a, b) => a.x - b.x);
        const texts = items.map(i => i.text);
        const joined = texts.join(' ');
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
          return candidate; // Ej: "GERMAN TABARES CARREÑO"
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
   * (Opcional) Extrae el total de semanas cotizadas desde el texto completo:
   * Usa un regex que capture "TOTAL SEMANAS COTIZADAS: <número>".
   * @param fullText Texto completo del PDF
   */
  extractTotalWeeks(fullText: string): number | undefined {
    const pattern = /TOTAL\s+SEMANAS\s+COTIZADAS:?[ \t]*([0-9.,]+)/i;
    const m = fullText.match(pattern);
    if (m && m[1]) {
      return parseFloat(m[1].replace(',', '.'));
    }
    return undefined;
  }
}
```

---

## 6. PeriodosExtractorService

### Descripción
Recorre todas las páginas a partir de la que contiene `"REPORTE DE SEMANAS COTIZADAS EN PENSIONES"`, detecta el inicio de la tabla en cada página buscando `"<documentNumber> <fullName>"`, y extrae filas hasta encontrar `"[10] TOTAL SEMANAS COTIZADAS"`.  

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Period } from './pdf-parser.service'; // Ajustar al path real

@Injectable()
export class PeriodosExtractorService {
  private readonly logger = new Logger(PeriodosExtractorService.name);

  /**
   * Encuentra el índice de la página donde aparece:
   * "REPORTE DE SEMANAS COTIZADAS EN PENSIONES"
   */
  findStartPage(pdfData: any): number {
    for (let idx = 0; idx < pdfData.Pages.length; idx++) {
      const page = pdfData.Pages[idx];
      const pageText = page.Texts
        .map((t: any) => decodeURIComponent(t.R.map((r: any) => r.T).join('')))
        .join(' ');
      if (pageText.includes('REPORTE DE SEMANAS COTIZADAS EN PENSIONES')) {
        return idx;
      }
    }
    return -1;
  }

  /**
   * Extrae TODOS los periodos cotizados desde la primera página de resumen
   * hasta encontrar "[10] TOTAL SEMANAS COTIZADAS". Detecta el inicio de la tabla
   * en cada página buscando "<documentNumber> <fullName>".
   * @param pdfData Objeto retornado por pdf2json
   * @param documentNumber Número de documento (string)
   * @param fullName Nombre completo (string)
   */
  extractAllSummaryPeriods(
    pdfData: any,
    documentNumber: string,
    fullName: string
  ): Period[] {
    const periods: Period[] = [];
    const startPage = this.findStartPage(pdfData);
    if (startPage < 0) {
      this.logger.warn('No se encontró la sección “REPORTE DE SEMANAS COTIZADAS EN PENSIONES”.');
      return periods;
    }

    let inResumen = false;

    // Recorre desde startPage hasta final
    for (let pIdx = startPage; pIdx < pdfData.Pages.length; pIdx++) {
      const page = pdfData.Pages[pIdx];

      // 1) Agrupar TextItems por Y → Map<y, string[]>
      const linesByY = new Map<number, string[]>();
      for (const txtItem of page.Texts) {
        const y = Math.round(txtItem.y * 100) / 100;
        const txt = decodeURIComponent(txtItem.R.map((r: any) => r.T).join('')).trim();
        if (!linesByY.has(y)) linesByY.set(y, []);
        linesByY.get(y)!.push(txt);
      }

      // 2) Ordenar las coordenadas Y y procesar cada línea
      const sortedYs = Array.from(linesByY.keys()).sort((a, b) => a - b);
      for (const y of sortedYs) {
        const line = linesByY.get(y)!.join(' ');

        // 2.1) Iniciar tabla en la PRIMERA página:
        if (!inResumen && pIdx === startPage) {
          if (line.includes(`${documentNumber} ${fullName}`)) {
            inResumen = true;
            continue;
          }
          continue; // seguir hasta encontrar "<documentNumber> <fullName>"
        }

        // 2.2) Iniciar tabla en páginas intermedias:
        if (!inResumen && pIdx > startPage) {
          if (line.includes(`${documentNumber} ${fullName}`)) {
            inResumen = true;
            continue;
          }
          continue;
        }

        // 2.3) Si estamos dentro de la tabla, chequear final:
        if (inResumen && line.includes('[10] TOTAL SEMANAS COTIZADAS')) {
          return periods; // terminamos de recolectar
        }

        // 2.4) Si inResumen===true y la línea contiene fechas, extraer período
        if (inResumen && /\d{2}\/\d{2}\/\d{4}/.test(line)) {
          const cols = line.split(/\s{2,}/).map(s => s.trim());
          if (cols.length < 6) {
            continue; // no es una fila válida
          }
          const employerId   = cols[0];
          const employerName = cols[1];
          const fromIso      = this.formatDate(cols[2]);
          const toIso        = this.formatDate(cols[3]);
          const ibc          = this.parseNumericValue(cols[4]);
          const weeks        = parseFloat(cols[5].replace(',', '.')) || 0;

          // Descartar filas de tu propio documento con weeks=0
          if (employerId === documentNumber && weeks === 0) {
            continue;
          }

          periods.push({ employerId, employerName, from: fromIso, to: toIso, weeks, ibc });
        }
      }
    }

    // Si nunca encontramos "[10] TOTAL SEMANAS COTIZADAS", devolvemos lo recolectado
    return periods;
  }

  /**
   * Convierte fecha DD/MM/AAAA → YYYY-MM-DD
   */
  private formatDate(dateString: string): string {
    const m = dateString.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : dateString;
  }

  /**
   * Parsea un valor numérico (IBC o semanas), p.ej. "$665.070" → 665070 o "286,43" → 286.43
   */
  private parseNumericValue(value: string): number {
    return parseFloat(value.replace(/[^\d,\.]/g, '').replace(',', '.')) || 0;
  }
}
```

---

## 7. PdfParserService (Orquestador)

### Descripción
Este servicio inyecta los componentes anteriores y sigue estos pasos:
1. Verificar existencia del archivo.  
2. Cargar PDF.  
3. Concatenar texto completo.  
4. Validar formato.  
5. Extraer `documentNumber`.  
6. Extraer `fullName`.  
7. Extraer todos los períodos (`extractAllSummaryPeriods`).  
8. Extraer total de semanas (opcional).  
9. Construir y devolver el objeto `ExtractedData`.

```ts
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { PdfLoaderService } from './pdf-loader.service';
import { ColpensionesValidatorService } from './colpensiones-validator.service';
import { AfiliadoExtractorService } from './afiliado-extractor.service';
import { PeriodosExtractorService } from './periodos-extractor.service';
import { Period, ExtractedData } from './pdf-parser.service'; // Ajustar rutas

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
   * Orquesta la extracción de datos del PDF.
   * @param filePath Ruta al archivo PDF
   */
  async extractDataFromPdf(filePath: string): Promise<ExtractedData> {
    const startTime = Date.now();

    // 1. Verificar existencia del archivo
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        errorMessage: `Archivo no encontrado: ${filePath}`
      };
    }
    const fileStats = fs.statSync(filePath);

    // 2. Cargar PDF
    const pdfData = await this.pdfLoader.load(filePath);

    // 3. Concatenar texto completo (opcional)
    const fullText = this.pdfLoader.toFullText(pdfData);

    // 4. Validar formato de Colpensiones
    if (!this.colpensValidator.isColpensionesFormat(fullText)) {
      return {
        success: false,
        errorMessage: 'El PDF no corresponde al formato esperado de Colpensiones',
        extractionMeta: {
          durationMs: Date.now() - startTime,
          parserVersion: this.PARSER_VERSION,
          pdfSize: fileStats.size
        }
      };
    }

    // 5. Extraer documento
    const documento = this.afiliadoExtractor.extractDocument(fullText, pdfData);

    // 6. Extraer nombre
    const nombre = documento
      ? this.afiliadoExtractor.extractFullName(pdfData, documento)
      : undefined;

    // 7. Extraer todos los períodos (puede abarcar varias páginas)
    let periodos: Period[] | undefined = undefined;
    if (documento && nombre) {
      periodos = this.periodosExtractor.extractAllSummaryPeriods(pdfData, documento, nombre);
      // No validamos un número fijo de filas; cada informe será distinto
      this.logger.debug(`Períodos extraídos: ${periodos.length}`);
    }

    // 8. Extraer total de semanas (opcional)
    const totalSemanas = this.afiliadoExtractor.extractTotalWeeks(fullText);

    // 9. Construir el resultado
    const result: ExtractedData = {
      success: true,
      fullName: nombre,
      document: documento,
      totalWeeks: totalSemanas,
      periods: periodos,
      extractionMeta: {
        durationMs: Date.now() - startTime,
        parserVersion: this.PARSER_VERSION,
        pdfSize: fileStats.size
      }
    };

    return result;
  }
}
```

---

## 8. Notas Importantes y Buenas Prácticas

1. **Eliminar cualquier dependencia de un prefijo fijo `"C "`** para detectar inicio de tabla. Solo usar `"<documentNumber> <fullName>"`.  
2. **Agrupar TextItems por coordenada Y** para ensamblar líneas antes de analizar contenido.  
3. **Dividir columnas de la tabla** usando `split(/\s{2,}/)` (dos o más espacios) para separar ID, nombre, fechas, IBC, semanas.  
4. **Descartar filas vacías** donde `employerId === documentNumber && weeks === 0`.  
5. **Finalizar la extracción** apenas aparezca `"[10] TOTAL SEMANAS COTIZADAS"`.  
6. **Extraer `fullName` solo en la primera página** buscando `"Nombre:"`, sin heurísticas globales.  
7. **No validar cantidad fija de períodos**: el método devolverá tantos como encuentre.  
8. **Registrar logs de debug** en cada paso crítico para ayudar a diagnosticar posibles variaciones de otros PDFs. Por ejemplo:
   ```ts
   this.logger.debug(`Página inicial de resumen: ${startPage}`);
   this.logger.debug(`Detectado inicio de tabla en página ${pIdx}`);
   this.logger.debug(`Período agregado: ${employerName} (${fromIso} a ${toIso}), semanas=${weeks}`);
   this.logger.warn(`No se encontró "[10] TOTAL SEMANAS COTIZADAS" en ninguna página.`);
   ```
9. **Pruebas unitarias**:
   - Simular un PDF mínimo donde la tabla quepa en una sola página.  
   - Simular un PDF donde la tabla abarque varias páginas.  
   - Verificar que `periods.length` coincida con el número verdadero de filas.  
   - Verificar que `extractFullName` devuelva exactamente el nombre esperado (p.ej. `"GERMAN TABARES CARREÑO"`).

---

## 9. Ejemplo de Flujo Completo

1. **Unir todos los servicios** en `AppModule` o módulo correspondiente:
   ```ts
   @Module({
     providers: [
       PdfLoaderService,
       ColpensionesValidatorService,
       AfiliadoExtractorService,
       PeriodosExtractorService,
       PdfParserService
     ],
     exports: [PdfParserService]
   })
   export class PdfParserModule {}
   ```
2. **Invocar `PdfParserService.extractDataFromPdf('/ruta/CC-79308073-HL-20250519.pdf')`**  
   - Debería devolver algo similar a:
     ```json
     {
       "success": true,
       "fullName": "GERMAN TABARES CARREÑO",
       "document": "79308073",
       "totalWeeks": 1306.57,
       "periods": [
         {
           "employerId": "1003901407",
           "employerName": "FILMTEX COLISSIN LTD",
           "from": "1987-07-21",
           "to": "1993-01-14",
           "weeks": 286.43,
           "ibc": 665070
         },
         ... (otros 46 períodos) ...
       ],
       "extractionMeta": {
         "durationMs": 1200,       
         "parserVersion": "v1.0.3",
         "pdfSize": 2147000
       }
     }
     ```
3. **Revisar logs** para verificar que en cada página:
   - Se detectó el inicio con `"<documentNumber> <fullName>"`.  
   - Se encontraron todas las filas hasta `"[10] TOTAL SEMANAS COTIZADAS"`.  

---

## 10. Conclusión

Siguiendo estos pasos y la estructura modular propuesta, el equipo de desarrollo podrá:

- Mantener cada trozo de lógica en un servicio con responsabilidad única.  
- Extraer correctamente el nombre del afiliado (solo de la primera página).  
- Recorrer la tabla de períodos que puede abarcar múltiples páginas, sin depender de prefijos fijos.  
- Parar la extracción exactamente al encontrar `"[10] TOTAL SEMANAS COTIZADAS"`.  
- Evitar falsos positivos y filas vacías.  
- Adaptarse a cualquier afiliado (cualquier `documentNumber` y `fullName`) y a PDF con distinto número de períodos.

Estas instrucciones deberían ser suficientes para implementar la refactorización de manera ordenada y libre de regresiones. ¡Éxitos en el desarrollo!