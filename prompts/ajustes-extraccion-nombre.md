# Ajustes para corregir extracción de `fullName`

Has mejorado significativamente los resultados, pero el encabezado “RESUMEN DE SEMANAS COTIZADAS POR EMPLEADOR” sigue siendo detectado como nombre. A continuación tienes recomendaciones concretas para refinar `extractFullName` y evitar capturar títulos de sección.

---

## 1. Añadir búsqueda de línea con patrón `C <documento> <nombre>`

Antes de la lógica actual, intenta extraer el nombre directamente de la línea que contiene `"C <documento> <NOMBRE>"`. En muchos PDF de Colpensiones, el afiliado aparece en la misma línea que el número de documento. Por ejemplo:  
```
C 79308073 GERMAN TABARES CARREÑO
```

Agrega este bloque al inicio de `extractFullName`:

```ts
private extractFullName(pdfData: any, documentNumber: string): string | undefined {
  // 0. Estrategia directa: buscar la línea que combine "C <documento> <NOMBRE>"
  for (const page of pdfData.Pages) {
    // Agrupar textos por posición Y para líneas
    const lines = new Map<number, string[]>();
    for (const textItem of page.Texts) {
      const y = Math.round(textItem.y * 100) / 100;
      const txt = decodeURIComponent(textItem.R.map((r: any) => r.T).join(''));
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y)!.push(txt);
    }
    // Revisar cada línea completa
    for (const [_, texts] of lines.entries()) {
      const lineText = texts.join(' ').trim();
      // Regex: inicio con "C", espacio, número de documento, espacio y luego nombre en mayúsculas
      const directPattern = new RegExp(`^C\s+${documentNumber}\s+([A-ZÁÉÍÓÚÑ\s]{8,})$`);
      const match = lineText.match(directPattern);
      if (match && match[1]) {
        const candidate = match[1].trim();
        return candidate;
      }
    }
  }

  // ... lógica existente ...
  // (mantener el resto sin cambios hasta el final de extractFullName)
}
```

Este bloque:
- Agrupa todos los `TextItem` de cada página por coordenada vertical (`y`).
- Forma `lineText` concatenando todos los fragmentos de texto en esa misma línea.
- Aplica un regex que obliga a que el nombre siga inmediatamente al documento tras “C <documento>”.

Si se encuentra, retorna esa cadena y evita el encabezado.

---

## 2. Mejorar la validación de “línea válida” en la lógica espacial

Si no hay coincidencia directa (paso anterior), modifica los filtros de las líneas candidatas para excluir títulos largos. Por ejemplo:

```ts
// Dentro de extractFullName, después de la búsqueda directa
for (const page of pdfData.Pages) {
  for (let i = 0; i < page.Texts.length; i++) {
    const curr = page.Texts[i];
    const text = decodeURIComponent(curr.R.map((r: any) => r.T).join(''));
    if (text.trim() === documentNumber || text.includes(`C ${documentNumber}`)) {
      const docY = curr.y;
      const lines = new Map<number, string[]>();
      for (const textItem of page.Texts) {
        const y = Math.round(textItem.y * 100) / 100;
        const txt = decodeURIComponent(textItem.R.map((r: any) => r.T).join(''));
        if (!lines.has(y)) lines.set(y, []);
        lines.get(y)!.push(txt);
      }

      // Candidatos debajo de docY
      const candidateYs = Array.from(lines.keys())
        .filter(y => y > docY + 0.1)
        .sort((a, b) => a - b);

      for (const candidateY of candidateYs) {
        const nameLine = lines.get(candidateY)!.join(' ').trim();
        // 1. Excluir líneas muy largas (más de 30 caracteres)
        if (nameLine.length > 30) continue;
        // 2. Debe tener solo mayúsculas y espacios
        if (!/^[A-ZÁÉÍÓÚÑ ]{8,}$/.test(nameLine)) continue;
        // 3. Excluir palabras clave de encabezados
        const forbiddenTerms = ['RESUMEN', 'SEMANAS', 'COTIZADAS', 'EMPLEADOR', 'TOTAL'];
        if (forbiddenTerms.some(term => nameLine.includes(term))) continue;
        return nameLine;
      }

      // Candidatos encima de docY (si falla lo anterior)
      const candidateBeforeYs = Array.from(lines.keys())
        .filter(y => y < docY - 0.1)
        .sort((a, b) => b - a); // Orden descendente

      for (const candidateY of candidateBeforeYs) {
        const nameLine = lines.get(candidateY)!.join(' ').trim();
        if (nameLine.length > 30) continue;
        if (!/^[A-ZÁÉÍÓÚÑ ]{8,}$/.test(nameLine)) continue;
        const forbiddenTerms = ['RESUMEN', 'SEMANAS', 'COTIZADAS', 'EMPLEADOR', 'TOTAL'];
        if (forbiddenTerms.some(term => nameLine.includes(term))) continue;
        return nameLine;
      }
    }
  }
}
```

### Explicación de los filtros adicionales

1. **Longitud máxima (30 caracteres)**  
   Evita extraer encabezados largos como `"RESUMEN DE SEMANAS COTIZADAS POR EMPLEADOR"` (38 caracteres).
2. **Solo mayúsculas y espacios**  
   Refuerza que no aparezcan números, signos ni minúsculas.
3. **Excluir términos clave de encabezados**  
   Cualquier línea que contenga palabras como `RESUMEN`, `SEMANAS`, `COTIZADAS`, `EMPLEADOR` o `TOTAL` se descarta.

