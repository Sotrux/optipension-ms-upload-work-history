
# Resumen de Ajustes para el Parser de Colpensiones

Este documento describe los ajustes y correcciones necesarios para que el parser:
1. Detenga la lectura de la tabla justo al final de la sección de “Resumen de Semanas Cotizadas”.  
2. Extraiga correctamente las 9 columnas completas de cada fila de la tabla.

---

## 1. Detener la lectura al final de la tabla correcta

### Problema detectado
- El parser continuaba recolectando filas incluso después de “[10] TOTAL SEMANAS COTIZADAS”, agregando registros adicionales no deseados.

### Solución
- Añadir el encabezado de la siguiente sección como patrón de fin de tabla:
  ```
  RESUMEN DE TIEMPOS PÚBLICOS NO COTIZADOS A COLPENSIONES
  ```
- Incluirlo junto a los patrones actuales de fin de tabla:

```ts
const endPatterns = [
  'TOTAL SEMANAS COTIZADAS',
  '[10] TOTAL SEMANAS',
  'GRAN TOTAL',
  'RESUMEN DE TIEMPOS PÚBLICOS NO COTIZADOS A COLPENSIONES'
];
```

- Al detectar cualquiera de estos patrones en una línea, ejecutar `return periods;` para salir inmediatamente y evitar registros extra.

---

## 2. Capturar las 9 columnas completas en cada fila

### Problema detectado
- Actualmente la lógica buscaba números dentro de la línea y trataba de inferir IBC y semanas, sin capturar explícitamente columnas “Lic”, “Sim” y “Total”.

### Solución
- **Usar `split(/\s{2,}/)`** (dos o más espacios) para separar la línea en 9 fragmentos:
  1. Identificación Aportante  
  2. Nombre o Razón Social  
  3. Desde (DD/MM/AAAA)  
  4. Hasta (DD/MM/AAAA)  
  5. Último Salario (IBC)  
  6. Semanas  
  7. Lic  
  8. Sim  
  9. Total  

- Verificar que `cols.length >= 9`. Si es menor, descartar o registrar para depuración.

- Ejemplo de extracción:

```ts
if (inTable && /\d{2}\/\d{2}\/\d{4}/.test(line.text)) {
  // 1) Split en 9 columnas
  const cols = line.text.split(/\s{2,}/).map(s => s.trim());

  // 2) Validar que hay al menos 9 columnas
  if (cols.length >= 9) {
    const employerId   = cols[0];
    const employerName = cols[1];
    const fromIso      = this.formatDate(cols[2]);
    const toIso        = this.formatDate(cols[3]);
    const ibc          = this.parseNumericValue(cols[4]);
    const weeks        = parseFloat(cols[5].replace(',', '.')) || 0;
    const lic          = parseFloat(cols[6].replace(',', '.')) || 0;
    const sim          = parseFloat(cols[7].replace(',', '.')) || 0;
    const total        = parseFloat(cols[8].replace(',', '.')) || 0;

    // Descartar fila vacía si es propio doc con 0 semanas
    if (employerId === documentNumber && weeks === 0) {
      this.logger.debug(`Fila descartada (propio doc, 0 semanas): "${line.text}"`);
    } else {
      periods.push({
        employerId,
        employerName,
        from: fromIso,
        to: toIso,
        weeks,
        ibc
        // Agregar lic, sim, total si la interfaz Period se extiende:
        // lic,
        // sim,
        // total
      });
      this.logger.debug(
        `Período añadido: ${employerName} (${fromIso} a ${toIso}) → ` +
        `IBC=${ibc}, Semanas=${weeks}, Lic=${lic}, Sim=${sim}, Total=${total}`
      );
    }
  } else {
    this.logger.debug(`Línea con <9 columnas (cols.length=${cols.length}): "${line.text}"`);
  }
}
```

- **Extender la interfaz `Period`** (opcional) para incluir `lic`, `sim` y `total`:

```ts
export interface Period {
  employerId: string;
  employerName: string;
  from: string;
  to: string;
  ibc: number;
  weeks: number;
  lic: number;
  sim: number;
  total: number;
}
```

---

## 3. Ajuste final del método `extractAllSummaryPeriods`

- Incorporar ambos cambios (nuevos `endPatterns` y extracción de 9 columnas) en la implementación.  
- Al encontrar cualquiera de los `endPatterns`, hacer `return periods;` para detener la extracción.  
- Asegurarse de llamar a `split(/\s{2,}/)` en cada línea válida y verificar `cols.length >= 9`.

---

## 4. Verificación y Depuración

1. **Habilitar temporalmente** el método `debugFindDateLines(pdfData)` para confirmar en qué página y línea se detectan las fechas y los patrones de fin de tabla.  
2. **Revisar el log** y confirmar que:
   - La función deja de iterar en la línea que contiene `"[10] TOTAL SEMANAS COTIZADAS"` o `"RESUMEN DE TIEMPOS PÚBLICOS NO COTIZADOS A COLPENSIONES"`.  
   - Cada `period` extraído tiene valores coherentes para todas las 9 columnas.  

---

## 5. Recomendaciones Adicionales

- **Convertir ambos textos y patrones a mayúsculas** (usando `.toUpperCase()`) antes de comparar, en caso de diferencias de font/espaciado:
  ```ts
  const upperLine = line.text.toUpperCase();
  if (upperLine.includes(pattern.toUpperCase())) { ... }
  ```
- **Registrar valores de `cols.length`** cuando sean diferentes a 9 para detectar posibles casos atípicos.
- **Revisar casos extremos**: filas en las que nombre del empleador contenga números o signos extraños, y ajustar `split` si hiciera falta.
- **Probar en varios informes reales** para asegurar la robustez de la extracción.

---

Con estos ajustes, el parser detendrá correctamente al final de la tabla deseada y extraerá todas las nueve columnas en cada fila de manera fiable.
