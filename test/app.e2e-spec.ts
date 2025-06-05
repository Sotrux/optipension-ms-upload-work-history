import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from './../src/app.module';
import helmet from 'helmet';
import { LoggerService } from '../src/common/services/logger.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';

describe('HistoryLaboralController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({
      bufferLogs: true,
    });

    const logger = app.get(LoggerService);
    app.useLogger(logger);

    // Filtro global de excepciones
    app.useGlobalFilters(new AllExceptionsFilter(logger));
    
    // Interceptor de logging global
    app.useGlobalInterceptors(new LoggingInterceptor(logger));

    // Configurar prefijo global para las rutas API
    app.setGlobalPrefix('optipension/api');

    // Configuración de seguridad
    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));

    // Configuración de validación global
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Prueba para verificar que el endpoint está protegido por autenticación
  it('/optipension/api/history-laboral/upload (POST) - debería rechazar peticiones sin token de autenticación', () => {
    return supertest(app.getHttpServer())
      .post('/optipension/api/history-laboral/upload')
      .expect(401);
  });

  // Nota: Para ejecutar pruebas completas con archivos, necesitaríamos:
  // 1. Crear archivos de prueba temporales
  // 2. Configurar mocks para el servicio de autenticación
  // 3. Generar tokens JWT válidos para las pruebas

  // Este es un comentario de prueba que muestra cómo se implementaría una prueba completa
  /* 
  it('/optipension/api/history-laboral/upload (POST) - debería aceptar un archivo PDF válido', () => {
    // Crear un token de prueba (o usar un token real)
    const token = 'Bearer valid-test-token'; 
    
    // Ruta a un archivo PDF de prueba
    const testFilePath = path.join(__dirname, 'fixtures', 'test.pdf');
    
    return supertest(app.getHttpServer())
      .post('/optipension/api/history-laboral/upload')
      .set('Authorization', token)
      .attach('file', testFilePath)
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.fileName).toBeDefined();
      });
  });
  */
}); 