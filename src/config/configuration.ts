export default () => ({
  port: parseInt(process.env.PORT, 10) || 1338,
  environment: process.env.NODE_ENV || 'development',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'optipension',
  },
  auth: {
    // En un entorno real, se obtendrían de variables de entorno
    secret: process.env.AUTH_SECRET || 'Esta es una clave de ejemplo y debe ser reemplazada en producción',
    audience: process.env.AUTH_AUDIENCE || 'https://api.optipension.com',
    issuer: process.env.AUTH_ISSUER || 'https://optipension.auth0.com/',
    expiresIn: process.env.AUTH_EXPIRES_IN || '1h',
  },
  file: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 2 * 1024 * 1024, // 2MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || ['application/pdf'],
    allowedExtensions: process.env.ALLOWED_FILE_EXTENSIONS?.split(',') || ['.pdf'],
    uploadPath: process.env.UPLOAD_PATH || './uploads',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    console: process.env.LOG_CONSOLE === 'true' || true,
    file: process.env.LOG_FILE === 'true' || false,
    syslog: process.env.LOG_SYSLOG === 'true' || false,
  },
}); 