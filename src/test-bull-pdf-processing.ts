import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PdfProcessingService } from './modules/pdf-processing/pdf-processing.service';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Obtener el servicio de procesamiento de PDF
  const pdfProcessingService = app.get(PdfProcessingService);

  // Ruta al archivo de prueba
  const testFilePath = path.join(process.cwd(), 'test-uploads', 'CC-79308073-HL-20250519.pdf');
  console.log(`Probando procesamiento con el archivo: ${testFilePath}`);

  try {
    // 1. Procesar el PDF para obtener datos preliminares
    console.time('Tiempo de procesamiento preliminar');
    const result = await pdfProcessingService.processUploadedPdf(
      'test-user-123', 
      'Usuario de Prueba',
      testFilePath,
      'CC-79308073-HL-20250519.pdf'
    );
    console.timeEnd('Tiempo de procesamiento preliminar');

    console.log('\n--- RESULTADOS DEL PROCESAMIENTO PRELIMINAR ---');
    console.log(`Éxito: ${result.success}`);
    if (result.success) {
      console.log(`Mensaje: ${result.message}`);
      console.log(`Nombre: ${result.fullName || 'No encontrado'}`);
      console.log(`Documento: ${result.document || 'No encontrado'}`);
      console.log(`Total semanas: ${result.totalWeeks || 'No encontrado'}`);
      console.log(`Job ID: ${result.jobId}`);
      
      // 2. Esperar unos segundos y verificar el estado del job
      if (result.jobId) {
        console.log('\nEsperando 2 segundos para consultar el estado del job...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`\n--- ESTADO DEL JOB ${result.jobId} ---`);
        const status = await pdfProcessingService.getJobStatus(result.jobId);
        console.log(JSON.stringify(status, null, 2));
      }
    } else {
      console.log(`Error: ${result.errorMessage}`);
    }
  } catch (error) {
    console.error('Error al procesar el PDF:', error);
  } finally {
    // Esperar un poco antes de cerrar para que los logs se muestren
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Cerrar la aplicación
    await app.close();
  }
}

bootstrap(); 