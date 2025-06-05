# Guía de Desarrollo para el Backend de Optipensión

## 1. Validación de Datos

### Uso de Pipes y DTOs de validación
Usa **Pipes de Validación** y **DTOs (Data Transfer Objects)** para validar y transformar los datos de entrada.

### Regla
Todos los controladores deben usar **DTOs** y **Pipes** para validar los datos recibidos en las peticiones.

### Práctica
Ejemplo de uso de un DTO y un Pipe de validación:

```typescript
export class CreateClientDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;
}

@Post()
create(@Body(new ValidationPipe()) createClientDto: CreateClientDto) {
  return this.clientsService.create(createClientDto);
}

```
En este ejemplo:

El DTO (CreateClientDto) asegura que solo los datos válidos sean aceptados por el sistema.
La clase ValidationPipe es usada para validar y transformar los datos enviados al controlador según las reglas definidas en el DTO (en este caso, que el nombre sea una cadena y el email tenga un formato válido).

### Centralización de Validaciones y Expresiones Regulares

### Descripción
Para evitar inconsistencias y duplicación de código, se recomienda centralizar todas las expresiones regulares y constantes de validación en un archivo de constantes compartido. Esto asegura que los patrones y reglas de validación sean consistentes en toda la aplicación.

### Implementación
- Crear un archivo llamado `shared/constants/validation.constants.ts` para almacenar expresiones regulares, como los patrones de validación para correos electrónicos, números de teléfono, nombres, etc.
- Referenciar estas constantes en todos los DTOs y pipes de validación, garantizando que los patrones se mantengan consistentes.

### Ejemplo de Código
Archivo de constantes: `validation.constants.ts`
```typescript
export const PHONE_REGEX = /^\\+[1-9]\\d{1,14}$/; // Formato E.164
export const NAME_REGEX = /^[a-zA-Z\\s]{3,}$/;    // Letras y espacios, mínimo 3 caracteres
export const EMAIL_REGEX = /^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$/; // Formato de correo estándar
```
### Uso en un DTO:

import { IsString, Matches } from 'class-validator';
import { NAME_REGEX } from 'shared/constants/validation.constants';

```
export class CreateUserDto {
  @IsString()
  @Matches(NAME_REGEX, { message: 'El nombre debe contener solo letras y espacios, mínimo 3 caracteres' })
  name: string;
}
```

## 2. Manejo de Errores

### Recomendación
Utiliza los **Filtros de Excepciones** de NestJS para manejar los errores de manera centralizada y consistente en toda la aplicación.

### Regla
Todo el manejo de errores debe realizarse a través de **filtros de excepción** y no mediante `try/catch` en los controladores.

### Práctica
Ejemplo de un filtro de excepción global:

```typescript
@Catch(HttpException)
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      message: exception.message,
    });
  }
}
```
Este filtro captura cualquier excepción que herede de HttpException y genera una respuesta consistente con el código de estado HTTP y un mensaje.

Aplicación global del filtro:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(3000);
}
bootstrap();
```
De esta manera, el filtro **AllExceptionsFilter** se aplica globalmente a todas las rutas y controladores de la aplicación.

## 3. Estandarización de Respuestas en los Servicios

### Descripción
Para asegurar que las respuestas de los servicios sean consistentes y fáciles de manejar en el cliente, se recomienda definir un formato de respuesta estandarizado. Este formato debería incluir propiedades comunes como `success`, `message`, `data` y `error`.

### Implementación
- Definir una interfaz genérica de respuesta (`IServiceResponse`) en un archivo compartido (`shared/interfaces/response.interface.ts`).
- Aplicar esta interfaz en todos los servicios, garantizando que las respuestas sean homogéneas en toda la aplicación.

### Ejemplo de Código
```typescript
export interface IServiceResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
```
### Ejemplo de Uso

```
import { Injectable } from '@nestjs/common';
import { IServiceResponse } from 'shared/interfaces/response.interface';

