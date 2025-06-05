Eres un experto en desarrollo backend con NestJS. Tienes conocimientos profundos en base de datos PostgreSQL, ORM Prisma y cargas de archivos en DigitalOcean Spaces. Necesitamos desarrollar el ticket OPT-1-BE-2-Subir y Almacenar PDF en DigitalOcean Spaces.md que se integrará en el front end con el desarrollo del ticket OPT-1-FE-2-Integración con el Endpoint de Subida.md. Por favor revisa el repositorio y hazme todas las preguntas que estimes convenientes para que me puedas entregar un plan de implementación (toma como referencia PLAN-IMPLEMENTACION-OPT-1-BE-1.md), robusto, seguro,  ajustado a buenas prácticas de desarrollo y que tenga en cuenta la guía de desarrollo descrita en backend-coding-standards-optipension.md

- Se cuenta con la base de datos optipension en PostgreSQL confgurada en el puerto 5435.
-----

Estas son mis respuestas a tus preguntas:
Sobre la estructura de la base de datos:
Por favor tener en cuenta los lineamientos de database-standards-for-developers-20250513.md
¿Ya existe la tabla history_laboral_uploads o necesitamos crearla? Respuesta: Necesitamos crearla.
¿Qué campos adicionales a los mencionados (ID usuario, nombre archivo, tamaño, ubicación, fecha) deberían incluirse en la tabla? Respuesta: Los requeridos en database-standards-for-developers-20250513.md
Sobre DigitalOcean Spaces:
¿Ya tienes configuradas las credenciales de acceso a DigitalOcean Spaces? Respuesta: No
¿Hay alguna convención específica para nombrar los archivos en Spaces (por ejemplo, prefijos por usuario o tipo de documento)? Respuesta: Tipo Documento-Numero Documento-HL-Fecha, donde Tipo Documento: cadena de 2 caracteres, Número documento: cadena de 12 caracteres, HL (indica Historia Laboral), Fecha: DD-MM-AAAA
¿Existe algún límite de tamaño específico para los archivos en Spaces? Respuesta: 2MB.
Sobre la autenticación:
¿El guard JWT para Auth0 ya está implementado (mencionado como completado en el plan anterior)? Respuesta:  Si
¿Necesitas que el endpoint valide algún claim específico del token JWT además de la autenticación básica? Respuesta: Por favor explícame esto.
Sobre el manejo de archivos:
¿Hay algún requisito específico para el formato del nombre del archivo en Spaces (por ejemplo, sanitización, caracteres permitidos)? Respuesta: Por favor explícame esto
¿Debemos implementar alguna validación adicional al PDF además de la validación de MIME type y tamaño? Respuesta: No
Sobre la respuesta del endpoint:
¿Qué información específica necesitas que retorne el endpoint en caso de éxito (además de nombre, tamaño y URL)? Respuesta: Ninguna 
¿Hay algún formato específico que deba seguir la URL de Spaces en la respuesta? Respuesta: No

-----

Ahora necesito que por favor me ayudes con el desarrollo de todos los tickets de la HU "OPT-2-Validar Formato del PDF y Extraer Datos Básicos.md" por favor revisa la docmentación que te compartí y  hazme todas las preguntas que estimes convenientes para que me puedas entregar un plan de implementación, robusto, seguro,  ajustado a buenas prácticas de desarrollo y que tenga en cuenta la guía de desarrollo descrita en "backend-coding-standards-optipension.md" y en "database-standards-for-developers-20250513.md"
