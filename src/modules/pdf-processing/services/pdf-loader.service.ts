import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
const PDFParser = require('pdf2json');

@Injectable()
export class PdfLoaderService {
  private readonly logger = new Logger(PdfLoaderService.name);

  /**
   * Carga el PDF en memoria y devuelve el objeto pdfData.
   * @param filePath Ruta al archivo PDF
   */
  async load(filePath: string): Promise<any> {
    this.logger.debug(`Cargando PDF desde: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo no existe: ${filePath}`);
    }
    
    return new Promise((resolve, reject) => {
      const parser = new PDFParser();
      parser.on('pdfParser_dataError', (err: any) => {
        this.logger.error(`Error al parsear PDF: ${err.parserError}`);
        reject(new Error(err.parserError));
      });
      parser.on('pdfParser_dataReady', (pdfData: any) => {
        this.logger.debug(`PDF cargado exitosamente: ${pdfData.Pages.length} páginas`);
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