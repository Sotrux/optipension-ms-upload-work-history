$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3VhcmlvLXBydWViYSIsIm5hbWUiOiJVc3VhcmlvIGRlIFBydWViYSIsImlhdCI6MTc0NDE1NDI5NywiZXhwIjoxNzQ0MTU3ODk3LCJhdWQiOiJhcGk6b3B0aXBlbnNpb24iLCJpc3MiOiJodHRwczovL29wdGlwZW5zaW9uLXRlc3QuY29tIn0.9-x2DE1b0HtrFbhr1QsDOM8MYkokuoF93tQYj1R4No8"

# Prueba 1: Enviar un archivo no PDF (debería fallar)
Write-Host "Prueba 1: Enviando archivo no PDF (README.md) - Debería rechazarlo"
curl.exe -X POST "http://localhost:3000/optipension/api/history-laboral/upload" `
    -H "Authorization: Bearer $token" `
    -H "x-test-auth: true" `
    -F "file=@README.md" `
    -v

# Prueba 2: Enviar un archivo sin extensión PDF (debería fallar)
Write-Host "`nPrueba 2: Enviando archivo con extensión incorrecta - Debería rechazarlo"
curl.exe -X POST "http://localhost:3000/optipension/api/history-laboral/upload" `
    -H "Authorization: Bearer $token" `
    -H "x-test-auth: true" `
    -F "file=@package.json" `
    -v

# Si tienes un archivo PDF real para probar
# Write-Host "`nPrueba 3: Enviando archivo PDF válido - Debería aceptarlo"
# curl.exe -X POST "http://localhost:3000/optipension/api/history-laboral/upload" `
#     -H "Authorization: Bearer $token" `
#     -H "x-test-auth: true" `
#     -F "file=@ruta/al/archivo.pdf" `
#     -v 