---

## 3. Fallback: buscar cerca de “NOMBRE:”

Si aún no encuentras un nombre válido, revisa la primera página en busca de “NOMBRE:”:

```ts
// Al final de extractFullName, antes del return genérico
for (const page of pdfData.Pages.slice(0, 1)) { // Solo primera página
  for (let i = 0; i < page.Texts.length; i++) {
    const raw = decodeURIComponent(page.Texts[i].R.map((r: any) => r.T).join(''));
    if (raw.includes('NOMBRE:')) {
      const parts = raw.split(':');
      if (parts.length > 1) {
        const candidate = parts[1].trim();
        if (/^[A-ZÁÉÍÓÚÑ ]{8,}$/.test(candidate)) {
          return candidate;
        }
      }
      // Si “NOMBRE:” está solo, tomar el siguiente TextItem
      if (i + 1 < page.Texts.length) {
        const next = decodeURIComponent(page.Texts[i + 1].R.map((r: any) => r.T).join('')).trim();
        if (/^[A-ZÁÉÍÓÚÑ ]{8,}$/.test(next)) {
          return next;
        }
      }
    }
  }
}
```

---

## 4. Archivo completo sugerido para `extractFullName`

```ts
private extractFullName(pdfData: any, documentNumber: string): string | undefined {
  try {
    // 0. Estrategia directa: "C <documento> <NOMBRE>"
    for (const page of pdfData.Pages) {
      const lines = new Map<number, string[]>();
      for (const textItem of page.Texts) {
        const y = Math.round(textItem.y * 100) / 100;
        const txt = decodeURIComponent(textItem.R.map((r: any) => r.T).join(''));
        if (!lines.has(y)) lines.set(y, []);
        lines.get(y)!.push(txt);
      }
      for (const [_, texts] of lines.entries()) {
        const lineText = texts.join(' ').trim();
        const directPattern = new RegExp(`^C\s+${documentNumber}\s+([A-ZÁÉÍÓÚÑ\s]{8,})$`);
        const match = lineText.match(directPattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }

    // 1. Búsqueda espacial usando ubicación de documento
    for (const page of pdfData.Pages) {
      for (let i = 0; i < page.Texts.length; i++) {
        const curr = page.Texts[i];
        const text = decodeURIComponent(curr.R.map((r: any) => r.T).join(''));
        if (text.trim() === documentNumber || text.includes(`C ${documentNumber}`)) {
          const docY = curr.y;
          // Agrupar por Y
          const lines = new Map<number, string[]>();
          for (const textItem of page.Texts) {
            const y = Math.round(textItem.y * 100) / 100;
            const txt = decodeURIComponent(textItem.R.map((r: any) => r.T).join(''));
            if (!lines.has(y)) lines.set(y, []);
            lines.get(y)!.push(txt);
          }

          // Candidatos debajo de docY
          const candidateYs = Array.from(lines.keys())
            .filter(y => y > docY + 0.1)
            .sort((a, b) => a - b);
          for (const candidateY of candidateYs) {
            const nameLine = lines.get(candidateY)!.join(' ').trim();
            if (nameLine.length > 30) continue;
            if (!/^[A-ZÁÉÍÓÚÑ ]{8,}$/.test(nameLine)) continue;
            const forbidden = ['RESUMEN', 'SEMANAS', 'COTIZADAS', 'EMPLEADOR', 'TOTAL'];
            if (forbidden.some(term => nameLine.includes(term))) continue;
            return nameLine;
          }

          // Candidatos encima de docY
          const candidateBeforeYs = Array.from(lines.keys())
            .filter(y => y < docY - 0.1)
            .sort((a, b) => b - a);
          for (const candidateY of candidateBeforeYs) {
            const nameLine = lines.get(candidateY)!.join(' ').trim();
            if (nameLine.length > 30) continue;
            if (!/^[A-ZÁÉÍÓÚÑ ]{8,}$/.test(nameLine)) continue;
            const forbidden = ['RESUMEN', 'SEMANAS', 'COTIZADAS', 'EMPLEADOR', 'TOTAL'];
            if (forbidden.some(term => nameLine.includes(term))) continue;
            return nameLine;
          }
        }
      }
    }

    // 2. Fallback: buscar "NOMBRE:" en primera página
    for (const page of pdfData.Pages.slice(0, 1)) {
      for (let i = 0; i < page.Texts.length; i++) {
        const raw = decodeURIComponent(page.Texts[i].R.map((r: any) => r.T).join(''));
        if (raw.includes('NOMBRE:')) {
          const parts = raw.split(':');
          if (parts.length > 1) {
            const candidate = parts[1].trim();
            if (/^[A-ZÁÉÍÓÚÑ ]{8,}$/.test(candidate)) {
              return candidate;
            }
          }
          if (i + 1 < page.Texts.length) {
            const next = decodeURIComponent(page.Texts[i + 1].R.map((r: any) => r.T).join('')).trim();
            if (/^[A-ZÁÉÍÓÚÑ ]{8,}$/.test(next)) {
              return next;
            }
          }
        }
      }
    }

    // 3. Si todo falla, retornar genérico
    this.logger.warn('No se pudo extraer el nombre del afiliado, usando valor genérico');
    return "AFILIADO COLPENSIONES";
  } catch (error) {
    this.logger.error(`Error al extraer nombre: ${error.message}`);
    return "AFILIADO COLPENSIONES";
  }
}
```

---

