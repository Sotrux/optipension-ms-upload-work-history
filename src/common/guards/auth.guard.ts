import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../services/logger.service';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

// Solo para desarrollo y pruebas
const DEV_MODE = true; // IMPORTANTE: Cambiar a false en producción
const TEST_SECRET = 'claveSecretaParaPruebas12345';

// Función para generar un token de prueba (solo para desarrollo)
export function generateTestToken(): string {
  if (!DEV_MODE) {
    throw new Error('Esta función solo está disponible en modo desarrollo');
  }
  
  const payload = {
    sub: 'usuario-prueba',
    name: 'Usuario de Prueba',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hora
    aud: 'api:optipension',
    iss: 'https://optipension-test.com'
  };
  
  return jwt.sign(payload, TEST_SECRET);
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      this.logger.warn(
        'Acceso denegado: Token no proporcionado',
        'AUTH',
        { ip: request.ip, endpoint: request.url }
      );
      throw new UnauthorizedException('Token de autenticación no proporcionado');
    }

    try {
      let payload;
      
      // En modo desarrollo, intentamos ambos métodos de verificación
      if (DEV_MODE) {
        try {
          // Primero intentamos con el token de prueba (HS256)
          payload = jwt.verify(token, TEST_SECRET, {
            algorithms: ['HS256']
          });
          
          this.logger.warn(
            'Autenticación exitosa con token de prueba',
            'AUTH',
            { ip: request.ip, endpoint: request.url }
          );
        } catch (e) {
          // Si falla, intentamos con el token normal (RS256)
          const secret = this.configService.get<string>('auth.secret');
          const audience = this.configService.get<string>('auth.audience');
          const issuer = this.configService.get<string>('auth.issuer');
          
          payload = jwt.verify(token, secret, {
            audience,
            issuer,
            algorithms: ['RS256'],
          });
        }
      } else {
        // En producción, solo verificación normal
        const secret = this.configService.get<string>('auth.secret');
        const audience = this.configService.get<string>('auth.audience');
        const issuer = this.configService.get<string>('auth.issuer');
        
        payload = jwt.verify(token, secret, {
          audience,
          issuer,
          algorithms: ['RS256'],
        });
      }
      
      // Guardar el payload del token en la solicitud para uso posterior si es necesario
      request['user'] = payload;
      
      this.logger.debug(
        'Autenticación exitosa',
        'AUTH',
        { 
          ip: request.ip, 
          endpoint: request.url, 
          user: payload['sub'] || 'unknown'
        }
      );
      
      return true;
    } catch (error) {
      this.logger.warn(
        `Acceso denegado: ${error.message}`,
        'AUTH',
        { 
          ip: request.ip, 
          endpoint: request.url, 
          error: error.name 
        }
      );
      
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('El token de autenticación ha expirado');
      }
      
      throw new UnauthorizedException('Token de autenticación inválido');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return undefined;
    }
    
    return authHeader.substring(7); // Eliminar 'Bearer ' del inicio
  }
} 