import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PdfParserService } from './modules/pdf-processing/services/pdf-parser.service';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Obtener el servicio de parsing de PDF
  const pdfParserService = app.get(PdfParserService);

  // Ruta al archivo de prueba
  const testFilePath = path.join(process.cwd(), 'test-uploads', 'CC-79308073-HL-20250519.pdf');
  console.log(`Probando parser con el archivo: ${testFilePath}`);

  try {
    // Procesar el PDF
    console.time('Tiempo de procesamiento');
    const result = await pdfParserService.extractDataFromPdf(testFilePath);
    console.timeEnd('Tiempo de procesamiento');

    // Mostrar resultados
    console.log('\n--- RESULTADOS DE LA EXTRACCIÓN ---');
    console.log(`Éxito: ${result.success}`);
    console.log(`Nombre: ${result.fullName || 'No encontrado'}`);
    console.log(`Documento: ${result.document || 'No encontrado'}`);
    console.log(`Total semanas: ${result.totalWeeks || 'No encontrado'}`);
    
    if (result.periods && result.periods.length > 0) {
      console.log(`Períodos encontrados: ${result.periods.length}`);
      console.log('Primer período:');
      console.log(JSON.stringify(result.periods[0], null, 2));
    } else {
      console.log('No se encontraron períodos');
    }

    console.log('\nMetadatos:');
    console.log(JSON.stringify(result.extractionMeta, null, 2));
  } catch (error) {
    console.error('Error al procesar el PDF:', error);
  } finally {
    // Cerrar la aplicación
    await app.close();
  }
}

bootstrap(); 