# Guía de Integración Frontend - API de Historia Laboral

Este documento proporciona las directrices para integrar el endpoint de carga de archivos PDF desde aplicaciones frontend.

## Endpoint de Carga de Archivos

### Información General

- **URL**: `https://[dominio]/optipension/api/history-laboral/upload`
- **Método**: `POST`
- **Autenticación**: JWT Bearer Token (Auth0)
- **Tipo de Contenido**: `multipart/form-data`

## Requisitos para la Carga de Archivos

| Parámetro | Valor |
|-----------|-------|
| Tipo de archivo | PDF únicamente |
| Extensión | .pdf |
| Tamaño máximo | 2MB |
| Nombre del campo | file |
| Rate Limit | 3 solicitudes por minuto |

## Autenticación

Todas las solicitudes deben incluir un token JWT válido de Auth0 en el encabezado de autorización:

```
Authorization: Bearer <token_jwt>
```

## Ejemplo de Integración

### Ejemplo con JavaScript (Fetch API)

```javascript
async function uploadFile(file, authToken) {
  // Validaciones del lado del cliente
  if (!file) {
    throw new Error('Debe seleccionar un archivo');
  }
  
  if (file.type !== 'application/pdf') {
    throw new Error('El archivo debe ser un PDF');
  }
  
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('El archivo no debe exceder 2MB');
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('https://[dominio]/optipension/api/history-laboral/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error en la carga del archivo');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error al cargar el archivo:', error);
    throw error;
  }
}
```

### Ejemplo con React + Axios

```jsx
import React, { useState } from 'react';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';

function FileUploader() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const { getAccessTokenSilently } = useAuth0();

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);
    setError(null);
  };

  const validateFile = (file) => {
    if (!file) {
      return 'Debe seleccionar un archivo';
    }
    
    if (file.type !== 'application/pdf') {
      return 'El archivo debe ser un PDF';
    }
    
    if (file.size > 2 * 1024 * 1024) {
      return 'El archivo no debe exceder 2MB';
    }
    
    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const token = await getAccessTokenSilently();
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(
        'https://[dominio]/optipension/api/history-laboral/upload',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      setSuccess(true);
      console.log('Archivo cargado con éxito:', response.data);
    } catch (error) {
      let errorMessage = 'Error al cargar el archivo';
      
      if (error.response) {
        // El servidor respondió con un código de estado diferente de 2xx
        errorMessage = error.response.data.message || errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Carga de Historia Laboral</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="file">Seleccionar archivo PDF:</label>
          <input 
            type="file" 
            id="file" 
            accept=".pdf,application/pdf" 
            onChange={handleFileChange} 
          />
        </div>
        
        {error && <div className="error">{error}</div>}
        {success && <div className="success">Archivo cargado correctamente</div>}
        
        <button type="submit" disabled={!file || loading}>
          {loading ? 'Cargando...' : 'Cargar Archivo'}
        </button>
      </form>
    </div>
  );
}

export default FileUploader;
```

## Manejo de Respuestas

### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "message": "Archivo PDF válido recibido correctamente",
  "fileName": "historia_laboral.pdf",
  "fileSize": 1048576
}
```

### Respuestas de Error

Consulte la documentación detallada de errores en [ERROR-CODES.md](./ERROR-CODES.md).

## Recomendaciones para la Implementación Frontend

1. **Validaciones del lado del cliente**:
   - Validar el tipo de archivo antes de enviarlo (solo PDF)
   - Verificar el tamaño del archivo (máximo 2MB)
   - Mostrar mensajes de error descriptivos

2. **Manejo de la autenticación**:
   - Implementar el flujo de autenticación de Auth0
   - Renovar el token automáticamente cuando sea necesario
   - Manejar estados de "no autenticado" con redirecciones al login

3. **Experiencia de usuario**:
   - Mostrar indicadores de progreso durante la carga
   - Incluir mensajes de éxito o error claramente visibles
   - Permitir reintentar cargas fallidas
   - Implementar validación de arrastrar y soltar (drag & drop) para mejor UX

4. **Manejo de errores**:
   - Implementar reintentos automáticos para errores de red
   - Manejar adecuadamente los errores 429 (rate limiting)
   - Mostrar mensajes específicos según el código de error recibido

5. **Seguridad**:
   - No almacenar tokens sensibles en localStorage (preferir sessionStorage o cookies HttpOnly)
   - Implementar timeout para sesiones inactivas
   - No enviar información sensible en los nombres de archivo

## Preguntas Frecuentes

### ¿Cómo manejo los errores de rate limiting?
Implemente un mecanismo de reintento con retroceso exponencial cuando reciba errores 429. El encabezado `Retry-After` indica los segundos a esperar.

### ¿Puedo enviar múltiples archivos?
No, el endpoint solo admite un archivo PDF a la vez.

### ¿Puedo comprimir el archivo para reducir el tamaño?
Se recomienda optimizar el PDF antes de enviarlo, pero debe mantenerse como un PDF válido.

### ¿Cómo pruebo la integración?
Utilice el entorno de pruebas (sandbox) disponible en `https://[sandbox-url]/optipension/api/history-laboral/upload` con las credenciales de prueba proporcionadas por el equipo. 