@Injectable()
export class ClientsService {
  findAll(): IServiceResponse<Client[]> {
    try {
      const clients = this.getAllClients(); // lógica para obtener los clientes
      return {
        success: true,
        message: 'Clients retrieved successfully',
        data: clients,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error retrieving clients',
        error: error.message,
      };
    }
  }
}
```
En este ejemplo, el servicio `ClientsService` devuelve una respuesta que cumple con la interfaz `IServiceResponse`. Esto asegura que las respuestas del servicio sigan una estructura clara y consistente, facilitando su manejo en el cliente.

## 4. Testing Unitario e Integración

### Recomendación
Garantizar que todo el código sea probado mediante **pruebas unitarias** e **integración** usando **Jest**, que es la herramienta de testing recomendada por **NestJS**.

### Regla
Todo el código nuevo debe incluir pruebas unitarias que cubran la lógica de los servicios y controladores. También se deben implementar pruebas de integración cuando la lógica involucre la interacción entre múltiples componentes.

### Práctica
Ejemplo de prueba unitaria para un servicio:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from './clients.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Client } from './client.entity';

describe('ClientsService', () => {
  let service: ClientsService;
  let repository: Repository<Client>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        {
          provide: getRepositoryToken(Client),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    repository = module.get<Repository<Client>>(getRepositoryToken(Client));
  });

  it('should return all clients', async () => {
    const result = ['client1', 'client2'];
    jest.spyOn(repository, 'find').mockResolvedValue(result);

    expect(await service.findAll()).toBe(result);
  });
});
```

En este ejemplo:

- Se crea un módulo de prueba con TestingModule.
- Jest se usa para simular (mock) las llamadas al repositorio de TypeORM, permitiendo aislar la lógica del servicio en las pruebas unitarias.

### Pruebas de Integración
Para pruebas de integración, puedes realizar tests que cubran la interacción entre diferentes servicios o incluso involucrar la base de datos si es necesario. Ejemplo de una prueba de integración básica:

```typescript
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('ClientsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/clients (GET)', () => {
    return request(app.getHttpServer())
      .get('/clients')
      .expect(200)
      .expect([]);
  });

  afterAll(async () => {
    await app.close();
  });
});
```
En este ejemplo:

- Supertest se usa para enviar solicitudes HTTP reales a la aplicación durante la prueba de integración.
- Se está verificando si el endpoint /clients responde correctamente con un código de estado 200.

## 5. Documentación del API (Swagger)

### Recomendación
Utiliza **Swagger** para generar automáticamente la documentación de la API. Esto facilita a los desarrolladores y usuarios de la API conocer los endpoints disponibles, los tipos de datos que se esperan y las respuestas generadas por el sistema.

### Regla
Todos los controladores deben estar documentados usando los **decoradores de Swagger** para definir las rutas, parámetros y respuestas. La documentación generada debe ser accesible desde un endpoint como `/api-docs`.

### Práctica
Configurar **Swagger** en la aplicación **NestJS**:

1. Instalar el paquete necesario para **Swagger**:
   ```bash
   npm install --save @nestjs/swagger swagger-ui-express

2. Configurar Swagger en el archivo principal (main.ts):

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Sotrux API')
    .setDescription('API documentation for Sotrux project')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(3000);
}
bootstrap();
```

3. Usar decoradores en los controladores para definir las rutas, parámetros y respuestas:

```typescript
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  @ApiOperation({ summary: 'Create a new client' })
  @ApiResponse({ status: 201, description: 'Client created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @Post()
  create(@Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto);
  }
}
```
En este ejemplo:

- @ApiTags('clients'): Agrupa los endpoints de este controlador bajo la etiqueta "clients" en la documentación de Swagger.
- @ApiOperation({ summary: 'Create a new client' }): Proporciona una breve descripción de lo que hace este endpoint.
- @ApiResponse({ status: 201, description: 'Client created successfully.' }): Documenta las posibles respuestas HTTP, especificando el código de estado y una breve descripción.

4. Acceso a la documentación:
- Una vez configurado, la documentación de la API estará disponible en el navegador en el endpoint /api-docs.

## 6. Seguridad en la Base de Datos

Aspectos claves de seguridad para Sotrux se delegan a la base de datos al considerar que es allí el lugar más apropiado por razones de eficiencia, seguridad y control. Para lograr este objetivo se definen los siguientes lineamientos.

### 6.1 Uso de Row-Level Security (RLS)

RLS permite definir políticas que controlan el acceso y la actualización de los datos en función de condiciones específicas. Se implementa RLS para todas las tablas del sistema de manera automática durante el despliegue. Los desarrolladores no necesitan incluir la implementación RLS en su desarrollo, únicamente las políticas de seguridad en los casos en los que se requiera.
