import pino from 'pino';
import PinoPapertrail from 'pino-papertrail';

// Ensure environment variables are defined
const PAPERTRAIL_HOST = process.env.PAPERTRAIL_HOST || 'localhost';
const PAPERTRAIL_PORT = process.env.PAPERTRAIL_PORT || '12345';

const transport = PinoPapertrail.createWriteStream({
  host: PAPERTRAIL_HOST,
  port: PAPERTRAIL_PORT,
  appname: 'optipension-service'
});

const logger = pino(
  {
    level: 'info',
    base: null, // No extra metadata
  },
  transport,
);

export default logger;