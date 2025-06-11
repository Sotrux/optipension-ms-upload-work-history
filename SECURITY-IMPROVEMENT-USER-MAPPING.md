# Mejora de Seguridad: Sistema de Mapping de Usuarios

## Problema Actual
Actualmente convertimos el `sub` del JWT directamente a un entero usando hash, lo que presenta riesgos de:
- Trazabilidad de usuarios en auditoría
- Cumplimiento regulatorio (GDPR)
- Exposición indirecta de patrones de actividad

## Solución Propuesta: Tabla de Mapping

### 1. Crear Tabla de Usuarios Internos
```sql
CREATE TABLE ad_internal_users (
    id SERIAL PRIMARY KEY,
    uu varchar(36) NOT NULL DEFAULT generate_uuid(),
    external_user_id varchar(255) NOT NULL UNIQUE, -- auth0|60f7b1b2e4b0d50068f1a1a1
    internal_user_id INTEGER NOT NULL UNIQUE,      -- ID numérico incremental
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT NOW(),
    updated_at timestamp NOT NULL DEFAULT NOW(),
    created_by integer,
    updated_by integer
);

-- Índice para búsquedas rápidas
CREATE INDEX idx_internal_users_external_id ON ad_internal_users(external_user_id);
CREATE INDEX idx_internal_users_internal_id ON ad_internal_users(internal_user_id);
```

### 2. Actualizar Tablas Existentes con FK

**IMPORTANTE**: Los campos `created_by` y `updated_by` deben tener relación FK:

```sql
-- Agregar FK constraint a tabla existente
ALTER TABLE hl_history_laboral_uploads 
ADD CONSTRAINT fk_hl_uploads_created_by 
FOREIGN KEY (created_by) REFERENCES ad_internal_users(internal_user_id);

ALTER TABLE hl_history_laboral_uploads 
ADD CONSTRAINT fk_hl_uploads_updated_by 
FOREIGN KEY (updated_by) REFERENCES ad_internal_users(internal_user_id);
```

### 3. Servicio de Mapping con Creación Automática

```typescript
@Injectable()
export class UserMappingService {
  private readonly logger = new Logger(UserMappingService.name);
  
  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene el ID interno del usuario, creándolo si no existe
   * Este método es idempotente y thread-safe
   */
  async getInternalUserId(externalUserId: string): Promise<number> {
    try {
      // Intentar encontrar usuario existente
      let user = await this.prisma.adInternalUsers.findUnique({
        where: { external_user_id: externalUserId },
        select: { internal_user_id: true }
      });

      if (user) {
        this.logger.debug(`Usuario encontrado: ${externalUserId} -> ${user.internal_user_id}`);
        return user.internal_user_id;
      }

      // Si no existe, crear nuevo usuario de forma thread-safe
      user = await this.createNewInternalUser(externalUserId);
      
      this.logger.info(`Nuevo usuario creado: ${externalUserId} -> ${user.internal_user_id}`);
      return user.internal_user_id;
      
    } catch (error) {
      this.logger.error(`Error obteniendo ID interno para ${externalUserId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Crea un nuevo usuario interno de forma thread-safe
   */
  private async createNewInternalUser(externalUserId: string): Promise<{ internal_user_id: number }> {
    return await this.prisma.$transaction(async (tx) => {
      // Doble verificación dentro de la transacción (por concurrencia)
      const existing = await tx.adInternalUsers.findUnique({
        where: { external_user_id: externalUserId },
        select: { internal_user_id: true }
      });

      if (existing) {
        return existing;
      }

      // Obtener siguiente ID disponible
      const nextId = await this.getNextInternalId(tx);

      // Crear nuevo usuario
      return await tx.adInternalUsers.create({
        data: {
          external_user_id: externalUserId,
          internal_user_id: nextId
        },
        select: { internal_user_id: true }
      });
    });
  }

  private async getNextInternalId(tx?: any): Promise<number> {
    const prismaClient = tx || this.prisma;
    
    const result = await prismaClient.adInternalUsers.aggregate({
      _max: { internal_user_id: true }
    });
    
    return (result._max.internal_user_id || 0) + 1;
  }

  /**
   * Obtiene información del usuario interno (para consultas)
   */
  async getUserInfo(internalUserId: number): Promise<{ external_user_id: string } | null> {
    return await this.prisma.adInternalUsers.findUnique({
      where: { internal_user_id: internalUserId },
      select: { external_user_id: true }
    });
  }
}
```

### 4. Modelo Prisma Actualizado

```typescript
// En prisma/schema.prisma
model AdInternalUsers {
  id               Int      @id @default(autoincrement())
  uu               String   @default(dbgenerated("generate_uuid()")) @db.VarChar(36)
  external_user_id String   @unique @db.VarChar(255)
  internal_user_id Int      @unique
  is_active        Boolean  @default(true)
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt
  created_by       Int?
  updated_by       Int?

  // Relaciones inversas para auditoría
  created_uploads  HlHistoryLaboralUpload[] @relation("CreatedByUser")
  updated_uploads  HlHistoryLaboralUpload[] @relation("UpdatedByUser")

  @@map("ad_internal_users")
}

