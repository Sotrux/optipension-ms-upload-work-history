# Códigos de Error - API de Historia Laboral

Este documento detalla los posibles códigos de error que pueden producirse en la API, sus causas y cómo solucionarlos.

## Estructura de Respuesta de Error

Las respuestas de error siguen una estructura consistente:

```json
{
  "statusCode": 400,
  "message": "Descripción del error",
  "code": "ERROR_CODE",
  "details": {
    "campo1": "valor1",
    "campo2": "valor2"
  }
}
```

## Códigos de Error HTTP

| Código HTTP | Descripción |
|-------------|-------------|
| 400 | Bad Request - La solicitud contiene parámetros inválidos o está mal formada |
| 401 | Unauthorized - No se ha proporcionado un token de autenticación válido |
| 403 | Forbidden - El token es válido pero no tiene permisos para el recurso |
| 404 | Not Found - El recurso solicitado no existe |
| 413 | Payload Too Large - El archivo excede el tamaño máximo permitido |
| 415 | Unsupported Media Type - El tipo de archivo no es soportado |
| 429 | Too Many Requests - Se ha excedido el límite de peticiones permitidas |
| 500 | Internal Server Error - Error interno del servidor |

## Códigos de Error Específicos

### Validación de Archivos

| Código | Descripción | Solución |
|--------|-------------|----------|
| `FILE_MISSING` | No se ha proporcionado ningún archivo | Asegúrese de incluir un archivo en la solicitud |
| `INVALID_FILE` | El archivo proporcionado no es válido | Verifique que el archivo sea accesible y no esté corrupto |
| `INVALID_MIME_TYPE` | El tipo MIME del archivo no es válido | Asegúrese de que el archivo sea un PDF válido |
| `INVALID_EXTENSION` | La extensión del archivo no es .pdf | Asegúrese de que el archivo tenga extensión .pdf |
| `FILE_TOO_LARGE` | El archivo excede el tamaño máximo permitido (2MB) | Reduzca el tamaño del archivo |

### Autenticación y Autorización

| Código | Descripción | Solución |
|--------|-------------|----------|
| `UNAUTHORIZED` | No se ha proporcionado un token de autenticación | Incluya un token JWT válido en el header Authorization |
| `INVALID_TOKEN` | El token proporcionado no es válido | Verifique que el token sea correcto y no haya expirado |
| `TOKEN_EXPIRED` | El token ha expirado | Obtenga un nuevo token de autenticación |
| `FORBIDDEN` | No tiene permisos para acceder al recurso | Contacte al administrador para obtener los permisos necesarios |

### Rate Limiting

| Código | Descripción | Solución |
|--------|-------------|----------|
| `TOO_MANY_REQUESTS` | Se ha excedido el límite de peticiones (3 por minuto) | Espere unos minutos antes de volver a intentarlo |

### Errores del Servidor

| Código | Descripción | Solución |
|--------|-------------|----------|
| `INTERNAL_SERVER_ERROR` | Error interno del servidor | Contacte al administrador del sistema |
| `SERVICE_UNAVAILABLE` | El servicio no está disponible temporalmente | Intente nuevamente más tarde |

## Ejemplos de Respuestas

### Error de archivo faltante

```json
{
  "statusCode": 400,
  "message": "No se ha proporcionado ningún archivo",
  "code": "FILE_MISSING"
}
```

### Error de tipo de archivo inválido

```json
{
  "statusCode": 400,
  "message": "El archivo debe ser un PDF",
  "code": "INVALID_MIME_TYPE",
  "details": {
    "received": "image/jpeg",
    "allowed": ["application/pdf"]
  }
}
```

### Error de token de autenticación

```json
{
  "statusCode": 401,
  "message": "Acceso denegado: Token no proporcionado",
  "code": "UNAUTHORIZED"
}
```

### Error de límite de tasa excedido

```json
{
  "statusCode": 429,
  "message": "Demasiadas solicitudes, por favor intente nuevamente en 30 segundos",
  "code": "TOO_MANY_REQUESTS",
  "details": {
    "retryAfter": 30
  }
}
``` 