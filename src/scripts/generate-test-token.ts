import { generateTestToken } from '../common/guards/auth.guard';

// Generar un token de prueba
const token = generateTestToken();

// Mostrar el token y un ejemplo de cómo usarlo
console.log('\n=== TOKEN DE PRUEBA GENERADO ===');
console.log(token);
console.log('\n=== USAR CON CURL ===');
console.log(`curl -X POST \\
  http://localhost:3000/optipension/api/history-laboral/upload \\
  -H "Authorization: Bearer ${token}" \\
  -H "x-test-auth: true" \\
  -F "file=@ruta/a/tu/archivo.pdf"`);

console.log('\n=== USAR CON POSTMAN ===');
console.log('Headers necesarios:');
console.log('Authorization: Bearer ' + token);
console.log('x-test-auth: true');

console.log('\n¡IMPORTANTE!');
console.log('Este token es solo para desarrollo y pruebas.');
console.log('Expirará en 1 hora.'); 