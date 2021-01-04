import Pino from 'pino';

import { ILogger, ILoggerOptions } from './@types';

// Create a logger.
export function createLogger(options: ILoggerOptions = {}): ILogger {
  return Pino({
    level: options.level ? options.level : 'error',
    prettyPrint: 'machineReadable' in options ? !options.machineReadable : true
  });
}
