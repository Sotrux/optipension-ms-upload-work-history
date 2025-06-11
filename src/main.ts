import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from './common/services/logger.service';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import expressSanitizer from 'express-sanitizer';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Filtro global de excepciones
  app.useGlobalFilters(new AllExceptionsFilter(logger));
  
  // Interceptor de logging global
  app.useGlobalInterceptors(new LoggingInterceptor(logger));

  // Configuración de CORS
  app.enableCors();

  // Configurar prefijo global para las rutas API
  app.setGlobalPrefix('optipension/api');

  // Configurar Swagger
  const config = new DocumentBuilder()
    .setTitle('OptiPensión API')
    .setDescription('API para el procesamiento de Historias Laborales de Colpensiones')
    .setVersion('1.0')
    .addTag('PDF Processing', 'Endpoints para procesar PDFs de historias laborales')
    .addTag('Historia Laboral', 'Endpoints para subir y gestionar archivos de historia laboral')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Introduce el token JWT',
        in: 'header',
      },
      'JWT-auth', // Este nombre debe coincidir con el usado en @ApiBearerAuth()
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // Configuración de seguridad DESPUÉS de Swagger
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
  
  // Sanitización de entradas
  app.use(expressSanitizer());

  // Configuración de validación global
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Servidor iniciado en http://localhost:${port}`, 'BOOTSTRAP');
  logger.log(`Documentación Swagger disponible en http://localhost:${port}/api-docs`, 'BOOTSTRAP');
}
bootstrap(); 