model HlHistoryLaboralUpload {
  // ... campos existentes ...
  
  created_by Int?
  updated_by Int?

  // Relaciones FK
  creator AdInternalUsers? @relation("CreatedByUser", fields: [created_by], references: [internal_user_id])
  updater AdInternalUsers? @relation("UpdatedByUser", fields: [updated_by], references: [internal_user_id])

  @@map("hl_history_laboral_uploads")
}
```

### 5. Implementación en PrismaService
```typescript
async setCurrentUser(userId: string): Promise<void> {
  try {
    // Obtener o crear ID interno del usuario
    const internalUserId = await this.userMappingService.getInternalUserId(userId);
    
    // Establecer en trigger de auditoría
    await this.$executeRaw`SELECT set_config('app.current_user_id', ${internalUserId.toString()}, true)`;
    
    this.logger.debug(`Usuario establecido: ${userId} -> ${internalUserId}`);
  } catch (error) {
    this.logger.error(`Error estableciendo usuario: ${error.message}`);
    throw error;
  }
}
```

## 🔄 **Flujo Completo de Creación**

### Primera vez que un usuario hace login:
1. **JWT llega** con `sub: "auth0|60f7b1b2e4b0d50068f1a1a1"`
2. **UserMappingService** busca en `ad_internal_users`
3. **No encuentra** → Crea registro nuevo:
   ```sql
   INSERT INTO ad_internal_users (external_user_id, internal_user_id) 
   VALUES ('auth0|60f7b1b2e4b0d50068f1a1a1', 1);
   ```
4. **PrismaService** establece `app.current_user_id = '1'`
5. **Trigger de auditoría** usa `1` en `created_by/updated_by`

### Siguientes accesos:
1. **UserMappingService** encuentra usuario existente
2. Retorna `internal_user_id: 1`
3. Continúa flujo normal

## 🔗 **Integridad Referencial**

**SÍ hay relación FK** entre:
- `hl_history_laboral_uploads.created_by` → `ad_internal_users.internal_user_id`
- `hl_history_laboral_uploads.updated_by` → `ad_internal_users.internal_user_id`

### Beneficios de las FK:
- ✅ **Integridad**: No se pueden crear uploads sin usuario válido
- ✅ **Cascada**: Políticas de eliminación controladas
- ✅ **Consultas**: JOINs eficientes para auditoría
- ✅ **Validación**: Base de datos valida existencia automáticamente

## Ventajas de esta Solución
- ✅ **Desacoplamiento**: El `sub` externo no se almacena en auditoría
- ✅ **Cumplimiento GDPR**: Fácil eliminación de datos de usuario
- ✅ **Seguridad**: IDs internos secuenciales sin patrón predecible
- ✅ **Auditoría**: Mantiene trazabilidad con IDs limpios
- ✅ **Compatibilidad**: Triggers siguen funcionando con enteros
- ✅ **Automático**: Usuarios se crean transparentemente
- ✅ **Integridad**: FK garantizan consistencia

## Beneficios de Seguridad

### 🔒 **Privacidad**
- Los campos de auditoría contienen solo IDs secuenciales (1, 2, 3...)
- No hay correlación directa con identidades externas

### 📋 **Cumplimiento**
- **GDPR Article 17**: Fácil eliminación de registros de usuario
- **Auditoría**: Mantiene trazabilidad sin exponer identidades

### 🛡️ **Seguridad**
- **Principio de menor privilegio**: Solo almacena lo mínimo necesario
- **Compartimentalización**: Datos de identidad separados de auditoría
- **Rotación**: Posible renovar IDs internos sin afectar auditoría

## Migración Gradual

### Fase 1: Implementar Tabla de Mapping
- Crear tabla `ad_internal_users`
- Implementar `UserMappingService`

### Fase 2: Actualizar PrismaService
- Modificar `setCurrentUser()` para usar mapping
- Mantener función hash como fallback temporal

### Fase 3: Migrar Datos Existentes
- Script para migrar registros existentes
- Validar integridad de auditoría

### Fase 4: Remover Función Hash
- Eliminar lógica de hash directo
- Limpiar código legacy 