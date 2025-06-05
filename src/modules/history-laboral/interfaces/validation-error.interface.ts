export interface ValidationError {
  code: string;
  message: string;
  details?: Record<string, any>;
} 