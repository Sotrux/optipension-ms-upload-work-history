# Plan de Implementación - OPT-1-BE-2 Subir y Almacenar PDF en DigitalOcean Spaces

## 1. Diseño y Creación de la Tabla ✅
- ✅ Crear la tabla `hl_history_laboral_uploads` siguiendo los estándares de nomenclatura y auditoría.
- ✅ Campos requeridos:
  - `id` (SERIAL, PK)
  - `uu` (UUID, generado por función personalizada)
  - `user_id` (varchar, ID de usuario Auth0)
  - `document_type` (varchar(2))
  - `document_number` (varchar(12))
  - `original_filename` (varchar)
  - `file_size` (int)
  - `spaces_key` (varchar, key en Spaces)
  - `spaces_url` (varchar, URL pública)
  - `is_active` (boolean)
  - Auditoría: `created_at`, `updated_at`, `created_by`, `updated_by`
- ✅ Crear migración Prisma para la tabla.
- ✅ Incluir triggers/políticas para campos sensibles y auditoría según los estándares.

## 2. Configuración de DigitalOcean Spaces (Pendiente)
- Solicitar y configurar las credenciales de acceso (key, secret, endpoint, bucket).
- Guardar las credenciales en variables de entorno seguras.
- Instalar e integrar el SDK compatible S3 (`@aws-sdk/client-s3`).

## 3. Servicio de Subida de Archivos (En progreso)
- ✅ Implementar DTOs y validaciones:
  - ✅ DTO de request con validaciones para tipo y número de documento
  - ✅ DTO de respuesta estándar usando IServiceResponse
- Pendiente:
  - Implementar servicio NestJS para:
    - Recibir el archivo (PDF, max 2MB, validación ya implementada).
    - Generar el nombre del archivo según la convención: `TipoDocumento-NumeroDocumento-HL-Fecha.pdf`
    - Subir el archivo a Spaces.
    - Obtener la URL pública.
    - Registrar el evento en la base de datos.

## 4. Endpoint y Controlador (En progreso)
- ✅ Crear endpoint POST `/history-laboral/upload` protegido por guard JWT.
- ✅ Usar DTOs y Pipes para validar los datos recibidos (tipo y número de documento).
- ✅ Usar el estándar de respuesta definido en la guía (`IServiceResponse`).
- Pendiente:
  - Integrar con el servicio de subida de archivos.
  - Implementar manejo de errores específicos.

## 5. Manejo de Errores (En progreso)
- ✅ Usar filtros de excepción globales para respuestas consistentes.
- Pendiente:
  - Manejar errores de conexión a Spaces.
  - Manejar errores de validación específicos.
  - Manejar errores de base de datos.

## 6. Pruebas (Pendiente)
- Pruebas unitarias del servicio de subida (mock de Spaces y DB).
- Pruebas de integración del endpoint (mock de Spaces).
- Validar casos de éxito, error de autenticación, error de tamaño, error de conexión.
- Usar la base de datos local `optipension` en el puerto 5435 para pruebas.

## 7. Documentación (En progreso)
- ✅ Documentar el endpoint con Swagger.
- ✅ Incluir ejemplos de request/response.
- Pendiente:
  - Documentar posibles errores.
  - Actualizar README con instrucciones de configuración. 