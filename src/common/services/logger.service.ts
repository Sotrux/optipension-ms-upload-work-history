import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FileOperationLog {
  timestamp: string;
  operation: 'upload' | 'validation' | 'processing';
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: 'success' | 'failure';
  failureReason?: string;
  metadata?: Record<string, any>;
  userId?: string;
  requestId?: string;
}

export interface ErrorLog {
  timestamp: string;
  context: string;
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
  userId?: string;
  requestId?: string;
}

export interface SecurityLog {
  timestamp: string;
  action: 'login' | 'logout' | 'access_denied' | 'access_granted';
  userId?: string;
  ip?: string;
  endpoint: string;
  status: 'success' | 'failure';
  failureReason?: string;
  metadata?: Record<string, any>;
  requestId?: string;
}

export interface PerformanceLog {
  timestamp: string;
  operation: string;
  duration: number;
  endpoint: string;
  status: number;
  metadata?: Record<string, any>;
  userId?: string;
  requestId?: string;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly requestId: string;
  
  constructor(private configService: ConfigService) {
    this.requestId = this.generateRequestId();
  }

  private generateRequestId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
  }

  private formatDate(): string {
    return new Date().toISOString();
  }

  private formatLog(level: string, message: string, context?: string, metadata?: Record<string, any>): string {
    return JSON.stringify({
      timestamp: this.formatDate(),
      level,
      context: context || 'APP',
      message,
      requestId: this.requestId,
      ...metadata
    });
  }

  log(message: string, context?: string, metadata?: Record<string, any>) {
    console.log(this.formatLog('INFO', message, context, metadata));
  }

  error(message: string, trace?: string, context?: string, metadata?: Record<string, any>) {
    console.error(this.formatLog('ERROR', message, context, {
      ...metadata,
      trace: trace || undefined
    }));
  }

  warn(message: string, context?: string, metadata?: Record<string, any>) {
    console.warn(this.formatLog('WARN', message, context, metadata));
  }

  debug(message: string, context?: string, metadata?: Record<string, any>) {
    console.debug(this.formatLog('DEBUG', message, context, metadata));
  }

  verbose(message: string, context?: string, metadata?: Record<string, any>) {
    console.log(this.formatLog('VERBOSE', message, context, metadata));
  }

  // Logs específicos para operaciones de archivos
  logFileOperation(data: FileOperationLog) {
    const logEntry = {
      timestamp: data.timestamp || this.formatDate(),
      level: data.status === 'success' ? 'INFO' : 'ERROR',
      context: 'FILE_OPERATION',
      operation: data.operation,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      status: data.status,
      requestId: this.requestId,
      ...(data.userId && { userId: data.userId }),
      ...(data.failureReason && { failureReason: data.failureReason }),
      ...(data.metadata && { metadata: data.metadata })
    };

    if (data.status === 'success') {
      console.log(JSON.stringify(logEntry));
    } else {
      console.error(JSON.stringify(logEntry));
    }
  }

  // Logs específicos para errores
  logError(data: ErrorLog) {
    const logEntry = {
      timestamp: data.timestamp || this.formatDate(),
      level: 'ERROR',
      context: data.context,
      requestId: this.requestId,
      ...(data.userId && { userId: data.userId }),
      error: {
        message: data.error.message,
        ...(data.error.code && { code: data.error.code }),
        ...(data.error.stack && { stack: data.error.stack })
      },
      ...(data.metadata && { metadata: data.metadata })
    };

    console.error(JSON.stringify(logEntry));
  }

  // Log específico para seguridad
  logSecurity(data: SecurityLog) {
    const logEntry = {
      timestamp: data.timestamp || this.formatDate(),
      level: data.status === 'success' ? 'INFO' : 'WARN',
      context: 'SECURITY',
      action: data.action,
      endpoint: data.endpoint,
      requestId: this.requestId,
      ...(data.userId && { userId: data.userId }),
      ...(data.ip && { ip: data.ip }),
      status: data.status,
      ...(data.failureReason && { failureReason: data.failureReason }),
      ...(data.metadata && { metadata: data.metadata })
    };

    if (data.status === 'success') {
      console.log(JSON.stringify(logEntry));
    } else {
      console.warn(JSON.stringify(logEntry));
    }
  }

  // Log específico para rendimiento
  logPerformance(data: PerformanceLog) {
    const logEntry = {
      timestamp: data.timestamp || this.formatDate(),
      level: 'INFO',
      context: 'PERFORMANCE',
      operation: data.operation,
      duration: data.duration,
      endpoint: data.endpoint,
      status: data.status,
      requestId: this.requestId,
      ...(data.userId && { userId: data.userId }),
      ...(data.metadata && { metadata: data.metadata })
    };

    console.log(JSON.stringify(logEntry));
  }

  // Log específico para rate limiting
  logRateLimitExceeded(ip: string, endpoint: string, userId?: string) {
    this.warn('Rate limit exceeded', 'RATE_LIMIT', {
      ip,
      endpoint,
      userId,
      limit: 3,
      windowMs: 60000,
      requestId: this.requestId
    });
  }
} 