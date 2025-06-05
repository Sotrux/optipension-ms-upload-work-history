# Estándares de Base de Datos

## Introducción

Este documento define los estándares de calidad y las mejores prácticas que regirán el diseño, implementación y mantenimiento de las bases de datos, garantizando orden, eficiencia y productividad a lo largo del ciclo de vida del desarrollo. Estos estándares aseguran la escalabilidad futura, el cumplimiento de los requisitos de rendimiento, la seguridad y la consistencia en el manejo de los datos.

## 1. Diseño de la Base de Datos

- El Motor de Base de Datos es **PostgreSQL** 
- Se priorizará la normalización de las tablas para evitar la redundancia de datos, garantizando la integridad referencial.
- Se adoptará un modelo de transacciones ACID, garantizando que todas las operaciones en la base de datos sean atómicas, consistentes, aisladas y duraderas.
- El sistema debe asegurar que, incluso en situaciones de concurrencia o fallos, no se produzcan datos corruptos o inconsistentes.
- Se configurarán políticas de control de concurrencia, como el **bloqueo de filas** en PostgreSQL, para evitar problemas de contención de recursos en operaciones intensivas.
- Se implementarán índices en las claves primarias (el campo `id`) y en las claves foráneas.
- A medida que se identifiquen consultas de alta frecuencia, se evaluará la creación de índices adicionales para mejorar el rendimiento.
- Las migraciones de esquemas deben ser automatizadas utilizando **Prisma Migrate**.

## 2. Convenciones de Nomenclatura

Se adopta el uso del inglés como idioma para el nombramiento de tablas, columnas e índices dentro de la base de datos, con el objetivo de alinear las convenciones con las mejores prácticas internacionales y facilitar la integración con herramientas, documentación y futuros colaboradores.

### 2.1 Tablas
- **Prefijo por módulo**: Para cada módulo del proyecto se definirá un prefijo de dos letras que antecederán los nombres de las tablas que perteneces al módulo (e.g.,`ma` para el módulo de mantenimiento). Las tablas de administracióntendrán el prefijo `ad`.
- **Nombres en plural**: Los nombres de las tablas deben estar en plural para indicar que almacenan múltiples registros (e.g., `ad_clients`, `ma_machines`).
- **Snake_case**: Se utilizará el formato **snake_case** para los nombres de las tablas, evitando espacios o caracteres especiales (e.g., `company_clients` en lugar de `CompanyClients`).
- **Prefijos/Sufijos**: Evitar el uso de prefijos o sufijos innecesarios como `tbl_` o `data_`. Los nombres de las tablas deben ser lo suficientemente descriptivos sin redundancias.
- **Abreviaturas**: Se evitarán las abreviaturas a menos que sean ampliamente reconocidas (e.g., `id` para identificadores, `sku` para códigos de productos).

### 2.2 Columnas
- **Nombres claros y descriptivos**: Las columnas deben describir claramente el tipo de dato que contienen. Por ejemplo, en lugar de `value`, se recomienda `sales_price` o `created_at`.
- **Snake_case**: Al igual que en las tablas, se utilizará **snake_case** para los nombres de las columnas (e.g., `client_name`, `registration_date`).
- **Prefijos en claves foráneas**: Las claves foráneas deben llevar el nombre de la tabla referenciada como prefijo, seguido de `_id`. Ejemplo:
  - En la tabla `company_clients`, una clave foránea que hace referencia a la tabla `companies` sería `company_id`.

### 2.3 Índices y Restricciones
- **Índices**: Los nombres de los índices deben incluir el nombre de la tabla y las columnas indexadas, seguidos del sufijo `_idx`. Ejemplo: `clients_email_idx`.
- **Restricciones**: Las restricciones, como claves primarias y foráneas, deben seguir una convención similar. Ejemplo:
  - Clave primaria: `clients_pkey`
  - Clave foránea: `clients_company_id_fkey`.

