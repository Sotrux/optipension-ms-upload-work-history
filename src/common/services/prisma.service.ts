import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient<
  Prisma.PrismaClientOptions,
  'query' | 'error' | 'info' | 'warn'
> implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });

    // Log de queries para desarrollo (opcional)
    if (process.env.NODE_ENV === 'development') {
      this.$on('query', (e) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Params: ${e.params}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // Log de errores
    this.$on('error', (e) => {
      this.logger.error(`Prisma Error: ${e.message}`, e.target);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Conectado a la base de datos PostgreSQL');
    } catch (error) {
      this.logger.error('Error conectando a la base de datos:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Desconectado de la base de datos PostgreSQL');
    } catch (error) {
      this.logger.error('Error desconectando de la base de datos:', error);
    }
  }

  /**
   * Método helper para ejecutar transacciones
   */
  async transaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(fn);
  }

  /**
   * Establecer el usuario actual para los triggers de auditoría
   * Convierte string userId a entero para compatibilidad con triggers
   */
  async setCurrentUser(userId: string): Promise<void> {
    try {
      // Convertir string userId a hash numérico para compatibilidad con trigger
      const numericUserId = this.stringToNumericId(userId);
      const numericUserIdString = numericUserId.toString();
      
      this.logger.debug(`Estableciendo usuario: ${userId} -> ${numericUserId} (como string: "${numericUserIdString}")`);
      
      // Usar SQL directo para establecer la configuración
      await this.$executeRaw`SELECT set_config('app.current_user_id', ${numericUserIdString}, true)`;
      
      // Verificar que se estableció correctamente
      const result = await this.$queryRaw<Array<{ current_setting: string }>>`SELECT current_setting('app.current_user_id') as current_setting`;
      this.logger.debug(`Valor establecido verificado: "${result[0]?.current_setting}"`);
      
      this.logger.debug(`Usuario actual establecido exitosamente: ${userId} -> ${numericUserId}`);
    } catch (error) {
      this.logger.error(`Error estableciendo usuario actual: ${error.message}`);
      throw error;
    }
  }

  /**
   * Limpiar el usuario actual
   */
  async clearCurrentUser(): Promise<void> {
    try {
      await this.$executeRaw`SELECT set_config('app.current_user_id', NULL, true)`;
      this.logger.debug('Usuario actual limpiado');
    } catch (error) {
      this.logger.error(`Error limpiando usuario actual: ${error.message}`);
    }
  }

  /**
   * Convertir string userId a ID numérico determinístico
   * Usa hash simple para mantener consistencia
   */
  private stringToNumericId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32-bit integer
    }
    // Asegurar que el resultado sea positivo y dentro del rango de PostgreSQL integer
    const positiveHash = Math.abs(hash) || 1;
    // Limitar a 32-bit signed integer máximo (2147483647)
    return positiveHash > 2147483647 ? positiveHash % 2147483647 : positiveHash;
  }

  /**
   * Método helper para verificar la conexión
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
} 