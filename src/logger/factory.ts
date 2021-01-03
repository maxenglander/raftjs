import * as Pino from 'pino';
const pino = require('pino');

import { ILogger, ILoggerOptions } from './logger';

// Create a logger.
export function createLogger(options: ILoggerOptions = {}): ILogger {
    return pino({
        level: options.level ? options.level : 'error',
        prettyPrint: 'machineReadable' in options ? !options.machineReadable : true
    });
}
