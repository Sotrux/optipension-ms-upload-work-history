# Recomendaciones para mejorar el parser con pdf2json

A continuación se describen los ajustes sugeridos para extraer correctamente `fullName` y los empleadores:

## 1. Refactorizar `extractFullName` usando contexto espacial

```ts
private extractFullName(pdfData: any, documentNumber: string): string {
  // 1. Recorre páginas y busca el TextItem que contiene documentNumber
  for (const page of pdfData.Pages) {
    for (let i = 0; i < page.Texts.length; i++) {
      const curr = page.Texts[i];
      const text = decodeURIComponent(curr.R.map((r: any) => r.T).join(''));
      if (text.trim() === documentNumber) {
        const docY = curr.y;
        // 2. Agrupa todos los Texts de esta página por posición Y
        const lines = page.Texts.reduce((m: Map<number, string[]>, t: any) => {
          const y = Math.round(t.y * 100) / 100;
          const txt = decodeURIComponent(t.R.map((r: any) => r.T).join(''));
          (m.get(y) || m.set(y, [])).get(y)!.push(txt);
          return m;
        }, new Map<number, string[]>());
        // 3. Localiza la línea con y > docY más pequeña
        const candidateY = Array.from(lines.keys())
          .filter(y => y > docY + 0.1)
          .sort((a, b) => a - b)[0];
        if (candidateY != null) {
          const nameLine = lines.get(candidateY)!.join(' ').trim();
          if (/^[A-ZÁÉÍÓÚÑ ]{8,}$/.test(nameLine)) {
            return nameLine;
          }
        }
      }
    }
  }
  return "AFILIADO COLPENSIONES";  // fallback
}
```

### Llamada en el flujo principal

```ts
const doc = this.extractDocument(fullText, pdfData);
extractedData.document = doc;
extractedData.fullName = this.extractFullName(pdfData, doc!);
```

---

## 2. Eliminar el “atajo” de `findTablePages`

```ts
private findTablePages(pdfData: any): number[] {
  const titles = [
    'Identificación Aportante',
    'Resumen de Semanas Cotizadas por Empleador',
    '[1]Identificación Aportante'
  ];
  return pdfData.Pages
    .map((page: any, idx: number) => {
      const txt = page.Texts
        .map((t: any) => decodeURIComponent(t.R.map((r: any) => r.T).join('')))
        .join(' ');
      return titles.some(t => txt.includes(t)) ? idx : -1;
    })
    .filter(i => i >= 0);
}
```

---

## 3. Detectar el ID de empleador por la primera columna

```ts
for (const lineItems of sortedLines) {
  const first = lineItems[0].text.trim();
  if (/^\d{7,12}$/.test(first)) {
    currentEmployerId = first;
    currentEmployerName = lineItems
      .slice(1)
      .map(i => i.text)
      .takeWhile(txt => !/\d{2}\/\d{2}\/\d{4}/.test(txt))
      .join(' ')
      .trim();
    employers.set(currentEmployerId, currentEmployerName);
    continue;
  }
  // … resto de lógica para fechas …
}
```

---

## 4. Ajustar extracción de semanas e IBC

```ts
const nums = line
  .map(item => item.text.replace(/[^\d,\.]/g, ''))
  .filter(v => v)
  .map(v => parseFloat(v.replace(',', '.')));

const nonZero = nums.filter(n => n > 0);
const weeks = nonZero.length >= 2 ? nonZero[1] : nonZero[0] || 0;
const ibc   = nonZero[0] || 0;
```

O directamente, según posición de columna:

```ts
const ibc    = nums[0];
const weeks  = nums[1];
```

---

## 5. Usar tu función `parseNumericValue` para IBC

```ts
const rawIbc = lineItems
  .find(i => i.x > ibcColumnX)
  ?.text || '';
const ibc = this.parseNumericValue(rawIbc);
```

---

### Flujo final sugerido

1. **Parsear** el PDF con `parsePdfFile`.  
2. **Extraer texto completo** para validaciones (`extractFullText`).  
3. **Extraer documento** y asignarlo a `document`.  
4. **Extraer nombre** utilizando `extractFullName(pdfData, document)`.  
5. **Detectar páginas de la tabla** con `findTablePages`.  
6. **Extraer empleadores** en un pase previo (`extractEmployers`).  
7. **Recorrer líneas** de las páginas detectadas para construir cada período.  
8. **Calcular total de semanas** validando con `extractTotalWeeks` o a partir de los períodos.  
