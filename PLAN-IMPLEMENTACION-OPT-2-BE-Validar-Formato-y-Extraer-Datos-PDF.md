# Plan de Implementación - OPT-2 Validar Formato del PDF y Extraer Datos Básicos

## 1. OPT-2-BE-1 – Configurar Cola BullMQ y Worker de Parsing
- [ ] Instalar y configurar BullMQ y Redis local.
- [ ] Crear la cola `hlParsing`.
- [ ] Modificar el flujo de subida para encolar `{ uploadId, s3Key }` tras cada upload exitoso.
- [ ] Implementar worker inicial que consuma la cola y registre logs básicos.
- [ ] Pruebas locales: encolar y consumir jobs usando archivos de `test-uploads`.

## 2. OPT-2-BE-2 – Servicio de Parsing de PDF de Colpensiones
- [ ] Descargar el PDF desde el mock/local (para pruebas) o Spaces (en producción).
- [ ] Usar `pdf2json` para extraer texto y datos.
- [ ] Implementar heurísticas/regex para extraer nombre, documento, semanas, períodos.
- [ ] Marcar como "No legible" los campos que no se puedan extraer.
- [ ] Pruebas unitarias con ejemplos reales de PDFs en `test-uploads`.

## 3. OPT-2-BE-3 – Persistir Datos Extraídos y Estado del Proceso
- [ ] Crear tabla `hl_extractions` en el mismo esquema que `hl_history_laboral_uploads`.
- [ ] Guardar los datos extraídos y el estado (`PROCESSED` o `ERROR`).
- [ ] Garantizar idempotencia: actualizar si ya existe registro para el upload.
- [ ] Pruebas de integración con base de datos local.

## 4. OPT-2-BE-4 – Endpoint de Estado y Resumen
- [ ] Crear endpoint `GET /history-laboral/:uploadId/status` (devuelve estado y motivo si error).
- [ ] Crear endpoint `GET /history-laboral/:uploadId/summary` (devuelve resumen si `processed`, 204 si no).
- [ ] Proteger rutas con AuthGuard y validar dueño por `user_id`.
- [ ] Pruebas de integración usando archivos de `test-uploads`.

## 5. OPT-2-BE-5 – Logging de Parsing y Errores en Papertrail
- [ ] Revisar integración de Papertrail; si no existe, agregar `pino-papertrail`.
- [ ] Loggear cada parsing exitoso o fallido, sin datos sensibles.
- [ ] Pruebas manuales y unitarias de logging.

---

**Notas:**
- Todas las pruebas locales usarán archivos PDF reales en el directorio `test-uploads`.
- Se seguirán las guías de desarrollo y estándares de base de datos del proyecto.
- Se documentarán los endpoints y DTOs en Swagger. 