### 2.4 Otros Lineamientos de nomenclatura
- **Tipo de Datos Booleanos**: Las columnas que contengan valores booleanos deben utilizar prefijos que indiquen una condición clara, como `is_active` en lugar de solo `active`.
- **Timestamps**: Se deben usar convenciones estándar para los campos de fechas de auditoría, como `created_at` y `updated_at`, que son ampliamente aceptadas y claramente comprensibles. Estas indican cuándo un registro fue creado o actualizado.
- **Evitar Nombres Reservados**: Se deben evitar los nombres reservados por el sistema de bases de datos (e.g., `user`, `order`).

### Ejemplo

| Tabla                  | Columna           | Descripción                         |
|------------------------|-------------------|-------------------------------------|
| `company_clients`       | `company_id`      | Clave foránea a la tabla `companies`|
| `company_clients`       | `registration_date`| Fecha en la que el cliente se registró |
| `invoices`              | `client_id`       | Clave foránea a la tabla `clients`  |
| `invoices`              | `total_amount`    | Monto total de la factura           |
| `products`              | `sku`             | Código del producto (stock keeping unit) |

## 3. Campos obligatorios en Tablas de Base de Datos

### 3.1 Llaves Primarias

Todas las tablas deben incluir un campo `id` de tipo **`SERIAL`** como llave primaria, generado automáticamente al insertar un nuevo registro. Esto garantiza un identificador único y eficiente para cada registro.

```sql
id SERIAL PRIMARY KEY
```

### 3.2 Identificador único

Todas las tablas deben incluir un campo `uu` generado con la función `<database>.generate_uuid()`.

Ejemplo para base de datos sotrux:

```sql
uu varchar(36) NOT NULL DEFAULT sotrux.generate_uuid()
```

### 3.3 Campos de Auditoría

Es requerido el uso de **campos de auditoría** en todas las tablas. Estos campos son obligatorios para garantizar la trazabilidad y el seguimiento de las operaciones sobre los registros, permitiendo auditar quién ha creado o modificado un registro y cuándo ocurrió.

Los campos de auditoria obligatorios son los siguientes:

- **created_at** (`timestamp`): Fecha y hora en que se creó el registro.
- **updated_at** (`timestamp`): Fecha y hora de la última modificación del registro.
- **created_by** (`varchar`, `int` o `uuid`): ID del usuario que creó el registro.
- **updated_by** (`varchar`, `int` o `uuid`): ID del usuario que realizó la última modificación.

La base de datos cuenta con una función que se encarga de actualizar automáticamente los campos created_at, updated_at, created_by, y updated_by en cada tabla, por lo que el desarrollador no necesita ocuparse de esta tarea. 

### 3.4 Campo is_active

Es requerido el uso del campo boolean `is_active` en todas las tablas para indicar si el registro se encuentra o no activo. Es responsabilidad de los desarrolladores incluir este campo en la definición de los modelos en Prisma así como de construir toda consulta validando que el campo `is_activo = TRUE`. 

## 4. Creación Triggers para Control de Acceso 

Las siguientes son las políticas a aplicar las cuales deben crearse en el archivo **rls-dev-policies.sql**:

### 4.1 Campos sensibles en Tablas de Base de Datos

Al crear una tabla con campos sensibles no modificables se debe crear una trigger para impedir la modificación de dichos campos. Un ejemplo de configuración para la tabla `marketing.promo_users` es el siguiente:

```sql
-- Function for mk_promo_users
CREATE OR REPLACE FUNCTION trg_mk_promo_users()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id <> OLD.id OR
       NEW.uu <> OLD.uu OR
       NEW.email <> OLD.email OR
       NEW.created_at <> OLD.created_at OR
       NEW.created_by <> OLD.created_by THEN
        RAISE EXCEPTION 'It is not allowed to update these sensitive values ​​in marketing.mk_promo_users';
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for mk_promo_users
CREATE TRIGGER prevent_sensitive_update_mk_promo_users
BEFORE UPDATE ON marketing.mk_promo_users
FOR EACH ROW
EXECUTE FUNCTION trg_mk_promo_users();
```

Se definen como campos sensibles en todas las tablas los siguientes campos: 

- **id**
- **uu**
- **created_at**
- **created_by**

Los desarrolladores deben crear la política que incluya estos campos y los demás requeridos de acuerdo a las especificaciones funcionales.

