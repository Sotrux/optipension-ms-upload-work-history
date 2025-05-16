# optipension-ms-upload-work-history

## 🚀 Descripción
Carga de archivo de Historia Laboral al repositorio en la nube

## ⚡ Tecnologías
- NestJS
- Fastify
- Prisma ORM
- TypeScript

## 🏃 Ejecutar el Proyecto
```bash
npm install
npm run start:dev
```

## 📂 Estructura del Proyecto
- **src/controllers/**: Controladores para manejar rutas HTTP.
- **src/services/**: Lógica de negocio.
- **src/modules/**: Organización modular.
- **src/common/**: Recursos compartidos.
- **prisma/**: Esquemas y migraciones de Prisma.
- **tests/**: Pruebas unitarias e integración.

## 🔒 Seguridad
- Implementación de middleware de seguridad
- Protección contra XSS y otros ataques comunes
- Control de tasas de solicitud (rate limiting)

## 📊 Monitoreo y Logging
- Integración con Papertrail para logging centralizado
- Estructura de logs estandarizada

## 🚀 CI/CD
- Configuración de GitHub Actions para integración continua
- Despliegue automatizado a entornos de staging y producción

## 📝 Convenciones de Código
- ESLint para análisis estático de código
- Prettier para formateo consistente
- Commits semánticos siguiendo convenciones estándar